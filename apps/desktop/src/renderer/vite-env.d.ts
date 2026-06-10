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
    createNotebookNote(parentPath?: string): Promise<NotesStateRecord>;
    createNotebookFolder(parentPath?: string): Promise<NotesStateRecord>;
    renameNotebookNode(
      nodePath: string,
      nextName: string
    ): Promise<NotesStateRecord>;
    deleteNotebookNode(nodePath: string): Promise<NotesStateRecord>;
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
  };
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
  type: "folder" | "note";
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
