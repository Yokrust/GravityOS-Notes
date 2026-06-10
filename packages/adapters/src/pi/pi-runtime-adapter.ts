import { isAbsolute, resolve, win32 } from "node:path";

import {
  type AuthStorage,
  createAgentSession,
  SessionManager
} from "@mariozechner/pi-coding-agent";
import type { RuntimePort, ThreadRuntimePort } from "@gravity/application";
import type { Run } from "@gravity/domain";

interface PiSessionLike {
  prompt(text: string): Promise<unknown>;
  subscribe(listener: (event: unknown) => void): () => void;
  close?(): Promise<void> | void;
  dispose?(): void;
}

interface PiSessionRecord {
  actorId: string;
  runtimeRunId: string;
  session: PiSessionLike;
}

interface PiRuntimeResult {
  artifactPaths: string[];
  content: string;
  runtimeRunId: string;
}

interface ActiveRunRecord {
  activityWriteTail: Promise<void>;
  assistantMessageBuffer: string;
  completionPromise: Promise<PiRuntimeResult>;
  content: string;
  reasoningBuffer: string;
  runId: string;
  runtimeRunId: string;
  session: PiSessionLike;
  stopped: boolean;
  toolStartsByCallId: Map<
    string,
    {
      args: unknown;
      startedAt: string;
      toolName: string;
    }
  >;
  unsubscribe: () => void;
  cwd: string;
}

export interface PiRuntimeAdapterOptions {
  authStorage?: AuthStorage;
  createSession?: (input: { cwd: string }) => Promise<PiSessionRecord>;
  onActivity?: (input: {
    completedAt?: string | null;
    kind: "message" | "reasoning" | "tool" | "command";
    output?: {
      head: string;
      tail: string;
      truncatedByteCount: number;
      truncatedLineCount: number;
    };
    pathAssociations?: Array<{
      confidence: "high" | "medium" | "low";
      path: string;
    }>;
    runId: string;
    startedAt?: string;
    status: "pending" | "in_progress" | "completed" | "failed" | "stopped";
    text: string;
  }) => Promise<void>;
  onComplete?: (input: {
    artifactPaths: string[];
    content: string;
    runId: string;
  }) => Promise<void>;
  onFail?: (input: {
    artifactPaths: string[];
    content: string;
    failureMessage: string;
    runId: string;
  }) => Promise<void>;
  onPersistenceWarning?: (input: {
    message: string;
    runId: string | null;
  }) => Promise<void>;
  resolveRootPath: (projectId: string) => Promise<string>;
  resolveConversationCwd?: (input: {
    threadId: string;
  }) => Promise<string> | string;
}

export class PiRuntimeAdapter implements RuntimePort, ThreadRuntimePort {
  private readonly activeRunsByRunId = new Map<string, ActiveRunRecord>();
  private readonly runIdsByRuntimeRunId = new Map<string, string>();
  private readonly activeConversationStreams = new Map<
    string,
    {
      session: PiSessionLike;
      unsubscribe: () => void;
    }
  >();
  private nextRuntimeRunId = 0;
  private nextConversationStreamId = 0;

  constructor(private readonly options: PiRuntimeAdapterOptions) {}

  async startRun(run: Run): Promise<{
    actorId: string;
    runtimeRunId: string;
  }> {
    if (!run.projectId) {
      throw new Error(`Run is not attached to a Project: ${run.id}`);
    }

    const cwd = await this.options.resolveRootPath(run.projectId);
    const createdSession = await this.createSession({ cwd });
    const activeRun: ActiveRunRecord = {
      activityWriteTail: Promise.resolve(),
      assistantMessageBuffer: "",
      completionPromise: Promise.resolve({
        artifactPaths: [],
        content: "",
        runtimeRunId: createdSession.runtimeRunId
      }),
      content: "",
      cwd,
      reasoningBuffer: "",
      runId: run.id,
      runtimeRunId: createdSession.runtimeRunId,
      session: createdSession.session,
      stopped: false,
      toolStartsByCallId: new Map(),
      unsubscribe: () => {}
    };
    activeRun.unsubscribe = createdSession.session.subscribe((event) => {
      const textDelta = extractAssistantTextDelta(event);
      if (textDelta) {
        activeRun.content += textDelta;
        activeRun.assistantMessageBuffer += textDelta;
      }
      this.handleRuntimeEvent(activeRun, createdSession.actorId, event);
    });
    this.activeRunsByRunId.set(run.id, activeRun);
    this.runIdsByRuntimeRunId.set(createdSession.runtimeRunId, run.id);
    activeRun.completionPromise = this.scheduleRunPrompt(activeRun, run.prompt);

    return {
      actorId: createdSession.actorId,
      runtimeRunId: createdSession.runtimeRunId
    };
  }

