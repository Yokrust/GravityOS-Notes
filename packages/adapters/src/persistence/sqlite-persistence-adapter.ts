import Database from "better-sqlite3";

import type {
  AppMetadata,
  PersistedAppState,
  PersistencePort
} from "@gravity/application";
import type {
  AgentActivityItem,
  Project,
  Run,
  RunResult,
  RunThread,
  Thread,
  ThreadMessage
} from "@gravity/domain";

type SqliteDatabase = InstanceType<typeof Database>;
type PayloadRow = { payload: string };
type ProjectIdRow = { project_id: string };
type RunIdRow = { id: string };

const DEFAULT_APP_METADATA: AppMetadata = {
  selectedProjectId: null
};

export class SqlitePersistenceAdapter implements PersistencePort {
  private readonly database: SqliteDatabase;

  constructor(readonly databasePath: string) {
    this.database = new Database(databasePath);
    this.database.pragma("journal_mode = WAL");
    this.initialize();
  }

  async loadState(): Promise<PersistedAppState> {
    const projects = this.readCollection("projects", "id", normalizeProject);
    const threads = this.readCollection("run_threads", "id", normalizeThread);
    return {
      projects,
      threads,
      runThreads: threads as RunThread[],
      threadMessages: this.readCollection(
        "thread_messages",
        "thread_id, created_at",
        normalizeThreadMessage
      ),
      runs: this.readCollection("runs", "id", normalizeRun),
      runResults: this.readCollection(
        "run_results",
        "run_id",
        normalizeRunResult
      ),
      agentActivityItems: this.readCollection(
        "agent_activity_items",
        "run_id, sequence",
        normalizeAgentActivityItem
      ),
      appMetadata: this.readAppMetadata()
    };
  }

  async saveProjects(projects: Project[]): Promise<void> {
    const replaceProjects = this.database.transaction(
      (nextProjects: Project[]) => {
        this.database.prepare("DELETE FROM projects").run();
        const statement = this.database.prepare(
          "INSERT INTO projects (id, payload) VALUES (?, ?)"
        );

        for (const project of nextProjects) {
          statement.run(project.id, JSON.stringify(project));
        }
      }
    );

    replaceProjects(projects);
  }

  async saveAppMetadata(appMetadata: AppMetadata): Promise<void> {
    const normalizedAppMetadata = mergeAppMetadata(
      this.readAppMetadata(),
      appMetadata
    );
    this.database
      .prepare(
        `INSERT INTO app_metadata (key, payload)
         VALUES ('app', ?)
         ON CONFLICT(key) DO UPDATE SET payload = excluded.payload`
      )
      .run(JSON.stringify(normalizedAppMetadata));
  }

  async saveRunThread(runThread: RunThread): Promise<void> {
    this.database
      .prepare(
        `INSERT INTO run_threads (id, project_id, payload)
         VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           project_id = excluded.project_id,
           payload = excluded.payload`
      )
      .run(runThread.id, runThread.projectId ?? "", JSON.stringify(runThread));
  }

  async saveThreadMessage(message: ThreadMessage): Promise<void> {
    this.database
      .prepare(
        `INSERT INTO thread_messages (id, thread_id, created_at, payload)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           thread_id = excluded.thread_id,
           created_at = excluded.created_at,
           payload = excluded.payload`
      )
      .run(
        message.id,
        message.threadId,
        message.createdAt,
        JSON.stringify(message)
      );
  }

  async saveRun(run: Run): Promise<void> {
    this.database
      .prepare(
        `INSERT INTO runs (id, project_id, payload)
         VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           project_id = excluded.project_id,
           payload = excluded.payload`
      )
      .run(run.id, run.projectId, JSON.stringify(run));
  }

  async saveRunResult(runResult: RunResult): Promise<void> {
    const projectId = this.lookupProjectIdForRun(runResult.runId);

    this.database
      .prepare(
        `INSERT INTO run_results (run_id, project_id, payload)
         VALUES (?, ?, ?)
         ON CONFLICT(run_id) DO UPDATE SET
           project_id = excluded.project_id,
           payload = excluded.payload`
      )
      .run(runResult.runId, projectId, JSON.stringify(runResult));
  }

  async saveAgentActivityItem(activityItem: AgentActivityItem): Promise<void> {
    const projectId = this.lookupProjectIdForRun(activityItem.runId);

    this.database
      .prepare(
        `INSERT INTO agent_activity_items
           (id, run_id, project_id, sequence, payload)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           run_id = excluded.run_id,
           project_id = excluded.project_id,
           sequence = excluded.sequence,
           payload = excluded.payload`
      )
      .run(
        activityItem.id,
        activityItem.runId,
        projectId,
        activityItem.sequence,
        JSON.stringify(activityItem)
      );
  }

