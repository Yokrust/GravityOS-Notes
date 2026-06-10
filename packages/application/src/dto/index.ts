import type {
  AgentActivityItem,
  MapState,
  Run,
  RunResult,
  Thread,
  ThreadMessage,
  RunThread
} from "@gravity/domain";
import type {
  AuthFlowState,
  AuthProviderState,
  ProjectState
} from "../contracts/index.js";

export interface AuthStateRecord {
  activeFlow: AuthFlowState | null;
  providers: AuthProviderState[];
}

export interface StartRunResult {
  actorId: string;
  agentActivityItems: AgentActivityItem[];
  run: Run;
  runResult: RunResult;
  runtimeRunId: string;
}

export interface MapEvaluationResult {
  rootPath: string;
  mapState: MapState;
}

export interface MapDocumentDraft {
  actionLabel: string;
  content: string;
  documentPath: string;
  isEditingLocked: boolean;
  isRoot: boolean;
  targetFolderPath: string;
}

export interface RunRecord {
  agentActivityItems: AgentActivityItem[];
  activityRows: RunActivityRow[];
  run: Run;
  runResult: RunResult;
}

export interface RunActivityPathLink {
  confidence: "high" | "medium" | "low";
  label: string;
  path: string;
  reason?: string;
  status: "ready" | "missing" | "unavailable";
}

export interface RunActivityOutputPreview {
  head: string;
  tail: string;
  truncatedByteCount: number;
  truncatedLineCount: number;
  wasTruncated: boolean;
}

export interface RunActivityRow {
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

export interface RunThreadRecord {
  latestRun: RunRecord | null;
  thread: Thread;
  runThread: RunThread;
  runs: RunRecord[];
}

export interface ThreadRecord {
  latestMessage: ThreadMessage | null;
  messages: ThreadMessage[];
  thread: Thread;
  runThread: RunThread;
  runs: RunRecord[];
}

export interface TrashedThreadRecord {
  latestMessage: ThreadMessage | null;
  latestRun: RunRecord | null;
  runThread: RunThread;
  restorableUntil: string;
  trashedAt: string;
}

export interface ThreadPanelState {
  activeThreadId: string | null;
  threads: ThreadRecord[];
  trashedThreads: TrashedThreadRecord[];
}

export interface RunPanelState {
  activeRunId: string | null;
  projectId: string;
  runThreads: RunThreadRecord[];
}

export type AppWorkspaceActiveThread =
  | {
      kind: "chat";
      record: ThreadRecord;
    }
  | {
      kind: "project";
      projectId: string;
      record: RunThreadRecord;
    };

export interface WorkspaceThreadExecutionStatus {
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

export interface WorkspaceTurnExecutionStatus {
  kind: "chat" | "project";
  status: "pending" | "in_progress" | "completed" | "failed" | "stopped";
  threadId: string;
  turnId: string;
}

export interface AppWorkspaceHydrateInput {
  openThreadId?: string | null;
  selectedProjectId?: string | null;
}

export interface AppWorkspaceState {
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

export type AppWorkspaceCommand =
  | { type: "selectProject"; projectId: string }
  | { type: "openThread"; threadId: string }
  | { type: "createProjectThread"; projectId: string }
  | { type: "upgradeChatThreadToProject"; threadId: string; projectId: string }
  | { type: "trashThread"; threadId: string }
  | { type: "restoreThread"; threadId: string }
  | { type: "emptyTrash" }
  | { type: "refresh" };