  async stopRun(runtimeRunId: string): Promise<void> {
    const runId = this.runIdsByRuntimeRunId.get(runtimeRunId);
    if (!runId) {
      return;
    }

    await this.stopRunByRunId(runId);
  }

  async stopRunByRunId(runId: string): Promise<{
    artifactPaths: string[];
    content: string;
    runtimeRunId: string;
  }> {
    const activeRun = this.activeRunsByRunId.get(runId);
    if (!activeRun) {
      throw new Error(`Unknown active run: ${runId}`);
    }

    activeRun.stopped = true;
    activeRun.unsubscribe();
    this.flushReasoningActivity(activeRun);
    this.flushAssistantMessageActivity(activeRun);
    await Promise.allSettled([activeRun.activityWriteTail]);
    await closeSession(activeRun.session);
    this.activeRunsByRunId.delete(runId);
    this.runIdsByRuntimeRunId.delete(activeRun.runtimeRunId);

    return {
      artifactPaths: [],
      content: activeRun.content,
      runtimeRunId: activeRun.runtimeRunId
    };
  }

  async waitForRunToFinish(runId: string): Promise<PiRuntimeResult> {
    const activeRun = this.activeRunsByRunId.get(runId);
    if (!activeRun) {
      throw new Error(`Unknown active run: ${runId}`);
    }

    return activeRun.completionPromise;
  }

  async startThreadTurn(input: {
    onComplete?: (content: string) => Promise<void>;
    onDelta: (delta: string) => Promise<void>;
    onError?: (message: string) => Promise<void>;
    prompt: string;
    projectId: string | null;
    threadId: string;
  }): Promise<{ streamId: string }> {
    const cwd = input.projectId
      ? await this.options.resolveRootPath(input.projectId)
      : this.options.resolveConversationCwd
        ? await this.options.resolveConversationCwd({
            threadId: input.threadId
          })
        : process.cwd();
    const createdSession = await this.createSession({ cwd });
    const streamId = `pi-conversation-stream-${this.nextConversationStreamId + 1}`;
    this.nextConversationStreamId += 1;
    let content = "";
    let writeTail = Promise.resolve();

    const enqueueWrite = (write: () => Promise<void>) => {
      writeTail = writeTail.then(write);
    };
    const unsubscribe = createdSession.session.subscribe((event) => {
      const delta = extractAssistantTextDelta(event);
      if (!delta) {
        return;
      }

      content += delta;
      enqueueWrite(() => input.onDelta(delta));
    });

    this.activeConversationStreams.set(streamId, {
      session: createdSession.session,
      unsubscribe
    });

    void this.runConversationPrompt({
      content: () => content,
      input,
      session: createdSession.session,
      streamId,
      unsubscribe,
      waitForWrites: () => writeTail
    });

    return { streamId };
  }

  private async createSession(input: {
    cwd: string;
  }): Promise<PiSessionRecord> {
    if (this.options.createSession) {
      return this.options.createSession(input);
    }

    const { session } = await createAgentSession({
      cwd: input.cwd,
      sessionManager: SessionManager.inMemory(),
      ...(this.options.authStorage
        ? { authStorage: this.options.authStorage }
        : {})
    });
    const runtimeRunId = `pi-runtime-run-${this.nextRuntimeRunId + 1}`;
    this.nextRuntimeRunId += 1;

    return {
      actorId: "pi-agent",
      runtimeRunId,
      session
    };
  }

  private async runConversationPrompt(input: {
    content: () => string;
    input: {
      onComplete?: (content: string) => Promise<void>;
      onError?: (message: string) => Promise<void>;
      prompt: string;
    };
    session: PiSessionLike;
    streamId: string;
    unsubscribe: () => void;
    waitForWrites: () => Promise<void>;
  }): Promise<void> {
    try {
      await input.session.prompt(input.input.prompt);
      await input.waitForWrites();
      await input.input.onComplete?.(input.content());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Pi conversation failed.";
      await input.input.onError?.(message);
    } finally {
      input.unsubscribe();
      this.activeConversationStreams.delete(input.streamId);
      await closeSession(input.session);
    }
  }