  async getRun(runId: string): Promise<Run | null> {
    return this.readOne("runs", "id", runId, normalizeRun);
  }

  async deleteThreadData(threadId: string): Promise<void> {
    const deleteScopedData = this.database.transaction(
      (targetThreadId: string) => {
        this.database
          .prepare("DELETE FROM thread_messages WHERE thread_id = ?")
          .run(targetThreadId);
        this.database
          .prepare("DELETE FROM run_threads WHERE id = ?")
          .run(targetThreadId);

        const relatedRunIds = (
          this.database
            .prepare(
              `SELECT id
               FROM runs
               WHERE json_extract(payload, '$.threadId') = ?
                  OR json_extract(payload, '$.runThreadId') = ?`
            )
            .all(targetThreadId, targetThreadId) as RunIdRow[]
        ).map((row) => row.id);

        if (relatedRunIds.length === 0) {
          return;
        }

        const deleteByRunId = this.database.prepare(
          "DELETE FROM runs WHERE id = ?"
        );
        const deleteRunResult = this.database.prepare(
          "DELETE FROM run_results WHERE run_id = ?"
        );
        const deleteActivityItems = this.database.prepare(
          "DELETE FROM agent_activity_items WHERE run_id = ?"
        );

        for (const runId of relatedRunIds) {
          deleteByRunId.run(runId);
          deleteRunResult.run(runId);
          deleteActivityItems.run(runId);
        }
      }
    );

    deleteScopedData(threadId);
  }

  async deleteProjectData(projectId: string): Promise<void> {
    const deleteScopedData = this.database.transaction((targetId: string) => {
      this.database.prepare("DELETE FROM projects WHERE id = ?").run(targetId);
      this.database
        .prepare("DELETE FROM run_threads WHERE project_id = ?")
        .run(targetId);
      this.database
        .prepare("DELETE FROM runs WHERE project_id = ?")
        .run(targetId);
      this.database
        .prepare("DELETE FROM run_results WHERE project_id = ?")
        .run(targetId);
      this.database
        .prepare("DELETE FROM agent_activity_items WHERE project_id = ?")
        .run(targetId);

      const appMetadata = this.readAppMetadata();
      if (appMetadata.selectedProjectId === targetId) {
        this.database
          .prepare(
            `INSERT INTO app_metadata (key, payload)
             VALUES ('app', ?)
             ON CONFLICT(key) DO UPDATE SET payload = excluded.payload`
          )
          .run(
            JSON.stringify({
              ...appMetadata,
              selectedProjectId: null
            })
          );
      }
    });

    deleteScopedData(projectId);
  }

  close(): void {
    this.database.close();
  }

