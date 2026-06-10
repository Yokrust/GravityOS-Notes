import type {
  FilesystemPort,
  NoteDocument,
  NotesNavigationState,
  NotesState,
  NoteTreeNode,
  PersistedNotesState,
  PersistencePort,
  ProjectPathStatus
} from "../../contracts/index.js";

const MARKDOWN_EXTENSION = ".md";

export class NotesService {
  constructor(
    private readonly filesystem: FilesystemPort,
    private readonly persistence: PersistencePort
  ) {}

  async hydrate(): Promise<NotesState> {
    const persistedState = await this.persistence.loadState();
    return this.loadNotebook(
      normalizePersistedNotesState(persistedState.appMetadata.notesState)
    );
  }

  async attach(notebookRoot: string): Promise<NotesState> {
    const rootDetails = await this.filesystem.inspectPath(notebookRoot);
    if (rootDetails.status !== "ready" || rootDetails.kind !== "directory") {
      throw new Error("The selected Notebook Root is not a readable folder.");
    }

    const normalizedRoot = this.filesystem.resolvePath(notebookRoot);
    const preferences: PersistedNotesState = {
      activeNoteId: null,
      expandedFolders: {},
      notebookRoot: normalizedRoot
    };
    await this.savePreferences(preferences);
    return this.loadNotebook(preferences);
  }

  async refresh(): Promise<NotesState> {
    return this.hydrate();
  }

  async selectNote(notePath: string): Promise<NotesState> {
    const preferences = await this.loadPreferences();
    const notebookRoot = requireNotebookRoot(preferences);
    await this.assertMarkdownFile(notebookRoot, notePath);

    const nextPreferences = {
      ...preferences,
      activeNoteId: notePath
    };
    await this.savePreferences(nextPreferences);
    return this.loadNotebook(nextPreferences);
  }

  async saveNavigation(
    navigation: NotesNavigationState
  ): Promise<PersistedNotesState> {
    const preferences = await this.loadPreferences();
    const nextPreferences = {
      ...preferences,
      activeNoteId: navigation.activeNoteId,
      expandedFolders: { ...navigation.expandedFolders }
    };
    await this.savePreferences(nextPreferences);
    return nextPreferences;
  }

  async saveNote(notePath: string, content: string): Promise<NoteDocument> {
    const preferences = await this.loadPreferences();
    const notebookRoot = requireNotebookRoot(preferences);
    await this.assertMarkdownFile(notebookRoot, notePath);
    await this.filesystem.writeFile(notePath, content);
    const details = await this.filesystem.inspectPath(notePath);

    return {
      content,
      id: notePath,
      name: noteName(this.filesystem.baseName(notePath)),
      path: notePath,
      updatedAt: details.modifiedAt ?? Date.now()
    };
  }

  async createNote(parentPath?: string): Promise<NotesState> {
    const preferences = await this.loadPreferences();
    const notebookRoot = requireNotebookRoot(preferences);
    const targetDirectory = parentPath ?? notebookRoot;
    await this.assertDirectory(notebookRoot, targetDirectory);
    const notePath = await this.nextAvailablePath(
      targetDirectory,
      "Nueva nota",
      MARKDOWN_EXTENSION
    );
    await this.filesystem.writeFile(notePath, "");

    const nextPreferences = {
      ...preferences,
      activeNoteId: notePath,
      expandedFolders:
        targetDirectory === notebookRoot
          ? preferences.expandedFolders
          : {
              ...preferences.expandedFolders,
              [targetDirectory]: true
            }
    };
    await this.savePreferences(nextPreferences);
    return this.loadNotebook(nextPreferences);
  }

  async createFolder(parentPath?: string): Promise<NotesState> {
    const preferences = await this.loadPreferences();
    const notebookRoot = requireNotebookRoot(preferences);
    const targetDirectory = parentPath ?? notebookRoot;
    await this.assertDirectory(notebookRoot, targetDirectory);
    const folderPath = await this.nextAvailablePath(
      targetDirectory,
      "Nueva carpeta"
    );
    await this.filesystem.createDirectory(folderPath);

    const nextPreferences = {
      ...preferences,
      expandedFolders: {
        ...preferences.expandedFolders,
        ...(targetDirectory === notebookRoot
          ? {}
          : { [targetDirectory]: true }),
        [folderPath]: true
      }
    };
    await this.savePreferences(nextPreferences);
    return this.loadNotebook(nextPreferences);
  }