  private async runPrompt(
    activeRun: ActiveRunRecord,
    prompt: string
  ): Promise<PiRuntimeResult> {
    try {
      await activeRun.session.prompt(prompt);
      this.flushReasoningActivity(activeRun);
      this.flushAssistantMessageActivity(activeRun);
      await Promise.all([activeRun.activityWriteTail]);
      const result = {
        artifactPaths: [],
        content: activeRun.content,
        runtimeRunId: activeRun.runtimeRunId
      };

      if (!activeRun.stopped) {
        await this.options.onComplete?.({
          artifactPaths: result.artifactPaths,
          content: result.content,
          runId: activeRun.runId
        });
      }

      return result;
    } catch (error) {
      this.flushReasoningActivity(activeRun);
      this.flushAssistantMessageActivity(activeRun);
      await Promise.allSettled([activeRun.activityWriteTail]);
      const failureMessage =
        error instanceof Error ? error.message : "Pi runtime failed.";

      if (!activeRun.stopped) {
        await this.options.onFail?.({
          artifactPaths: [],
          content: activeRun.content,
          failureMessage,
          runId: activeRun.runId
        });
      }

      throw new Error(failureMessage);
    } finally {
      activeRun.unsubscribe();
      this.activeRunsByRunId.delete(activeRun.runId);
      this.runIdsByRuntimeRunId.delete(activeRun.runtimeRunId);
    }
  }

  private scheduleRunPrompt(
    activeRun: ActiveRunRecord,
    prompt: string
  ): Promise<PiRuntimeResult> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (activeRun.stopped) {
          resolve({
            artifactPaths: [],
            content: activeRun.content,
            runtimeRunId: activeRun.runtimeRunId
          });
          return;
        }

        void this.runPrompt(activeRun, prompt).then(resolve, reject);
      }, 0);
    });
  }

  private flushAssistantMessageActivity(activeRun: ActiveRunRecord): void {
    if (!activeRun.assistantMessageBuffer) {
      return;
    }

    this.enqueueActivity(activeRun, {
      kind: "message",
      status: "completed",
      text: activeRun.assistantMessageBuffer
    });
    activeRun.assistantMessageBuffer = "";
  }

  private flushReasoningActivity(activeRun: ActiveRunRecord): void {
    if (!activeRun.reasoningBuffer.trim()) {
      activeRun.reasoningBuffer = "";
      return;
    }

    this.enqueueActivity(activeRun, {
      kind: "reasoning",
      status: "completed",
      text: activeRun.reasoningBuffer
    });
    activeRun.reasoningBuffer = "";
  }

  private handleRuntimeEvent(
    activeRun: ActiveRunRecord,
    actorId: string,
    event: unknown
  ): void {
    if (!isRecord(event) || typeof event.type !== "string") {
      return;
    }

    if (
      event.type === "message_update" &&
      isRecord(event.assistantMessageEvent)
    ) {
      if (
        event.assistantMessageEvent.type === "thinking_delta" &&
        typeof event.assistantMessageEvent.delta === "string"
      ) {
        activeRun.reasoningBuffer += event.assistantMessageEvent.delta;
      }

      if (event.assistantMessageEvent.type === "thinking_end") {
        this.flushReasoningActivity(activeRun);
      }

      return;
    }

    if (event.type === "tool_execution_start") {
      const toolName =
        typeof event.toolName === "string" ? event.toolName : "tool";
      const toolCallId =
        typeof event.toolCallId === "string"
          ? event.toolCallId
          : `${toolName}:${Date.now()}`;
      const startedAt = new Date().toISOString();
      activeRun.toolStartsByCallId.set(toolCallId, {
        args: event.args,
        startedAt,
        toolName
      });

      this.enqueueActivity(activeRun, {
        kind: toolName === "bash" ? "command" : "tool",
        pathAssociations: getToolPathAssociations({
          args: event.args,
          cwd: activeRun.cwd,
          toolName
        }),
        startedAt,
        status: "in_progress",
        text: formatToolStartText(toolName, event.args)
      });
      return;
    }

    if (event.type === "tool_execution_end") {
      const toolName =
        typeof event.toolName === "string" ? event.toolName : "tool";
      const toolCallId =
        typeof event.toolCallId === "string" ? event.toolCallId : "";
      const started = activeRun.toolStartsByCallId.get(toolCallId);
      const args = started?.args ?? event.args;
      const completedAt = new Date().toISOString();
      const isError = event.isError === true;
      const resultText = extractToolResultText(event.result);

      activeRun.toolStartsByCallId.delete(toolCallId);
      this.enqueueActivity(activeRun, {
        completedAt,
        kind: toolName === "bash" ? "command" : "tool",
        pathAssociations: getToolPathAssociations({
          args,
          cwd: activeRun.cwd,
          toolName
        }),
        startedAt: started?.startedAt ?? completedAt,
        status: isError ? "failed" : "completed",
        text: formatToolEndText(toolName, args, isError),
        ...(resultText ? { output: toOutputPreview(resultText) } : {})
      });
    }
  }

  private enqueueActivity(
    activeRun: ActiveRunRecord,
    input: Omit<
      Parameters<NonNullable<PiRuntimeAdapterOptions["onActivity"]>>[0],
      "runId"
    >
  ): void {
    this.trackWrite(activeRun, () =>
      this.options.onActivity?.({
        ...input,
        runId: activeRun.runId
      })
    );
  }

  private trackWrite(
    activeRun: ActiveRunRecord,
    startWrite: () => Promise<void> | undefined
  ): void {
    activeRun.activityWriteTail = activeRun.activityWriteTail.then(() =>
      this.runWrite(activeRun.runId, startWrite)
    );
  }

  private async runWrite(
    runId: string,
    startWrite: () => Promise<void> | undefined
  ): Promise<void> {
    try {
      await startWrite();
    } catch (error) {
      await this.reportPersistenceWarning(
        runId,
        error,
        "Failed to persist runtime activity."
      );
    }
  }

  private async reportPersistenceWarning(
    runId: string,
    error: unknown,
    fallbackMessage: string
  ): Promise<void> {
    const message =
      error instanceof Error && error.message ? error.message : fallbackMessage;

    try {
      await this.options.onPersistenceWarning?.({
        message,
        runId
      });
    } catch {
      return;
    }
  }
}

