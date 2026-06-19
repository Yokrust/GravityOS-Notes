interface Window {
  gravity: {
    getBootstrapStatus(): Promise<{
      appName: string;
      packageCount: number;
    }>;
    getProjectState(): Promise<ProjectState>;
    registerProject(rootPath: string): Promise<ProjectState>;
    createProject(rootPath: string): Promise<ProjectState>;
    chooseProjectDirectory(): Promise<string | null>;
    reattachProject(projectId: string, rootPath: string): Promise<ProjectState>;
    renameProject(
      projectId: string,
      displayName: string
    ): Promise<ProjectState>;
    selectProject(projectId: string): Promise<ProjectState>;
    removeProject(projectId: string): Promise<ProjectState>;
    createDemoProject(): Promise<ProjectState>;
    getNotesState(): Promise<NotesStateRecord>;
    chooseNotebookDirectory(): Promise<string | null>;
    attachNotebook(notebookRoot: string): Promise<NotesStateRecord>;
    refreshNotebook(): Promise<NotesStateRecord>;
    selectNotebookNote(notePath: string): Promise<NotesStateRecord>;
    saveNotesNavigation(
      state: NotesNavigationState
    ): Promise<NotesNavigationState & { notebookRoot: string | null }>;
    saveNotebookNote(
      notePath: string,
      content: string
    ): Promise<NoteDocumentRecord>;
    chooseNotebookImage(notePath: string): Promise<{
      alt: string;
      source: string;
    } | null>;
    loadNotebookImage(
      notePath: string,
      source: string
    ): Promise<{ bytes: Uint8Array; mimeType: string }>;
    saveNotebookImage(
      notePath: string,
      input: { bytes: Uint8Array; fileName: string; mimeType: string }
    ): Promise<{ alt: string; source: string }>;
    importNotebookImageUrl(
      notePath: string,
      source: string
    ): Promise<{ alt: string; source: string }>;
    importNotebookImagePath(
      notePath: string,
      sourcePath: string
    ): Promise<{ alt: string; source: string }>;
    readNotebookTextAsset(
      assetPath: string
    ): Promise<{ content: string; name: string; path: string }>;
    createNotebookNote(parentPath?: string): Promise<NotesStateRecord>;
    createNotebookFolder(parentPath?: string): Promise<NotesStateRecord>;
    renameNotebookNode(
      nodePath: string,
      nextName: string
    ): Promise<NotesStateRecord>;
    deleteNotebookNode(nodePath: string): Promise<NotesStateRecord>;
    getNotesScratchpad(): Promise<NotesScratchpadStateRecord>;
    stageNotesScratchpad(
      changes: NotesProposedChangeRecord[]
    ): Promise<NotesScratchpadStateRecord>;
    acceptNotesScratchpad(): Promise<NotesScratchpadApplyResultRecord>;
    rejectNotesScratchpad(): Promise<NotesScratchpadStateRecord>;
    loadMapDraft(
      projectId: string,
      rootPath: string,
      targetFolderPath?: string
    ): Promise<MapDocumentDraft>;
    saveMapDraft(
      projectId: string,
      rootPath: string,
      content: string,
      targetFolderPath?: string
    ): Promise<MapDocumentDraft>;
    getAuthState(): Promise<AuthStateRecord>;
    saveProviderApiKey(
      providerId: string,
      apiKey: string
    ): Promise<AuthStateRecord>;
    beginProviderOAuthLogin(providerId: string): Promise<AuthStateRecord>;
    submitProviderOAuthInput(
      flowId: string,
      value: string
    ): Promise<AuthStateRecord>;
    logoutProvider(providerId: string): Promise<AuthStateRecord>;
    getThreadPanelState(
      activeThreadId?: string | null
    ): Promise<ThreadPanelState>;
    hydrateWorkspace(
      input?: AppWorkspaceHydrateInput
    ): Promise<AppWorkspaceState>;
    executeWorkspaceCommand(
      command: AppWorkspaceCommand
    ): Promise<AppWorkspaceState>;
    createConversationThread(): Promise<ThreadPanelState>;
    trashThread(threadId: string): Promise<ThreadPanelState>;
    renameThread(threadId: string, title: string): Promise<ThreadPanelState>;
    restoreThread(threadId: string): Promise<ThreadPanelState>;
    emptyTrash(): Promise<ThreadPanelState>;
    sendThreadMessage(
      threadId: string,
      content: string
    ): Promise<ThreadPanelState>;
    onThreadUpdate(listener: (payload: ThreadPanelState) => void): () => void;
    getRunPanelState(projectId: string): Promise<RunPanelState>;
    createRunThread(projectId: string): Promise<RunPanelState>;
    upgradeChatThreadToProject(
      threadId: string,
      projectId: string
    ): Promise<RunPanelState>;
    renameRunThread(
      projectId: string,
      runThreadId: string,
      title: string
    ): Promise<RunPanelState>;
    startRun(
      projectId: string,
      runThreadId: string,
      prompt: string
    ): Promise<RunPanelState>;
    stopRun(projectId: string, runId: string): Promise<RunPanelState>;
    getAppearancePreferences(): Promise<AppearancePreferencesRecord>;
    saveAppearancePreferences(
      preferences: AppearancePreferencesRecord
    ): Promise<AppearancePreferencesRecord>;
    getCustomSatelliteState(): Promise<CustomSatelliteStateRecord>;
    generateCustomSatellite(
      description: string
    ): Promise<CustomSatelliteProposalRecord>;
    confirmCustomSatellite(
      proposal: CustomSatelliteProposalRecord
    ): Promise<CustomSatelliteStateRecord>;
    createCustomSatelliteInstance(input: {
      customTypeId: string;
      x?: number;
      y?: number;
      z?: number;
    }): Promise<CustomSatelliteStateRecord>;
    updateCustomSatelliteValue(input: {
      instanceId: string;
      key: string;
      value: SatelliteValueRecord;
    }): Promise<void>;
    updateCustomSatelliteFrame(input: {
      instanceId: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      z?: number;
    }): Promise<void>;
    saveCustomSatelliteImage(input: {
      bytes: Uint8Array;
      instanceId: string;
      key: string;
      mimeType: string;
    }): Promise<{ imageId: string }>;
    loadCustomSatelliteImage(
      imageId: string
    ): Promise<{ bytes: Uint8Array; mimeType: string }>;
    closeCustomSatelliteInstance(instanceId: string): Promise<void>;
    reopenCustomSatelliteInstance(instanceId: string): Promise<void>;
    deleteCustomSatelliteInstance(instanceId: string): Promise<void>;
    deleteCustomSatelliteType(
      customTypeId: string
    ): Promise<CustomSatelliteStateRecord>;
  };
}

