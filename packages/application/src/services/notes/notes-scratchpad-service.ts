import type {
  FilesystemPort,
  NotesProposedChange,
  NotesScratchpadApplyResult,
  NotesScratchpadChangePreview,
  NotesScratchpadState,
  PersistedNotesState,
  PersistencePort
} from "../../contracts/index.js";

import { NotesService } from "./notes-service.js";

const MARKDOWN_EXTENSION = ".md";

type Rollback = () => Promise<void>;

export class NotesScratchpadService {
  private pendingChanges: NotesProposedChange[] = [];

  constructor(
    private readonly filesystem: FilesystemPort,
    private readonly persistence: PersistencePort,
    private readonly notes: NotesService
  ) {}

  async hydrate(): Promise<NotesScratchpadState> {
    return this.stateFromChanges(this.pendingChanges);
  }

  async stage(changes: NotesProposedChange[]): Promise<NotesScratchpadState> {
    if (changes.length === 0) {
      throw new Error("Scratchpad requires at least one Proposed Change.");
    }

    await this.preflight(changes);
    this.pendingChanges = changes.map(cloneChange);
    return this.stateFromChanges(this.pendingChanges);
  }

  async reject(): Promise<NotesScratchpadState> {
    this.pendingChanges = [];
    return this.stateFromChanges(this.pendingChanges);
  }

  async accept(): Promise<NotesScratchpadApplyResult> {
    const changes = this.pendingChanges.map(cloneChange);
    if (changes.length === 0) {
      return {
        notes: await this.notes.refresh(),
        scratchpad: await this.stateFromChanges([])
      };
    }

    await this.preflight(changes);
    const rollbacks: Rollback[] = [];

    try {
      for (const change of changes) {
        rollbacks.push(await this.applyChange(change));
      }
    } catch (error) {
      for (const rollback of rollbacks.reverse()) {
        await rollback();
      }
      throw error;
    }

    this.pendingChanges = [];
    return {
      notes: await this.notes.refresh(),
      scratchpad: await this.stateFromChanges([])
    };
  }

  private async stateFromChanges(
    changes: NotesProposedChange[]
  ): Promise<NotesScratchpadState> {
    return {
      changes: await Promise.all(
        changes.map((change) => this.previewChange(change))
      ),
      isOpen: changes.length > 0
    };
  }

  private async preflight(changes: NotesProposedChange[]): Promise<void> {
    const notebookRoot = await this.requireNotebookRoot();
    for (const change of changes) {
      this.assertManagedPath(notebookRoot, change.path);

      if (change.type === "createNote") {
        this.assertMarkdownPath(change.path);
        await this.assertParentDirectory(notebookRoot, change.path);
        await this.assertMissing(change.path);
        continue;
      }

      if (change.type === "editNote" || change.type === "appendNote") {
        await this.assertMarkdownFile(notebookRoot, change.path);
        continue;
      }

      if (change.type === "renameNode") {
        await this.assertExistingNode(notebookRoot, change.path);
        const nextName = normalizeNodeName(change.nextName);
        const details = await this.filesystem.inspectPath(change.path);
        const destinationPath = this.filesystem.resolvePath(
          this.filesystem.directoryName(change.path),
          details.kind === "file"
            ? `${nextName}${MARKDOWN_EXTENSION}`
            : nextName
        );
        if (destinationPath !== change.path) {
          await this.assertMissing(destinationPath);
        }
        continue;
      }

      if (change.type === "moveNote") {
        await this.assertMarkdownFile(notebookRoot, change.path);
        await this.assertDirectory(notebookRoot, change.targetFolderPath);
        const destinationPath = this.filesystem.resolvePath(
          change.targetFolderPath,
          this.filesystem.baseName(change.path)
        );
        if (destinationPath !== change.path) {
          await this.assertMissing(destinationPath);
        }
        continue;
      }

      if (change.type === "deleteNote") {
        await this.assertMarkdownFile(notebookRoot, change.path);
        continue;
      }

      this.assertManagedPath(notebookRoot, change.path);
      await this.assertParentDirectory(notebookRoot, change.path);
      await this.assertMissing(change.path);
    }
  }

  private async previewChange(
    change: NotesProposedChange
  ): Promise<NotesScratchpadChangePreview> {
    if (change.type === "createNote") {
      return {
        afterContent: change.content,
        afterPath: change.path,
        change
      };
    }

    if (change.type === "editNote") {
      const beforeContent = await this.readExistingContent(change.path);
      return {
        afterContent: change.content,
        beforePath: change.path,
        change,
        ...(beforeContent === undefined ? {} : { beforeContent })
      };
    }

    if (change.type === "appendNote") {
      const beforeContent = await this.readExistingContent(change.path);
      return {
        afterContent:
          beforeContent === undefined
            ? change.content
            : `${beforeContent}${change.content}`,
        beforePath: change.path,
        change,
        ...(beforeContent === undefined ? {} : { beforeContent })
      };
    }

    if (change.type === "renameNode") {
      return {
        afterPath: await this.resolveRenameDestination(change),
        beforePath: change.path,
        change
      };
    }

    if (change.type === "moveNote") {
      return {
        afterPath: this.filesystem.resolvePath(
          change.targetFolderPath,
          this.filesystem.baseName(change.path)
        ),
        beforePath: change.path,
        change
      };
    }

    if (change.type === "deleteNote") {
      const beforeContent = await this.readExistingContent(change.path);
      return {
        beforePath: change.path,
        change,
        ...(beforeContent === undefined ? {} : { beforeContent })
      };
    }

    return {
      afterPath: change.path,
      change
    };
  }