async function closeSession(session: PiSessionLike): Promise<void> {
  if (session.close) {
    await session.close();
    return;
  }

  session.dispose?.();
}

function extractAssistantTextDelta(event: unknown): string {
  if (
    !isRecord(event) ||
    event.type !== "message_update" ||
    !isRecord(event.assistantMessageEvent) ||
    event.assistantMessageEvent.type !== "text_delta" ||
    typeof event.assistantMessageEvent.delta !== "string"
  ) {
    return "";
  }

  return event.assistantMessageEvent.delta;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getToolPathAssociations(input: {
  args: unknown;
  cwd: string;
  toolName: string;
}): Array<{ confidence: "high" | "medium" | "low"; path: string }> {
  const args = isRecord(input.args) ? input.args : {};
  const rawPath = typeof args.path === "string" ? args.path : null;

  if (rawPath) {
    return [
      {
        confidence: "high",
        path: resolveToolPath(input.cwd, rawPath)
      }
    ];
  }

  if (input.toolName === "bash") {
    return [
      {
        confidence: "medium",
        path: input.cwd
      }
    ];
  }

  return [];
}

function resolveToolPath(cwd: string, path: string): string {
  return normalizePath(
    isProjectAbsolutePath(path)
      ? normalizeProjectPath(path)
      : resolveProjectPath(cwd, path)
  );
}

function isProjectAbsolutePath(path: string): boolean {
  return isAbsolute(path) || usesWindowsPathSemantics(path);
}

function usesWindowsPathSemantics(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path) || /^\\\\/.test(path);
}

function normalizeProjectPath(path: string): string {
  return usesWindowsPathSemantics(path) ? win32.normalize(path) : path;
}

function resolveProjectPath(cwd: string, path: string): string {
  if (usesWindowsPathSemantics(cwd)) {
    return win32.resolve(cwd, path);
  }

  return resolve(cwd, path);
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/\/+$/, "");
}

function formatToolStartText(toolName: string, args: unknown): string {
  if (
    toolName === "bash" &&
    isRecord(args) &&
    typeof args.command === "string"
  ) {
    return `Running command: ${args.command}`;
  }

  if (isRecord(args) && typeof args.path === "string") {
    return `Using ${toolName} on ${args.path}`;
  }

  return `Using ${toolName}`;
}

function formatToolEndText(
  toolName: string,
  args: unknown,
  isError: boolean
): string {
  const statusText = isError ? "failed" : "completed";

  if (
    toolName === "bash" &&
    isRecord(args) &&
    typeof args.command === "string"
  ) {
    return `Command ${statusText}: ${args.command}`;
  }

  if (isRecord(args) && typeof args.path === "string") {
    return `${toolName} ${statusText}: ${args.path}`;
  }

  return `${toolName} ${statusText}`;
}

function extractToolResultText(result: unknown): string {
  if (!isRecord(result) || !Array.isArray(result.content)) {
    return "";
  }

  return result.content
    .map((content) =>
      isRecord(content) &&
      content.type === "text" &&
      typeof content.text === "string"
        ? content.text
        : ""
    )
    .filter(Boolean)
    .join("\n");
}

function toOutputPreview(text: string): {
  head: string;
  tail: string;
  truncatedByteCount: number;
  truncatedLineCount: number;
} {
  const lines = text.split(/\r?\n/);
  const maxLines = 40;
  const truncatedLineCount = Math.max(0, lines.length - maxLines);
  const headLines = lines.slice(0, Math.min(lines.length, 20));
  const tailLines = truncatedLineCount > 0 ? lines.slice(-20) : headLines;
  const head = headLines.join("\n");
  const tail = tailLines.join("\n");

  return {
    head,
    tail,
    truncatedByteCount: 0,
    truncatedLineCount
  };
}