  private initialize(): void {
    // This migration intentionally promotes the on-disk schema to project names.
    // Legacy JSON payload fields remain readable through the normalization readers
    // below so already persisted data survives the schema transition.
    this.migrateLegacySchema();
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS run_threads (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        payload TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS thread_messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        payload TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS run_results (
        run_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        payload TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agent_activity_items (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        payload TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY,
        payload TEXT NOT NULL
      );
    `);
  }

  private migrateLegacySchema(): void {
    if (this.tableExists("folder_systems") && !this.tableExists("projects")) {
      this.database.exec("ALTER TABLE folder_systems RENAME TO projects;");
    }

    for (const tableName of [
      "run_threads",
      "runs",
      "run_results",
      "agent_activity_items"
    ]) {
      if (
        this.tableExists(tableName) &&
        this.columnExists(tableName, "folder_system_id") &&
        !this.columnExists(tableName, "project_id")
      ) {
        this.database.exec(
          `ALTER TABLE ${tableName} RENAME COLUMN folder_system_id TO project_id;`
        );
      }
    }
  }

  private tableExists(tableName: string): boolean {
    const row = this.database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?"
      )
      .get(tableName) as { name: string } | undefined;

    return Boolean(row);
  }

  private columnExists(tableName: string, columnName: string): boolean {
    const rows = this.database
      .prepare(`PRAGMA table_info(${tableName})`)
      .all() as Array<{ name: string }>;

    return rows.some((row) => row.name === columnName);
  }

  private lookupProjectIdForRun(runId: string): string {
    const row = this.database
      .prepare("SELECT project_id FROM runs WHERE id = ?")
      .get(runId) as ProjectIdRow | undefined;

    if (!row) {
      throw new Error(
        `Cannot persist related record for unknown run: ${runId}`
      );
    }

    return row.project_id;
  }

  private readAppMetadata(): AppMetadata {
    const row = this.database
      .prepare("SELECT payload FROM app_metadata WHERE key = 'app'")
      .get() as PayloadRow | undefined;

    if (!row) {
      return { ...DEFAULT_APP_METADATA };
    }

    return normalizeAppMetadata(
      this.parsePayload<
        Partial<AppMetadata> & {
          selectedFolderSystemId?: string | null;
        }
      >(row.payload)
    );
  }

  private readCollection<T>(
    tableName: string,
    orderColumn: string,
    normalize: (payload: string) => T
  ): T[] {
    const rows = this.database
      .prepare(`SELECT payload FROM ${tableName} ORDER BY ${orderColumn}`)
      .all() as PayloadRow[];

    return rows.map((row) => normalize(row.payload));
  }

  private readOne<T>(
    tableName: string,
    keyColumn: string,
    value: string,
    normalize: (payload: string) => T
  ): T | null {
    const row = this.database
      .prepare(`SELECT payload FROM ${tableName} WHERE ${keyColumn} = ?`)
      .get(value) as PayloadRow | undefined;

    return row ? normalize(row.payload) : null;
  }

  private parsePayload<T>(payload: string): T {
    return JSON.parse(payload) as T;
  }
}

function normalizeAppMetadata(
  appMetadata: Partial<AppMetadata> & {
    selectedFolderSystemId?: string | null;
  }
): AppMetadata {
  const normalized: AppMetadata = {
    selectedProjectId:
      appMetadata.selectedProjectId ??
      appMetadata.selectedFolderSystemId ??
      null
  };

  if (appMetadata.notesState !== undefined) {
    normalized.notesState = normalizeNotesState(appMetadata.notesState);
  }

  return normalized;
}

function mergeAppMetadata(
  current: AppMetadata,
  incoming: AppMetadata
): AppMetadata {
  const mergedNotesState =
    incoming.notesState === undefined
      ? current.notesState
      : incoming.notesState;

  return normalizeAppMetadata({
    ...current,
    ...incoming,
    ...(mergedNotesState === undefined ? {} : { notesState: mergedNotesState })
  });
}

function normalizeNotesState(
  state: AppMetadata["notesState"]
): Exclude<AppMetadata["notesState"], undefined> {
  if (!state) {
    return null;
  }

  return {
    activeNoteId: state.activeNoteId ?? null,
    expandedFolders: { ...state.expandedFolders },
    notebookRoot: state.notebookRoot ?? null
  };
}

function normalizeProject(payload: string): Project {
  const project = JSON.parse(payload) as Project;

  return {
    displayName: project.displayName,
    id: project.id,
    roleAssignments: project.roleAssignments,
    rootPath: project.rootPath
  };
}

function normalizeThreadMessage(payload: string): ThreadMessage {
  const message = JSON.parse(payload) as ThreadMessage;

  return {
    content: message.content,
    createdAt: message.createdAt,
    id: message.id,
    role: message.role,
    threadId: message.threadId
  };
}

function normalizeRunResult(payload: string): RunResult {
  const runResult = JSON.parse(payload) as RunResult;

  return {
    artifactPaths: runResult.artifactPaths,
    content: runResult.content,
    failureMessage: runResult.failureMessage,
    runId: runResult.runId,
    status: runResult.status
  };
}

function normalizeAgentActivityItem(payload: string): AgentActivityItem {
  const activityItem = JSON.parse(payload) as AgentActivityItem;

  return {
    completedAt: activityItem.completedAt,
    id: activityItem.id,
    kind: activityItem.kind,
    ...(activityItem.output ? { output: activityItem.output } : {}),
    pathAssociations: activityItem.pathAssociations,
    runId: activityItem.runId,
    sequence: activityItem.sequence,
    startedAt: activityItem.startedAt,
    status: activityItem.status,
    text: activityItem.text
  };
}

function normalizeThread(payload: string): Thread {
  const thread = JSON.parse(payload) as Thread & {
    folderSystemId?: string | null;
  };

  return {
    createdAt: thread.createdAt,
    id: thread.id,
    kind: thread.kind,
    projectId: thread.projectId ?? thread.folderSystemId ?? null,
    title: thread.title,
    trashedAt: thread.trashedAt
  };
}

function normalizeRun(payload: string): Run {
  const run = JSON.parse(payload) as Run & {
    folderSystemId?: string | null;
    runThreadId?: string;
  };

  return {
    completedAt: run.completedAt,
    id: run.id,
    projectId: run.projectId ?? run.folderSystemId ?? null,
    prompt: run.prompt,
    runNumber: run.runNumber,
    startedAt: run.startedAt,
    status: run.status,
    threadId: run.threadId ?? run.runThreadId ?? ""
  };
}