  private async applyChange(change: NotesProposedChange): Promise<Rollback> {
    if (change.type === "createNote") {
      await this.filesystem.writeFile(change.path, change.content);
      return async () => this.filesystem.deletePath(change.path);
    }

    if (change.type === "editNote") {
      const previousContent = await this.filesystem.readFile(change.path);
      await this.notes.saveNote(change.path, change.content);
      return async () =>
        this.filesystem.writeFile(change.path, previousContent);
    }

    if (change.type === "appendNote") {
      const previousContent = await this.filesystem.readFile(change.path);
      await this.notes.saveNote(
        change.path,
        `${previousContent}${change.content}`
      );
      return async () =>
        this.filesystem.writeFile(change.path, previousContent);
    }

    if (change.type === "renameNode") {
      const notebookRoot = await this.requireNotebookRoot();
      const previousNotebookContent =
        await this.snapshotMarkdownFiles(notebookRoot);
      const destinationPath = await this.resolveRenameDestination(change);
      await this.notes.renameNode(change.path, change.nextName);
      return async () => {
        const destinationDetails =
          await this.filesystem.inspectPath(destinationPath);
        if (destinationDetails.status === "ready") {
          await this.filesystem.movePath(destinationPath, change.path);
        }
        for (const [path, content] of previousNotebookContent) {
          await this.filesystem.writeFile(path, content);
        }
      };
    }

    if (change.type === "moveNote") {
      const destinationPath = this.filesystem.resolvePath(
        change.targetFolderPath,
        this.filesystem.baseName(change.path)
      );
      await this.filesystem.movePath(change.path, destinationPath);
      return async () => this.filesystem.movePath(destinationPath, change.path);
    }

    if (change.type === "deleteNote") {
      const previousContent = await this.filesystem.readFile(change.path);
      await this.filesystem.deletePath(change.path);
      return async () =>
        this.filesystem.writeFile(change.path, previousContent);
    }

    await this.filesystem.createDirectory(change.path);
    return async () => this.filesystem.deletePath(change.path);
  }

  private async resolveRenameDestination(
    change: Extract<NotesProposedChange, { type: "renameNode" }>
  ): Promise<string> {
    const details = await this.filesystem.inspectPath(change.path);
    const nextName = normalizeNodeName(change.nextName);
    return this.filesystem.resolvePath(
      this.filesystem.directoryName(change.path),
      details.kind === "file" ? `${nextName}${MARKDOWN_EXTENSION}` : nextName
    );
  }

  private async requireNotebookRoot(): Promise<string> {
    const persistedState = await this.persistence.loadState();
    const notesState = normalizePersistedNotesState(
      persistedState.appMetadata.notesState
    );
    if (!notesState.notebookRoot) {
      throw new Error("Choose a Notebook Root first.");
    }
    return notesState.notebookRoot;
  }

  private assertManagedPath(notebookRoot: string, targetPath: string): void {
    if (!this.filesystem.isPathInside(notebookRoot, targetPath)) {
      throw new Error("The path is outside the Notebook Root.");
    }
  }

  private assertMarkdownPath(notePath: string): void {
    if (!notePath.toLowerCase().endsWith(MARKDOWN_EXTENSION)) {
      throw new Error("Only Markdown notes can be changed.");
    }
  }

  private async assertMarkdownFile(
    notebookRoot: string,
    notePath: string
  ): Promise<void> {
    this.assertManagedPath(notebookRoot, notePath);
    this.assertMarkdownPath(notePath);
    const details = await this.filesystem.inspectPath(notePath);
    if (details.status !== "ready" || details.kind !== "file") {
      throw new Error("The selected note is not available.");
    }
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

  private async assertExistingNode(
    notebookRoot: string,
    nodePath: string
  ): Promise<void> {
    this.assertManagedPath(notebookRoot, nodePath);
    const details = await this.filesystem.inspectPath(nodePath);
    if (details.status !== "ready" || !details.kind) {
      throw new Error("The note or folder no longer exists.");
    }
  }

  private async assertParentDirectory(
    notebookRoot: string,
    targetPath: string
  ): Promise<void> {
    await this.assertDirectory(
      notebookRoot,
      this.filesystem.directoryName(targetPath)
    );
  }

  private async assertMissing(path: string): Promise<void> {
    const details = await this.filesystem.inspectPath(path);
    if (details.status === "ready") {
      throw new Error("A note or folder already exists at that path.");
    }
  }

  private async readExistingContent(path: string): Promise<string | undefined> {
    const details = await this.filesystem.inspectPath(path);
    if (details.status !== "ready" || details.kind !== "file") {
      return undefined;
    }
    return this.filesystem.readFile(path);
  }

  private async snapshotMarkdownFiles(
    directoryPath: string
  ): Promise<Map<string, string>> {
    const snapshot = new Map<string, string>();
    const entries = await this.filesystem.listDirectory(directoryPath);
    for (const entry of entries) {
      if (entry.type === "directory") {
        for (const [path, content] of await this.snapshotMarkdownFiles(
          entry.path
        )) {
          snapshot.set(path, content);
        }
        continue;
      }

      if (
        entry.type === "file" &&
        entry.path.toLowerCase().endsWith(MARKDOWN_EXTENSION)
      ) {
        snapshot.set(entry.path, await this.filesystem.readFile(entry.path));
      }
    }
    return snapshot;
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

function cloneChange(change: NotesProposedChange): NotesProposedChange {
  return { ...change };
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
