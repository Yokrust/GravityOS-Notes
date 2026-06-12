import type {
  AgentActivityItem,
  CustomSatelliteInstance,
  CustomSatelliteProposal,
  CustomSatelliteType,
  Project,
  Run,
  RunResult,
  SatelliteValue,
  Thread,
  RunThread,
  ThreadMessage
} from "@gravity/domain";

export interface DirectoryEntry {
  path: string;
  type: "file" | "directory" | "other";
}

export type ProjectPathStatus = "ready" | "missing" | "unreadable";

export interface PathDetails {
  kind: "file" | "directory" | null;
  modifiedAt?: number;
  status: ProjectPathStatus;
}

export interface FilesystemPort {
  baseName(path: string): string;
  deletePath(path: string, options?: { recursive?: boolean }): Promise<void>;
  directoryName(path: string): string;
  hasFile(path: string): Promise<boolean>;
  isPathInside(rootPath: string, targetPath: string): boolean;
  listDirectory(path: string): Promise<DirectoryEntry[]>;
  inspectPath(path: string): Promise<PathDetails>;
  movePath(sourcePath: string, destinationPath: string): Promise<void>;
  readFile(path: string): Promise<string>;
  relativePath(fromPath: string, toPath: string): string;
  resolvePath(path: string, ...segments: string[]): string;
  createDirectory(path: string): Promise<void>;
  writeFile(path: string, content: string): Promise<void>;
}

export interface PersistencePort {
  loadState(): Promise<PersistedAppState>;
  saveProjects(projects: Project[]): Promise<void>;
  saveAppMetadata(appMetadata: AppMetadata): Promise<void>;
  saveRunThread(runThread: RunThread): Promise<void>;
  saveThreadMessage(message: ThreadMessage): Promise<void>;
  saveRun(run: Run): Promise<void>;
  saveRunResult(runResult: RunResult): Promise<void>;
  saveAgentActivityItem(activityItem: AgentActivityItem): Promise<void>;
  saveCustomSatelliteType(customType: CustomSatelliteType): Promise<void>;
  saveCustomSatelliteInstance(instance: CustomSatelliteInstance): Promise<void>;
  deleteCustomSatelliteInstance(instanceId: string): Promise<void>;
  getRun(runId: string): Promise<Run | null>;
  deleteThreadData(threadId: string): Promise<void>;
  deleteProjectData(projectId: string): Promise<void>;
}

export interface CustomSatelliteState {
  customTypes: CustomSatelliteType[];
  instances: CustomSatelliteInstance[];
}

export interface CustomSatelliteGeneratorPort {
  generate(description: string): Promise<CustomSatelliteProposal>;
}

export type CustomSatelliteValueInput = SatelliteValue;

export type AppearanceScheme = "auto" | "light" | "dark";

export type AppearanceHarmony =
  | "complementary"
  | "singleAnalogous"
  | "splitComplementary"
  | "analogous"
  | "triadic"
  | "floating";

export interface AppearanceGradientPoint {
  x: number;
  y: number;
}

export interface AppearancePreferences {
  harmony: AppearanceHarmony;
  opacity: number;
  points: AppearanceGradientPoint[];
  rotation: number;
  scheme: AppearanceScheme;
  texture: number;
  version: 1;
}

export interface PersistedNotesState {
  notebookRoot: string | null;
  activeNoteId: string | null;
  expandedFolders: Record<string, boolean>;
}

export interface NoteTreeNode {
  id: string;
  name: string;
  path: string;
  type: "folder" | "note";
  children?: NoteTreeNode[];
  updatedAt?: number;
}

export interface NoteDocument {
  content: string;
  id: string;
  name: string;
  path: string;
  updatedAt: number;
}

export interface NotesState extends PersistedNotesState {
  activeNote: NoteDocument | null;
  notebookName: string | null;
  pathStatus: ProjectPathStatus | null;
  tree: NoteTreeNode[];
}

export interface NotesNavigationState {
  activeNoteId: string | null;
  expandedFolders: Record<string, boolean>;
}

export interface AppMetadata {
  selectedProjectId: string | null;
  notesState?: PersistedNotesState | null;
  appearancePreferences?: AppearancePreferences | null;
}

export interface PersistedAppState {
  projects: Project[];
  threads: Thread[];
  runThreads: RunThread[];
  threadMessages: ThreadMessage[];
  runs: Run[];
  runResults: RunResult[];
  agentActivityItems: AgentActivityItem[];
  customSatelliteTypes: CustomSatelliteType[];
  customSatelliteInstances: CustomSatelliteInstance[];
  appMetadata: AppMetadata;
}

export interface ClockPort {
  now(): string;
}

export interface IdGeneratorPort {
  next(prefix: string): string;
}

export type AuthStatusSource =
  | "stored"
  | "runtime"
  | "environment"
  | "fallback"
  | "models_json_key"
  | "models_json_command";

export interface AuthProviderState {
  displayName: string;
  providerId: string;
  status: {
    configured: boolean;
    label?: string;
    source?: AuthStatusSource;
  };
  supportsApiKey: boolean;
  supportsOAuth: boolean;
}

export interface AuthFlowPromptState {
  allowEmpty?: boolean;
  kind: "text" | "manual_code";
  message: string;
  placeholder?: string;
}

export interface AuthFlowState {
  authUrl?: string;
  errorMessage?: string;
  flowId: string;
  instructions?: string;
  progressMessage?: string;
  prompt: AuthFlowPromptState | null;
  providerId: string;
  providerName: string;
  status: "in_progress" | "awaiting_input" | "failed";
}

export interface AuthState {
  activeFlow: AuthFlowState | null;
  providers: AuthProviderState[];
}

export interface AuthPort {
  beginOAuthLogin(providerId: string): Promise<AuthState>;
  getState(): Promise<AuthState>;
  logout(providerId: string): Promise<AuthState>;
  setApiKey(input: { apiKey: string; providerId: string }): Promise<AuthState>;
  submitOAuthInput(input: {
    flowId: string;
    value: string;
  }): Promise<AuthState>;
}

export interface RuntimePort {
  startRun(run: Run): Promise<{ actorId: string; runtimeRunId: string }>;
  stopRun(runtimeRunId: string): Promise<void>;
  stopRunByRunId(runId: string): Promise<{
    artifactPaths: string[];
    content: string;
    runtimeRunId: string;
  }>;
}

export interface ThreadRuntimePort {
  startThreadTurn(input: {
    onComplete?: (content: string) => Promise<void>;
    onDelta: (delta: string) => Promise<void>;
    onError?: (message: string) => Promise<void>;
    prompt: string;
    projectId: string | null;
    threadId: string;
  }): Promise<{ streamId: string }>;
}

export interface ProjectOverview {
  project: Project;
  hasRootMap: boolean;
  pathStatus: ProjectPathStatus;
}

export interface ProjectState {
  projects: ProjectOverview[];
  selectedProjectId: string | null;
}
