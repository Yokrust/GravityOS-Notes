import { contextBridge, ipcRenderer } from "electron";

interface ProjectSummary {
  id: string;
  displayName: string;
  rootPath: string;
  hasRootMap: boolean;
  pathStatus: "ready" | "missing" | "unreadable";
}

interface ProjectState {
  projects: ProjectSummary[];
  selectedProjectId: string | null;
}

type AppearanceColorScheme = "auto" | "light" | "dark";

type ThemeHarmony =
  | "complementary"
  | "splitComplementary"
  | "analogous"
  | "triadic"
  | "floating";

interface AppearancePreferences {
  harmony: ThemeHarmony;
  opacity: number;
  points: Array<{ x: number; y: number }>;
  rotation: number;
  scheme: AppearanceColorScheme;
  texture: number;
  version: 1;
}

interface AuthProviderState {
  displayName: string;
  providerId: string;
  status: {
    configured: boolean;
    label?: string;
    source?:
      | "stored"
      | "runtime"
      | "environment"
      | "fallback"
      | "models_json_key"
      | "models_json_command";
  };
  supportsApiKey: boolean;
  supportsOAuth: boolean;
}

interface AuthFlowPromptState {
  allowEmpty?: boolean;
  kind: "text" | "manual_code";
  message: string;
  placeholder?: string;
}