  async renameNode(nodePath: string, nextName: string): Promise<NotesState> {
    const preferences = await this.loadPreferences();
    const notebookRoot = requireNotebookRoot(preferences);
    this.assertManagedPath(notebookRoot, nodePath);
    const details = await this.filesystem.inspectPath(nodePath);
    if (details.status !== "ready" || !details.kind) {
      throw new Error("The note or folder no longer exists.");
    }

    const safeName = normalizeNodeName(nextName);
    const destinationPath = this.filesystem.resolvePath(
      this.filesystem.directoryName(nodePath),
      details.kind === "file" ? `${safeName}${MARKDOWN_EXTENSION}` : safeName
    );

    if (destinationPath !== nodePath) {
      const destinationDetails =
        await this.filesystem.inspectPath(destinationPath);
      if (destinationDetails.status === "ready") {
        throw new Error("A note or folder with that name already exists.");
      }
      await this.filesystem.movePath(nodePath, destinationPath);
    }

    const nextPreferences = remapPreferences(
      this.filesystem,
      preferences,
      nodePath,
      destinationPath
    );
    await this.savePreferences(nextPreferences);
    return this.loadNotebook(nextPreferences);
  }

  async deleteNode(nodePath: string): Promise<NotesState> {
    const preferences = await this.loadPreferences();
    const notebookRoot = requireNotebookRoot(preferences);
    this.assertManagedPath(notebookRoot, nodePath);
    if (nodePath === notebookRoot) {
      throw new Error("The Notebook Root cannot be deleted.");
    }

    const details = await this.filesystem.inspectPath(nodePath);
    if (details.status === "ready") {
      await this.filesystem.deletePath(nodePath, {
        recursive: details.kind === "directory"
      });
    }

    const nextExpandedFolders = Object.fromEntries(
      Object.entries(preferences.expandedFolders).filter(
        ([path]) => !this.filesystem.isPathInside(nodePath, path)
      )
    );
    const nextPreferences = {
      ...preferences,
      activeNoteId:
        preferences.activeNoteId &&
        this.filesystem.isPathInside(nodePath, preferences.activeNoteId)
          ? null
          : preferences.activeNoteId,
      expandedFolders: nextExpandedFolders
    };
    await this.savePreferences(nextPreferences);
    return this.loadNotebook(nextPreferences);
  }

  private async loadPreferences(): Promise<PersistedNotesState> {
    const persistedState = await this.persistence.loadState();
    return normalizePersistedNotesState(persistedState.appMetadata.notesState);
  }

  private async savePreferences(state: PersistedNotesState): Promise<void> {
    const persistedState = await this.persistence.loadState();
    await this.persistence.saveAppMetadata({
      ...persistedState.appMetadata,
      notesState: {
        activeNoteId: state.activeNoteId,
        expandedFolders: { ...state.expandedFolders },
        notebookRoot: state.notebookRoot
      }
    });
  }

  private async loadNotebook(
    preferences: PersistedNotesState
  ): Promise<NotesState> {
    if (!preferences.notebookRoot) {
      return emptyNotesState(preferences);
    }

    const rootDetails = await this.filesystem.inspectPath(
      preferences.notebookRoot
    );
    if (rootDetails.status !== "ready" || rootDetails.kind !== "directory") {
      return {
        ...emptyNotesState(preferences),
        notebookName: this.filesystem.baseName(preferences.notebookRoot),
        pathStatus: rootDetails.status
      };
    }

    const tree = await this.readTree(preferences.notebookRoot);
    const notePaths = collectNotePaths(tree);
    const activeNoteId = notePaths.includes(preferences.activeNoteId ?? "")
      ? preferences.activeNoteId
      : (notePaths[0] ?? null);
    const activeNote = activeNoteId ? await this.readNote(activeNoteId) : null;

    return {
      activeNote,
      activeNoteId,
      expandedFolders: filterExpandedFolders(preferences.expandedFolders, tree),
      notebookName: this.filesystem.baseName(preferences.notebookRoot),
      notebookRoot: preferences.notebookRoot,
      pathStatus: "ready",
      tree
    };
  }

  private async readTree(directoryPath: string): Promise<NoteTreeNode[]> {
    const entries = await this.filesystem.listDirectory(directoryPath);
    const nodes = await Promise.all(
      entries.map(async (entry): Promise<NoteTreeNode | null> => {
        const fileName = this.filesystem.baseName(entry.path);
        if (fileName.startsWith(".") || entry.type === "other") {
          return null;
        }

        if (entry.type === "directory") {
          return {
            children: await this.readTree(entry.path),
            id: entry.path,
            name: fileName,
            path: entry.path,
            type: "folder"
          };
        }

        if (!fileName.toLowerCase().endsWith(MARKDOWN_EXTENSION)) {
          return null;
        }

        const details = await this.filesystem.inspectPath(entry.path);
        return {
          id: entry.path,
          name: noteName(fileName),
          path: entry.path,
          type: "note",
          updatedAt: details.modifiedAt ?? 0
        };
      })
    );

    return nodes
      .filter((node): node is NoteTreeNode => node !== null)
      .toSorted(
        (left, right) =>
          Number(left.type === "note") - Number(right.type === "note") ||
          left.name.localeCompare(right.name, undefined, {
            sensitivity: "base"
          })
      );
  }

  private async readNote(notePath: string): Promise<NoteDocument> {
    const details = await this.filesystem.inspectPath(notePath);
    return {
      content: await this.filesystem.readFile(notePath),
      id: notePath,
      name: noteName(this.filesystem.baseName(notePath)),
      path: notePath,
      updatedAt: details.modifiedAt ?? 0
    };
  }

