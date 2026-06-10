export type RunStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "stopped";

export type ThreadKind = "chat" | "conversation" | "project";

export interface Run {
  id: string;
  projectId: string | null;
  threadId: string;
  runNumber: number;
  prompt: string;
  status: RunStatus;
  startedAt: string;
  completedAt: string | null;
}

export interface Thread {
  id: string;
  projectId: string | null;
  kind: ThreadKind;
  title: string;
  createdAt: string;
  trashedAt: string | null;
}

export type RunThread = Thread;

export interface ThreadMessage {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface RunResult {
  runId: string;
  status: "pending" | "partial" | "completed" | "failed" | "stopped";
  content: string;
  artifactPaths: string[];
  failureMessage: string | null;
}

export type AgentActivityKind =
  | "prompt"
  | "message"
  | "reasoning"
  | "tool"
  | "command";

export type AgentActivityStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "stopped";

export interface AgentActivityPathAssociation {
  path: string;
  confidence: "high" | "medium" | "low";
}

export interface AgentActivityOutput {
  head: string;
  tail: string;
  truncatedByteCount: number;
  truncatedLineCount: number;
}

export interface AgentActivityItem {
  id: string;
  runId: string;
  sequence: number;
  kind: AgentActivityKind;
  status: AgentActivityStatus;
  startedAt: string;
  completedAt: string | null;
  text: string;
  pathAssociations: AgentActivityPathAssociation[];
  output?: AgentActivityOutput;
}

export function createProjectThread(input: {
  id: string;
  projectId?: string;
  title: string;
  createdAt: string;
}): Thread {
  const projectId = input.projectId;
  if (!projectId) {
    throw new Error("Project threads require a project id.");
  }

  return {
    id: input.id,
    projectId,
    kind: "project",
    title: input.title,
    createdAt: input.createdAt,
    trashedAt: null
  };
}

export function createRunThread(input: {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
}): RunThread {
  return createProjectThread(input);
}

export function createChatThread(input: {
  id: string;
  title?: string;
  createdAt: string;
}): Thread {
  return {
    id: input.id,
    projectId: null,
    kind: "chat",
    title: input.title?.trim() || "New thread",
    createdAt: input.createdAt,
    trashedAt: null
  };
}

export function createConversationThread(input: {
  id: string;
  title?: string;
  createdAt: string;
}): RunThread {
  return {
    id: input.id,
    projectId: null,
    kind: "conversation",
    title: input.title?.trim() || "New thread",
    createdAt: input.createdAt,
    trashedAt: null
  };
}

export function moveThreadToTrash(input: {
  thread: Thread;
  trashedAt: string;
}): Thread {
  return {
    ...input.thread,
    trashedAt: input.trashedAt
  };
}

export function restoreThreadFromTrash(thread: Thread): Thread {
  return {
    ...thread,
    trashedAt: null
  };
}

export function createThreadMessage(input: {
  id: string;
  threadId: string;
  role: ThreadMessage["role"];
  content: string;
  createdAt: string;
}): ThreadMessage {
  return {
    id: input.id,
    threadId: input.threadId,
    role: input.role,
    content: input.content,
    createdAt: input.createdAt
  };
}

export function deriveThreadTitleFromPrompt(prompt: string): string {
  const compactPrompt = prompt.trim().replace(/\s+/g, " ");
  if (!compactPrompt) {
    return "New thread";
  }

  return compactPrompt.length > 42
    ? `${compactPrompt.slice(0, 39).trimEnd()}...`
    : compactPrompt;
}

export function startRun(input: {
  id: string;
  projectId?: string | null;
  threadId?: string;
  runNumber: number;
  prompt: string;
  startedAt: string;
}): Run {
  const projectId = input.projectId ?? null;
  const threadId = input.threadId;
  if (!threadId) {
    throw new Error("Runs require a thread id.");
  }

  return {
    id: input.id,
    projectId,
    threadId,
    runNumber: input.runNumber,
    prompt: input.prompt,
    status: "in_progress",
    startedAt: input.startedAt,
    completedAt: null
  };
}

export function createInitialRunResult(runId: string): RunResult {
  return {
    runId,
    status: "pending",
    content: "",
    artifactPaths: [],
    failureMessage: null
  };
}

export function createAgentActivityItem(input: {
  completedAt?: string | null;
  id: string;
  kind: AgentActivityKind;
  output?: AgentActivityOutput;
  pathAssociations?: AgentActivityPathAssociation[];
  runId: string;
  sequence: number;
  startedAt: string;
  status: AgentActivityStatus;
  text: string;
}): AgentActivityItem {
  return {
    completedAt: input.completedAt ?? null,
    id: input.id,
    kind: input.kind,
    pathAssociations: input.pathAssociations ?? [],
    runId: input.runId,
    sequence: input.sequence,
    startedAt: input.startedAt,
    status: input.status,
    text: input.text,
    ...(input.output ? { output: input.output } : {})
  };
}

export function updateRunResult(input: {
  runResult: RunResult;
  status: RunResult["status"];
  content: string;
  artifactPaths: string[];
  failureMessage?: string | null;
}): RunResult {
  return {
    ...input.runResult,
    status: input.status,
    content: input.content,
    artifactPaths: input.artifactPaths,
    failureMessage: input.failureMessage ?? null
  };
}

export function completeRun(input: {
  run: Run;
  status: Extract<RunStatus, "completed" | "failed" | "stopped">;
  completedAt: string;
}): Run {
  return {
    ...input.run,
    status: input.status,
    completedAt: input.completedAt
  };
}