interface AuthFlowState {
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

interface AuthStateRecord {
  activeFlow: AuthFlowState | null;
  providers: AuthProviderState[];
}

interface MapDocumentDraft {
  actionLabel: string;
  content: string;
  documentPath: string;
  isEditingLocked: boolean;
  isRoot: boolean;
  targetFolderPath: string;
}

interface NoteTreeNode {
  id: string;
  name: string;
  path: string;
  type: "folder" | "note";
  children?: NoteTreeNode[];
  updatedAt?: number;
}

interface NotesStateRecord {
  activeNote: {
    content: string;
    id: string;
    name: string;
    path: string;
    updatedAt: number;
  } | null;
  activeNoteId: string | null;
  expandedFolders: Record<string, boolean>;
  notebookName: string | null;
  notebookRoot: string | null;
  pathStatus: "ready" | "missing" | "unreadable" | null;
  tree: NoteTreeNode[];
}

interface NotesNavigationState {
  activeNoteId: string | null;
  expandedFolders: Record<string, boolean>;
}

type SatelliteValueType =
  | "shortText"
  | "longText"
  | "number"
  | "date"
  | "singleSelect"
  | "multiSelect"
  | "checkbox"
  | "progress"
  | "image";

type SatelliteValue =
  | string
  | number
  | boolean
  | string[]
  | { imageId: string };

interface CustomSatellitePropertyProposal {
  key: string;
  label: string;
  valueType: SatelliteValueType;
  required: boolean;
  options?: string[];
  defaultValue?: SatelliteValue;
}

interface CustomSatelliteProposal {
  name: string;
  description?: string;
  icon:
    | "sparkles"
    | "list-checks"
    | "user-round"
    | "briefcase"
    | "book-open"
    | "shirt"
    | "heart"
    | "star"
    | "calendar-days"
    | "image";
  color: "slate" | "amber" | "rose" | "sky" | "emerald" | "violet";
  appearance: "card";
  properties: CustomSatellitePropertyProposal[];
}

interface CustomSatelliteTypeRecord extends CustomSatelliteProposal {
  id: string;
  properties: Array<CustomSatellitePropertyProposal & { id: string }>;
  createdAt: string;
  updatedAt: string;
}

interface CustomSatelliteInstanceRecord {
  id: string;
  customTypeId: string;
  data: Record<string, SatelliteValue>;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  createdAt: string;
  updatedAt: string;
}

interface CustomSatelliteStateRecord {
  customTypes: CustomSatelliteTypeRecord[];
  instances: CustomSatelliteInstanceRecord[];
}

interface RunRecord {
  agentActivityItems: AgentActivityItem[];
  activityRows: RunActivityRow[];
  run: {
    completedAt: string | null;
    projectId: string;
    id: string;
    prompt: string;
    runNumber: number;
    runThreadId: string;
    startedAt: string;
    status: "pending" | "in_progress" | "completed" | "failed" | "stopped";
  };
  runResult: {
    artifactPaths: string[];
    content: string;
    failureMessage: string | null;
    runId: string;
    status: "pending" | "partial" | "completed" | "failed" | "stopped";
  };
}

interface AgentActivityPathAssociation {
  confidence: "high" | "medium" | "low";
  path: string;
}

interface AgentActivityOutput {
  head: string;
  tail: string;
  truncatedByteCount: number;
  truncatedLineCount: number;
}

interface AgentActivityItem {
  completedAt: string | null;
  id: string;
  kind: "prompt" | "message" | "reasoning" | "tool" | "command";
  output?: AgentActivityOutput;
  pathAssociations: AgentActivityPathAssociation[];
  runId: string;
  sequence: number;
  startedAt: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "stopped";
  text: string;
}

interface RunActivityPathLink {
  confidence: "high" | "medium" | "low";
  label: string;
  path: string;
  reason?: string;
  status: "ready" | "missing" | "unavailable";
}

interface RunActivityOutputPreview {
  head: string;
  tail: string;
  truncatedByteCount: number;
  truncatedLineCount: number;
  wasTruncated: boolean;
}

interface RunActivityRow {
  completedAt: string | null;
  id: string;
  isCollapsed: boolean;
  kind: AgentActivityItem["kind"];
  outputPreview: RunActivityOutputPreview | null;
  pathLinks: RunActivityPathLink[];
  sequence: number;
  startedAt: string;
  status: AgentActivityItem["status"];
  text: string;
}

interface RunThreadRecord {
  latestRun: RunRecord | null;
  runThread: {
    createdAt: string;
    projectId: string | null;
    id: string;
    kind: "chat" | "conversation" | "project";
    title: string;
    trashedAt: string | null;
  };
  runs: RunRecord[];
}

interface ThreadMessage {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface ThreadRecord {
  latestMessage: ThreadMessage | null;
  messages: ThreadMessage[];
  runThread: RunThreadRecord["runThread"];
  runs: RunRecord[];
}

interface ThreadPanelState {
  activeThreadId: string | null;
  threads: ThreadRecord[];
  trashedThreads: TrashedThreadRecord[];
}

interface TrashedThreadRecord {
  latestMessage: ThreadMessage | null;
  latestRun: RunRecord | null;
  restorableUntil: string;
  runThread: RunThreadRecord["runThread"];
  trashedAt: string;
}

interface RunPanelState {
  activeRunId: string | null;
  projectId: string;
  runThreads: RunThreadRecord[];
}

type AppWorkspaceActiveThread =
  | {
      kind: "chat";
      record: ThreadRecord;
    }
  | {
      kind: "project";
      projectId: string;
      record: RunThreadRecord;
    };

interface WorkspaceThreadExecutionStatus {
  currentTurnId: string | null;
  status:
    | "idle"
    | "pending"
    | "in_progress"
    | "completed"
    | "failed"
    | "stopped";
  threadId: string;
}

interface WorkspaceTurnExecutionStatus {
  kind: "chat" | "project";
  status: "pending" | "in_progress" | "completed" | "failed" | "stopped";
  threadId: string;
  turnId: string;
}

interface AppWorkspaceHydrateInput {
  openThreadId?: string | null;
  selectedProjectId?: string | null;
}

interface AppWorkspaceState {
  projects: ProjectState;
  chatThreads: ThreadPanelState;
  projectThreadsByProjectId: Record<string, RunThreadRecord[]>;
  selectedProjectId: string | null;
  activeThread: AppWorkspaceActiveThread | null;
  threadExecutionStatusByThreadId: Record<
    string,
    WorkspaceThreadExecutionStatus
  >;
  turnExecutionStatusByTurnId: Record<string, WorkspaceTurnExecutionStatus>;
}

type AppWorkspaceCommand =
  | { type: "selectProject"; projectId: string }
  | { type: "openThread"; threadId: string }
  | { type: "createProjectThread"; projectId: string }
  | { type: "upgradeChatThreadToProject"; threadId: string; projectId: string }
  | { type: "trashThread"; threadId: string }
  | { type: "restoreThread"; threadId: string }
  | { type: "emptyTrash" }
  | { type: "refresh" };

contextBridge.exposeInMainWorld("gravity", {
  getBootstrapStatus: async () =>
    ipcRenderer.invoke("app:get-bootstrap-status") as Promise<{
      appName: string;
      packageCount: number;
    }>,
  getAppearancePreferences: async () =>
    ipcRenderer.invoke(
      "appearance:get-preferences"
    ) as Promise<AppearancePreferences>,
  saveAppearancePreferences: async (preferences: AppearancePreferences) =>
    ipcRenderer.invoke(
      "appearance:save-preferences",
      preferences
    ) as Promise<AppearancePreferences>,
  getProjectState: async () =>
    ipcRenderer.invoke("projects:get-state") as Promise<ProjectState>,
  registerProject: async (rootPath: string) =>
    ipcRenderer.invoke("projects:register", rootPath) as Promise<ProjectState>,
  createProject: async (rootPath: string) =>
    ipcRenderer.invoke("projects:create", rootPath) as Promise<ProjectState>,
  chooseProjectDirectory: async () =>
    ipcRenderer.invoke("projects:choose-directory") as Promise<string | null>,
  reattachProject: async (projectId: string, rootPath: string) =>
    ipcRenderer.invoke(
      "projects:reattach",
      projectId,
      rootPath
    ) as Promise<ProjectState>,
  renameProject: async (projectId: string, displayName: string) =>
    ipcRenderer.invoke(
      "projects:rename",
      projectId,
      displayName
    ) as Promise<ProjectState>,
  selectProject: async (projectId: string) =>
    ipcRenderer.invoke("projects:select", projectId) as Promise<ProjectState>,
  removeProject: async (projectId: string) =>
    ipcRenderer.invoke("projects:remove", projectId) as Promise<ProjectState>,
  createDemoProject: async () =>
    ipcRenderer.invoke("projects:create-demo") as Promise<ProjectState>,
  getNotesState: async () =>
    ipcRenderer.invoke("notes:get-state") as Promise<NotesStateRecord>,
  chooseNotebookDirectory: async () =>
    ipcRenderer.invoke("notes:choose-directory") as Promise<string | null>,
  attachNotebook: async (notebookRoot: string) =>
    ipcRenderer.invoke(
      "notes:attach",
      notebookRoot
    ) as Promise<NotesStateRecord>,
  refreshNotebook: async () =>
    ipcRenderer.invoke("notes:refresh") as Promise<NotesStateRecord>,
  selectNotebookNote: async (notePath: string) =>
    ipcRenderer.invoke("notes:select", notePath) as Promise<NotesStateRecord>,
  saveNotesNavigation: async (state: NotesNavigationState) =>
    ipcRenderer.invoke("notes:save-navigation", state) as Promise<
      NotesNavigationState & { notebookRoot: string | null }
    >,
  saveNotebookNote: async (notePath: string, content: string) =>
    ipcRenderer.invoke("notes:save-content", notePath, content) as Promise<{
      content: string;
      id: string;
      name: string;
      path: string;
      updatedAt: number;
    }>,
  createNotebookNote: async (parentPath?: string) =>
    ipcRenderer.invoke(
      "notes:create-note",
      parentPath
    ) as Promise<NotesStateRecord>,
  createNotebookFolder: async (parentPath?: string) =>
    ipcRenderer.invoke(
      "notes:create-folder",
      parentPath
    ) as Promise<NotesStateRecord>,
  renameNotebookNode: async (nodePath: string, nextName: string) =>
    ipcRenderer.invoke(
      "notes:rename",
      nodePath,
      nextName
    ) as Promise<NotesStateRecord>,
  deleteNotebookNode: async (nodePath: string) =>
    ipcRenderer.invoke("notes:delete", nodePath) as Promise<NotesStateRecord>,
  getCustomSatelliteState: async () =>
    ipcRenderer.invoke(
      "custom-satellites:get-state"
    ) as Promise<CustomSatelliteStateRecord>,
  generateCustomSatellite: async (description: string) =>
    ipcRenderer.invoke(
      "custom-satellites:generate",
      description
    ) as Promise<CustomSatelliteProposal>,
  confirmCustomSatellite: async (proposal: CustomSatelliteProposal) =>
    ipcRenderer.invoke(
      "custom-satellites:confirm",
      proposal
    ) as Promise<CustomSatelliteStateRecord>,
  createCustomSatelliteInstance: async (input: {
    customTypeId: string;
    x?: number;
    y?: number;
    z?: number;
  }) =>
    ipcRenderer.invoke(
      "custom-satellites:create-instance",
      input
    ) as Promise<CustomSatelliteStateRecord>,
  updateCustomSatelliteValue: async (input: {
    instanceId: string;
    key: string;
    value: SatelliteValue;
  }) =>
    ipcRenderer.invoke(
      "custom-satellites:update-value",
      input
    ) as Promise<CustomSatelliteStateRecord>,
  updateCustomSatelliteFrame: async (input: {
    instanceId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    z: number;
  }) =>
    ipcRenderer.invoke(
      "custom-satellites:update-frame",
      input
    ) as Promise<CustomSatelliteStateRecord>,
  closeCustomSatelliteInstance: async (instanceId: string) =>
    ipcRenderer.invoke(
      "custom-satellites:close-instance",
      instanceId
    ) as Promise<CustomSatelliteStateRecord>,
  loadMapDraft: async (
    projectId: string,
    rootPath: string,
    targetFolderPath?: string
  ) =>
    ipcRenderer.invoke(
      "maps:load-draft",
      projectId,
      rootPath,
      targetFolderPath
    ) as Promise<MapDocumentDraft>,
  saveMapDraft: async (
    projectId: string,
    rootPath: string,
    content: string,
    targetFolderPath?: string
  ) =>
    ipcRenderer.invoke(
      "maps:save-draft",
      projectId,
      rootPath,
      content,
      targetFolderPath
    ) as Promise<MapDocumentDraft>,
  getAuthState: async () =>
    ipcRenderer.invoke("auth:get-state") as Promise<AuthStateRecord>,
  saveProviderApiKey: async (providerId: string, apiKey: string) =>
    ipcRenderer.invoke(
      "auth:set-api-key",
      providerId,
      apiKey
    ) as Promise<AuthStateRecord>,
  beginProviderOAuthLogin: async (providerId: string) =>
    ipcRenderer.invoke(
      "auth:begin-oauth-login",
      providerId
    ) as Promise<AuthStateRecord>,
  submitProviderOAuthInput: async (flowId: string, value: string) =>
    ipcRenderer.invoke(
      "auth:submit-oauth-input",
      flowId,
      value
    ) as Promise<AuthStateRecord>,
  logoutProvider: async (providerId: string) =>
    ipcRenderer.invoke("auth:logout", providerId) as Promise<AuthStateRecord>,
  getThreadPanelState: async (activeThreadId?: string | null) =>
    ipcRenderer.invoke(
      "threads:get-state",
      activeThreadId
    ) as Promise<ThreadPanelState>,
  hydrateWorkspace: async (input?: AppWorkspaceHydrateInput) =>
    ipcRenderer.invoke(
      "workspace:hydrate",
      input
    ) as Promise<AppWorkspaceState>,
  executeWorkspaceCommand: async (command: AppWorkspaceCommand) =>
    ipcRenderer.invoke(
      "workspace:execute",
      command
    ) as Promise<AppWorkspaceState>,
  createConversationThread: async () =>
    ipcRenderer.invoke(
      "threads:create-conversation"
    ) as Promise<ThreadPanelState>,
  trashThread: async (threadId: string) =>
    ipcRenderer.invoke("threads:trash", threadId) as Promise<ThreadPanelState>,
  renameThread: async (threadId: string, title: string) =>
    ipcRenderer.invoke(
      "threads:rename",
      threadId,
      title
    ) as Promise<ThreadPanelState>,
  restoreThread: async (threadId: string) =>
    ipcRenderer.invoke(
      "threads:restore",
      threadId
    ) as Promise<ThreadPanelState>,
  emptyTrash: async () =>
    ipcRenderer.invoke("threads:empty-trash") as Promise<ThreadPanelState>,
  sendThreadMessage: async (threadId: string, content: string) =>
    ipcRenderer.invoke(
      "threads:send-message",
      threadId,
      content
    ) as Promise<ThreadPanelState>,
  getRunPanelState: async (projectId: string) =>
    ipcRenderer.invoke(
      "runs:get-panel-state",
      projectId
    ) as Promise<RunPanelState>,
  createRunThread: async (projectId: string) =>
    ipcRenderer.invoke(
      "runs:create-thread",
      projectId
    ) as Promise<RunPanelState>,
  upgradeChatThreadToProject: async (threadId: string, projectId: string) =>
    ipcRenderer.invoke(
      "runs:upgrade-chat-thread",
      threadId,
      projectId
    ) as Promise<RunPanelState>,
  renameRunThread: async (
    projectId: string,
    runThreadId: string,
    title: string
  ) =>
    ipcRenderer.invoke(
      "runs:rename-thread",
      projectId,
      runThreadId,
      title
    ) as Promise<RunPanelState>,
  startRun: async (projectId: string, runThreadId: string, prompt: string) =>
    ipcRenderer.invoke(
      "runs:start",
      projectId,
      runThreadId,
      prompt
    ) as Promise<RunPanelState>,
  stopRun: async (projectId: string, runId: string) =>
    ipcRenderer.invoke("runs:stop", projectId, runId) as Promise<RunPanelState>,
  onThreadUpdate: (listener: (payload: ThreadPanelState) => void) => {
    const wrapped = (
      _event: Electron.IpcRendererEvent,
      payload: ThreadPanelState
    ) => listener(payload);
    ipcRenderer.on("threads:update", wrapped);
    return () => {
      ipcRenderer.removeListener("threads:update", wrapped);
    };
  }
});