  private async assertDirectory(
    notebookRoot: string,
    directoryPath: string
  ): Promise<void> {
    this.assertManagedPath(notebookRoot, directoryPath);
    const details = await this.filesystem.inspectPath(directoryPath);
    if (details.status !== "ready" || details.kind !== "directory") {
      throw new Error("The target folder is not available.");
    }
  }

  private async assertMarkdownFile(
    notebookRoot: string,
    notePath: string
  ): Promise<void> {
    this.assertManagedPath(notebookRoot, notePath);
    if (!notePath.toLowerCase().endsWith(MARKDOWN_EXTENSION)) {
      throw new Error("Only Markdown notes can be opened.");
    }
    const details = await this.filesystem.inspectPath(notePath);
    if (details.status !== "ready" || details.kind !== "file") {
      throw new Error("The selected note is not available.");
    }
  }

  private assertManagedPath(notebookRoot: string, targetPath: string): void {
    if (!this.filesystem.isPathInside(notebookRoot, targetPath)) {
      throw new Error("The path is outside the Notebook Root.");
    }
  }

  private async nextAvailablePath(
    directoryPath: string,
    baseName: string,
    extension = ""
  ): Promise<string> {
    const entries = await this.filesystem.listDirectory(directoryPath);
    const existingNames = new Set(
      entries.map((entry) =>
        this.filesystem.baseName(entry.path).toLocaleLowerCase()
      )
    );

    for (let index = 1; index < 10_000; index += 1) {
      const suffix = index === 1 ? "" : ` ${index}`;
      const candidateName = `${baseName}${suffix}${extension}`;
      if (!existingNames.has(candidateName.toLocaleLowerCase())) {
        return this.filesystem.resolvePath(directoryPath, candidateName);
      }
    }

    throw new Error("Could not find an available name.");
  }
}

function normalizePersistedNotesState(
  state: PersistedNotesState | null | undefined
): PersistedNotesState {
  return {
    activeNoteId: state?.activeNoteId ?? null,
    expandedFolders: { ...(state?.expandedFolders ?? {}) },
    notebookRoot: state?.notebookRoot ?? null
  };
}

function emptyNotesState(preferences: PersistedNotesState): NotesState {
  return {
    activeNote: null,
    activeNoteId: null,
    expandedFolders: { ...preferences.expandedFolders },
    notebookName: null,
    notebookRoot: preferences.notebookRoot,
    pathStatus: null,
    tree: []
  };
}

function requireNotebookRoot(state: PersistedNotesState): string {
  if (!state.notebookRoot) {
    throw new Error("Choose a Notebook Root first.");
  }
  return state.notebookRoot;
}

function noteName(fileName: string): string {
  return fileName.slice(0, -MARKDOWN_EXTENSION.length);
}

function normalizeNodeName(value: string): string {
  const trimmed = value.trim().replace(/\.md$/i, "");
  if (
    !trimmed ||
    trimmed === "." ||
    trimmed === ".." ||
    /[\\/:\0]/.test(trimmed)
  ) {
    throw new Error("Use a valid note or folder name.");
  }
  return trimmed;
}

function collectNotePaths(nodes: NoteTreeNode[]): string[] {
  return nodes.flatMap((node) =>
    node.type === "note" ? [node.path] : collectNotePaths(node.children ?? [])
  );
}

function collectFolderPaths(nodes: NoteTreeNode[]): Set<string> {
  return new Set(
    nodes.flatMap((node) =>
      node.type === "folder"
        ? [node.path, ...collectFolderPaths(node.children ?? [])]
        : []
    )
  );
}

function filterExpandedFolders(
  expandedFolders: Record<string, boolean>,
  tree: NoteTreeNode[]
): Record<string, boolean> {
  const folderPaths = collectFolderPaths(tree);
  return Object.fromEntries(
    Object.entries(expandedFolders).filter(([path]) => folderPaths.has(path))
  );
}

function remapPreferences(
  filesystem: FilesystemPort,
  preferences: PersistedNotesState,
  sourcePath: string,
  destinationPath: string
): PersistedNotesState {
  const remapPath = (path: string | null): string | null => {
    if (!path || !filesystem.isPathInside(sourcePath, path)) {
      return path;
    }
    const relativePath = filesystem.relativePath(sourcePath, path);
    return relativePath
      ? filesystem.resolvePath(destinationPath, relativePath)
      : destinationPath;
  };

  return {
    ...preferences,
    activeNoteId: remapPath(preferences.activeNoteId),
    expandedFolders: Object.fromEntries(
      Object.entries(preferences.expandedFolders).map(([path, expanded]) => [
        remapPath(path) ?? path,
        expanded
      ])
    )
  };
}

export function notesPathStatusMessage(
  status: ProjectPathStatus | null
): string | null {
  if (status === "missing") return "No se encontró la carpeta del cuaderno.";
  if (status === "unreadable")
    return "No se puede leer la carpeta del cuaderno.";
  return null;
}
