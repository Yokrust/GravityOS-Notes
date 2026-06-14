import type {
  FilesystemPort,
  ImportedNoteImage,
  NoteDocument,
  NoteImageAsset,
  NoteImageImport,
  NotesNavigationState,
  NotesState,
  NoteTreeNode,
  PersistedNotesState,
  PersistencePort,
  ProjectPathStatus
} from "../../contracts/index.js";

const MARKDOWN_EXTENSION = ".md";
const NOTE_ASSET_DIRECTORY = ".gravity-assets";
const NOTE_IMAGE_TYPES: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};
const NOTE_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};
const MAX_NOTE_IMAGE_BYTES = 20 * 1024 * 1024;

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

  async importImage(
    notePath: string,
    sourcePath: string
  ): Promise<ImportedNoteImage> {
    const preferences = await this.loadPreferences();
    const notebookRoot = requireNotebookRoot(preferences);
    await this.assertMarkdownFile(notebookRoot, notePath);
    const sourceDetails = await this.filesystem.inspectPath(sourcePath);
    if (sourceDetails.status !== "ready" || sourceDetails.kind !== "file") {
      throw new Error("The selected image is not readable.");
    }

    const extension = fileExtension(this.filesystem.baseName(sourcePath));
    const mimeType = NOTE_IMAGE_TYPES[extension];
    if (!mimeType) {
      throw new Error("Unsupported note image type.");
    }
    const bytes = await this.filesystem.readBytes(sourcePath);
    return this.saveImageAsset(notebookRoot, notePath, {
      bytes,
      fileName: this.filesystem.baseName(sourcePath),
      mimeType
    });
  }

  async importImageBytes(
    notePath: string,
    input: NoteImageImport
  ): Promise<ImportedNoteImage> {
    const preferences = await this.loadPreferences();
    const notebookRoot = requireNotebookRoot(preferences);
    await this.assertMarkdownFile(notebookRoot, notePath);
    return this.saveImageAsset(notebookRoot, notePath, input);
  }

  private async saveImageAsset(
    notebookRoot: string,
    notePath: string,
    input: NoteImageImport
  ): Promise<ImportedNoteImage> {
    const mimeType = input.mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
    const extension = NOTE_IMAGE_EXTENSIONS[mimeType];
    if (!extension) throw new Error("Unsupported note image type.");
    if (
      !input.bytes.byteLength ||
      input.bytes.byteLength > MAX_NOTE_IMAGE_BYTES
    ) {
      throw new Error("Note images must be between 1 byte and 20 MB.");
    }
    if (!matchesImageType(input.bytes, mimeType)) {
      throw new Error("The selected image contents do not match its type.");
    }

    const assetDirectory = this.filesystem.resolvePath(
      notebookRoot,
      NOTE_ASSET_DIRECTORY
    );
    await this.filesystem.createDirectory(assetDirectory);
    const sourceName = this.filesystem.baseName(input.fileName);
    const sourceExtension = fileExtension(sourceName);
    const baseName = sanitizeAssetName(
      sourceName.slice(
        0,
        Math.max(0, sourceName.length - sourceExtension.length)
      )
    );
    const destinationPath = await this.nextAvailablePath(
      assetDirectory,
      baseName || "imagen",
      extension
    );
    await this.filesystem.writeBytes(destinationPath, input.bytes);

    return {
      alt: baseName || "Imagen",
      source: encodeMarkdownPath(
        this.filesystem.relativePath(
          this.filesystem.directoryName(notePath),
          destinationPath
        )
      )
    };
  }

  async loadImage(notePath: string, source: string): Promise<NoteImageAsset> {
    const preferences = await this.loadPreferences();
    const notebookRoot = requireNotebookRoot(preferences);
    await this.assertMarkdownFile(notebookRoot, notePath);
    const imagePath = this.filesystem.resolvePath(
      this.filesystem.directoryName(notePath),
      decodeURIComponent(source)
    );
    this.assertManagedPath(notebookRoot, imagePath);
    const mimeType =
      NOTE_IMAGE_TYPES[fileExtension(this.filesystem.baseName(imagePath))];
    if (!mimeType) throw new Error("Unsupported note image type.");

    const bytes = await this.filesystem.readBytes(imagePath);
    if (!bytes.byteLength || bytes.byteLength > MAX_NOTE_IMAGE_BYTES) {
      throw new Error("Note images must be between 1 byte and 20 MB.");
    }
    if (!matchesImageType(bytes, mimeType)) {
      throw new Error("The note image contents do not match its type.");
    }
    return { bytes, mimeType };
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
    await this.persistence.updateAppMetadata({
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

function fileExtension(fileName: string): string {
  return fileName.toLowerCase().match(/(\.[a-z0-9]+)$/)?.[1] ?? "";
}

function sanitizeAssetName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function encodeMarkdownPath(value: string): string {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function matchesImageType(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "image/png") {
    return [0x89, 0x50, 0x4e, 0x47].every(
      (value, index) => bytes[index] === value
    );
  }
  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/gif") {
    return new TextDecoder().decode(bytes.slice(0, 6)).startsWith("GIF8");
  }
  if (mimeType === "image/webp") {
    const decoder = new TextDecoder();
    return (
      decoder.decode(bytes.slice(0, 4)) === "RIFF" &&
      decoder.decode(bytes.slice(8, 12)) === "WEBP"
    );
  }
  return false;
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
