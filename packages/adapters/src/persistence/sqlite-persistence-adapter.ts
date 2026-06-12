import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

import type {
  AppMetadata,
  AppMetadataUpdate,
  CustomSatelliteFrameUpdate,
  CustomSatelliteImageAsset,
  CustomSatelliteImageInput,
  CustomSatelliteVisibilityUpdate,
  CustomSatelliteValueUpdate,
  PersistedAppState,
  PersistencePort
} from "@gravity/application";
import { normalizeAppearancePreferences } from "@gravity/application";
import type {
  AgentActivityItem,
  CustomSatelliteInstance,
  CustomSatelliteType,
  Project,
  Run,
  RunResult,
  RunThread,
  SatelliteValue,
  Thread,
  ThreadMessage
} from "@gravity/domain";

type SqliteDatabase = InstanceType<typeof Database>;
type PayloadRow = { payload: string };
type ProjectIdRow = { project_id: string };
type RunIdRow = { id: string };
type ImageAssetRow = { bytes: Buffer; mime_type: string };

const MAX_CUSTOM_SATELLITE_IMAGE_BYTES = 5 * 1024 * 1024;
const CUSTOM_SATELLITE_IMAGE_SIGNATURES = {
  "image/gif": [Buffer.from("GIF87a"), Buffer.from("GIF89a")],
  "image/jpeg": [Buffer.from([0xff, 0xd8, 0xff])],
  "image/png": [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  "image/webp": [Buffer.from("RIFF")]
} as const;

const DEFAULT_APP_METADATA: AppMetadata = {
  selectedProjectId: null
};

export class SqlitePersistenceAdapter implements PersistencePort {
  private readonly database: SqliteDatabase;

  constructor(readonly databasePath: string) {
    this.database = new Database(databasePath);
    this.database.pragma("journal_mode = WAL");
    this.initialize();
    this.migrateEmbeddedCustomSatelliteImages();
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
      customSatelliteTypes: this.readCollection(
        "custom_satellite_types",
        "created_at, id",
        normalizeCustomSatelliteType
      ),
      customSatelliteInstances: this.readCollection(
        "custom_satellite_instances",
        "created_at, id",
        normalizeCustomSatelliteInstance
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

  async updateAppMetadata(update: AppMetadataUpdate): Promise<void> {
    const updateMetadata = this.database.transaction(
      (metadataUpdate: AppMetadataUpdate) => {
        const normalizedAppMetadata = mergeAppMetadata(
          this.readAppMetadata(),
          metadataUpdate
        );
        this.database
          .prepare(
            `INSERT INTO app_metadata (key, payload)
             VALUES ('app', ?)
             ON CONFLICT(key) DO UPDATE SET payload = excluded.payload`
          )
          .run(JSON.stringify(normalizedAppMetadata));
      }
    );

    updateMetadata(update);
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

  async saveCustomSatelliteType(
    customType: CustomSatelliteType
  ): Promise<void> {
    this.database
      .prepare(
        `INSERT INTO custom_satellite_types (id, created_at, payload)
         VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           created_at = excluded.created_at,
           payload = excluded.payload`
      )
      .run(customType.id, customType.createdAt, JSON.stringify(customType));
  }

  async saveCustomSatelliteInstance(
    instance: CustomSatelliteInstance
  ): Promise<void> {
    this.database
      .prepare(
        `INSERT INTO custom_satellite_instances
           (id, custom_type_id, created_at, payload)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           custom_type_id = excluded.custom_type_id,
           created_at = excluded.created_at,
           payload = excluded.payload`
      )
      .run(
        instance.id,
        instance.customTypeId,
        instance.createdAt,
        JSON.stringify(instance)
      );
  }

  async updateCustomSatelliteInstanceValue(
    update: CustomSatelliteValueUpdate
  ): Promise<void> {
    this.patchCustomSatelliteInstance(
      update.instanceId,
      (instance) => ({
        ...instance,
        data: {
          ...instance.data,
          [update.key]: update.value
        },
        updatedAt: latestTimestamp(instance.updatedAt, update.updatedAt)
      }),
      { cleanupReplacedImages: true }
    );
  }

  async updateCustomSatelliteInstanceFrame(
    update: CustomSatelliteFrameUpdate
  ): Promise<void> {
    this.patchCustomSatelliteInstance(update.instanceId, (instance) => ({
      ...instance,
      ...(update.height === undefined ? {} : { height: update.height }),
      updatedAt: latestTimestamp(instance.updatedAt, update.updatedAt),
      ...(update.width === undefined ? {} : { width: update.width }),
      ...(update.x === undefined ? {} : { x: update.x }),
      ...(update.y === undefined ? {} : { y: update.y }),
      ...(update.z === undefined ? {} : { z: update.z })
    }));
  }

  async updateCustomSatelliteInstanceVisibility(
    update: CustomSatelliteVisibilityUpdate
  ): Promise<void> {
    this.patchCustomSatelliteInstance(update.instanceId, (instance) => ({
      ...instance,
      isOpen: update.isOpen,
      updatedAt: latestTimestamp(instance.updatedAt, update.updatedAt)
    }));
  }

  async saveCustomSatelliteImageValue(
    input: CustomSatelliteImageInput
  ): Promise<void> {
    const bytes = validateCustomSatelliteImage(input.bytes, input.mimeType);
    const saveImage = this.database.transaction(
      (imageInput: CustomSatelliteImageInput, imageBytes: Buffer) => {
        this.database
          .prepare(
            `INSERT INTO custom_satellite_images
               (id, instance_id, property_key, mime_type, byte_length, bytes)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(
            imageInput.imageId,
            imageInput.instanceId,
            imageInput.key,
            imageInput.mimeType,
            imageBytes.byteLength,
            imageBytes
          );
        this.patchCustomSatelliteInstance(
          imageInput.instanceId,
          (instance) => ({
            ...instance,
            data: {
              ...instance.data,
              [imageInput.key]: { imageId: imageInput.imageId }
            },
            updatedAt: latestTimestamp(instance.updatedAt, imageInput.updatedAt)
          }),
          { cleanupReplacedImages: true }
        );
      }
    );
    saveImage(input, bytes);
  }

  async loadCustomSatelliteImage(
    imageId: string
  ): Promise<CustomSatelliteImageAsset | null> {
    const row = this.database
      .prepare(
        `SELECT mime_type, bytes
         FROM custom_satellite_images
         WHERE id = ?`
      )
      .get(imageId) as ImageAssetRow | undefined;
    return row
      ? { bytes: new Uint8Array(row.bytes), mimeType: row.mime_type }
      : null;
  }

  async deleteCustomSatelliteInstance(instanceId: string): Promise<void> {
    const remove = this.database.transaction((targetId: string) => {
      this.database
        .prepare("DELETE FROM custom_satellite_images WHERE instance_id = ?")
        .run(targetId);
      this.database
        .prepare("DELETE FROM custom_satellite_instances WHERE id = ?")
        .run(targetId);
    });
    remove(instanceId);
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

      CREATE TABLE IF NOT EXISTS custom_satellite_types (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS custom_satellite_instances (
        id TEXT PRIMARY KEY,
        custom_type_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS custom_satellite_images (
        id TEXT PRIMARY KEY,
        instance_id TEXT NOT NULL,
        property_key TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        byte_length INTEGER NOT NULL,
        bytes BLOB NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_custom_satellite_images_instance
      ON custom_satellite_images (instance_id);

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

  private patchCustomSatelliteInstance(
    instanceId: string,
    patch: (instance: CustomSatelliteInstance) => CustomSatelliteInstance,
    options: { cleanupReplacedImages?: boolean } = {}
  ): void {
    const patchInstance = this.database.transaction((targetId: string) => {
      const instance = this.readOne(
        "custom_satellite_instances",
        "id",
        targetId,
        normalizeCustomSatelliteInstance
      );
      if (!instance) {
        throw new Error(`Unknown Satellite Instance: ${targetId}`);
      }

      const updated = patch(instance);
      if (options.cleanupReplacedImages) {
        this.deleteReplacedCustomSatelliteImages(instance, updated);
      }
      this.database
        .prepare(
          `UPDATE custom_satellite_instances
           SET custom_type_id = ?, created_at = ?, payload = ?
           WHERE id = ?`
        )
        .run(
          updated.customTypeId,
          updated.createdAt,
          JSON.stringify(updated),
          targetId
        );
    });

    patchInstance(instanceId);
  }

  private deleteReplacedCustomSatelliteImages(
    previous: CustomSatelliteInstance,
    next: CustomSatelliteInstance
  ): void {
    const nextImageIds = new Set(
      Object.values(next.data)
        .map(imageIdFromValue)
        .filter((imageId): imageId is string => imageId !== null)
    );
    for (const value of Object.values(previous.data)) {
      const imageId = imageIdFromValue(value);
      if (imageId && !nextImageIds.has(imageId)) {
        this.database
          .prepare("DELETE FROM custom_satellite_images WHERE id = ?")
          .run(imageId);
      }
    }
  }

  private migrateEmbeddedCustomSatelliteImages(): void {
    const rows = this.database
      .prepare("SELECT id, payload FROM custom_satellite_instances ORDER BY id")
      .all() as Array<{ id: string; payload: string }>;
    const migrate = this.database.transaction(() => {
      for (const row of rows) {
        const instance = normalizeCustomSatelliteInstance(row.payload);
        let changed = false;
        const data = { ...instance.data };
        for (const [key, value] of Object.entries(data)) {
          const imageId = imageIdFromValue(value);
          if (!imageId?.startsWith("data:")) continue;
          changed = true;
          try {
            const parsed = parseImageDataUrl(imageId);
            const assetId = `custom-satellite-image-${randomUUID()}`;
            this.database
              .prepare(
                `INSERT INTO custom_satellite_images
                   (id, instance_id, property_key, mime_type, byte_length, bytes)
                 VALUES (?, ?, ?, ?, ?, ?)`
              )
              .run(
                assetId,
                instance.id,
                key,
                parsed.mimeType,
                parsed.bytes.byteLength,
                parsed.bytes
              );
            data[key] = { imageId: assetId };
          } catch {
            data[key] = null;
          }
        }
        if (changed) {
          this.database
            .prepare(
              "UPDATE custom_satellite_instances SET payload = ? WHERE id = ?"
            )
            .run(JSON.stringify({ ...instance, data }), row.id);
        }
      }
    });
    migrate();
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

  if (appMetadata.appearancePreferences !== undefined) {
    normalized.appearancePreferences =
      appMetadata.appearancePreferences === null
        ? null
        : normalizeAppearancePreferences(appMetadata.appearancePreferences);
  }

  return normalized;
}

function mergeAppMetadata(
  current: AppMetadata,
  incoming: AppMetadataUpdate
): AppMetadata {
  const mergedSelectedProjectId =
    incoming.selectedProjectId === undefined
      ? current.selectedProjectId
      : incoming.selectedProjectId;
  const mergedNotesState =
    incoming.notesState === undefined
      ? current.notesState
      : incoming.notesState;
  const mergedAppearancePreferences =
    incoming.appearancePreferences === undefined
      ? current.appearancePreferences
      : incoming.appearancePreferences;

  return normalizeAppMetadata({
    ...current,
    ...incoming,
    selectedProjectId: mergedSelectedProjectId,
    ...(mergedNotesState === undefined ? {} : { notesState: mergedNotesState }),
    ...(mergedAppearancePreferences === undefined
      ? {}
      : { appearancePreferences: mergedAppearancePreferences })
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

function normalizeCustomSatelliteType(payload: string): CustomSatelliteType {
  return JSON.parse(payload) as CustomSatelliteType;
}

function normalizeCustomSatelliteInstance(
  payload: string
): CustomSatelliteInstance {
  const instance = JSON.parse(payload) as CustomSatelliteInstance & {
    isOpen?: boolean;
  };
  return {
    ...instance,
    isOpen: instance.isOpen ?? true
  };
}

function imageIdFromValue(value: SatelliteValue): string | null {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "imageId" in value
    ? value.imageId
    : null;
}

function validateCustomSatelliteImage(
  input: Uint8Array,
  mimeType: string
): Buffer {
  if (!(input instanceof Uint8Array)) {
    throw new Error("Satellite image bytes are required.");
  }
  if (
    input.byteLength === 0 ||
    input.byteLength > MAX_CUSTOM_SATELLITE_IMAGE_BYTES
  ) {
    throw new Error("Satellite images must be between 1 byte and 5 MB.");
  }
  if (!(mimeType in CUSTOM_SATELLITE_IMAGE_SIGNATURES)) {
    throw new Error(`Unsupported Satellite image type: ${mimeType}`);
  }

  const bytes = Buffer.from(input);
  const signatures =
    CUSTOM_SATELLITE_IMAGE_SIGNATURES[
      mimeType as keyof typeof CUSTOM_SATELLITE_IMAGE_SIGNATURES
    ];
  const matches = signatures.some((signature) =>
    bytes.subarray(0, signature.length).equals(signature)
  );
  const validWebp =
    mimeType !== "image/webp" ||
    (matches && bytes.subarray(8, 12).equals(Buffer.from("WEBP")));
  if (!matches || !validWebp) {
    throw new Error("Satellite image contents do not match the declared type.");
  }
  return bytes;
}

function parseImageDataUrl(value: string): {
  bytes: Buffer;
  mimeType: string;
} {
  const match = /^data:([^;,]+);base64,([a-z0-9+/=\s]+)$/i.exec(value);
  if (!match?.[1] || !match[2]) {
    throw new Error("Invalid embedded Satellite image.");
  }
  const mimeType = match[1].toLowerCase();
  const bytes = validateCustomSatelliteImage(
    Buffer.from(match[2], "base64"),
    mimeType
  );
  return { bytes, mimeType };
}

function latestTimestamp(current: string, incoming: string): string {
  return current.localeCompare(incoming) >= 0 ? current : incoming;
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