type SatelliteValueTypeRecord =
  | "shortText"
  | "longText"
  | "number"
  | "date"
  | "singleSelect"
  | "multiSelect"
  | "checkbox"
  | "progress"
  | "image";

type SatelliteValueRecord =
  | null
  | string
  | number
  | boolean
  | string[]
  | { imageId: string };

type CustomSatelliteIconRecord =
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

type CustomSatelliteColorRecord =
  | "slate"
  | "amber"
  | "rose"
  | "sky"
  | "emerald"
  | "violet";

interface CustomSatellitePropertyRecord {
  id: string;
  key: string;
  label: string;
  valueType: SatelliteValueTypeRecord;
  required: boolean;
  options?: string[];
  defaultValue?: SatelliteValueRecord;
}

interface CustomSatelliteProposalRecord {
  name: string;
  description?: string;
  icon: CustomSatelliteIconRecord;
  color: CustomSatelliteColorRecord;
  appearance: "card";
  properties: Array<Omit<CustomSatellitePropertyRecord, "id">>;
}

interface CustomSatelliteTypeRecord {
  id: string;
  name: string;
  description?: string;
  icon: CustomSatelliteIconRecord;
  color: CustomSatelliteColorRecord;
  appearance: "card";
  properties: CustomSatellitePropertyRecord[];
  createdAt: string;
  updatedAt: string;
}

interface CustomSatelliteInstanceRecord {
  id: string;
  customTypeId: string;
  data: Record<string, SatelliteValueRecord>;
  isOpen: boolean;
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

type AppearanceSchemeRecord = "auto" | "light" | "dark";
type AppearanceThemeRecord =
  | "grafito"
  | "porcelana"
  | "cristal"
  | "cristal-noche";
type AppearanceAccentRecord =
  | "violeta"
  | "azul"
  | "menta"
  | "ambar"
  | "rosa"
  | "custom";

type AppearanceHarmonyRecord =
  | "complementary"
  | "singleAnalogous"
  | "splitComplementary"
  | "analogous"
  | "triadic"
  | "floating";

interface AppearanceGradientPointRecord {
  x: number;
  y: number;
}

interface AppearancePreferencesRecord {
  accent: AppearanceAccentRecord;
  customAccent: { h: number; s: number; l: number };
  harmony: AppearanceHarmonyRecord;
  opacity: number;
  points: AppearanceGradientPointRecord[];
  rotation: number;
  scheme: AppearanceSchemeRecord;
  theme: AppearanceThemeRecord;
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

interface MapDocumentDraft {
  actionLabel: string;
  content: string;
  documentPath: string;
  isEditingLocked: boolean;
  isRoot: boolean;
  targetFolderPath: string;
}

interface NoteTreeNodeRecord {
  id: string;
  name: string;
  path: string;
  type: "folder" | "note" | "asset";
  mediaKind?: "image" | "video" | "audio" | "text" | "file";
  children?: NoteTreeNodeRecord[];
  updatedAt?: number;
}

interface NotesStateRecord {
  activeNote: NoteDocumentRecord | null;
  activeNoteId: string | null;
  expandedFolders: Record<string, boolean>;
  notebookName: string | null;
  notebookRoot: string | null;
  pathStatus: "ready" | "missing" | "unreadable" | null;
  tree: NoteTreeNodeRecord[];
}

interface NoteDocumentRecord {
  content: string;
  id: string;
  name: string;
  path: string;
  updatedAt: number;
}

interface NotesNavigationState {
  activeNoteId: string | null;
  expandedFolders: Record<string, boolean>;
}

type NotesProposedChangeRecord =
  | {
      content: string;
      id: string;
      path: string;
      type: "createNote";
    }
  | {
      content: string;
      id: string;
      path: string;
      type: "editNote";
    }
  | {
      content: string;
      id: string;
      path: string;
      type: "appendNote";
    }
  | {
      id: string;
      nextName: string;
      path: string;
      type: "renameNode";
    }
  | {
      id: string;
      path: string;
      targetFolderPath: string;
      type: "moveNote";
    }
  | {
      id: string;
      path: string;
      type: "deleteNote";
    }
  | {
      id: string;
      path: string;
      type: "createFolder";
    };

interface NotesScratchpadChangePreviewRecord {
  afterContent?: string;
  afterPath?: string;
  beforeContent?: string;
  beforePath?: string;
  change: NotesProposedChangeRecord;
}

interface NotesScratchpadStateRecord {
  changes: NotesScratchpadChangePreviewRecord[];
  isOpen: boolean;
}

interface NotesScratchpadApplyResultRecord {
  notes: NotesStateRecord;
  scratchpad: NotesScratchpadStateRecord;
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
