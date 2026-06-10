import {
  createChatThread,
  createConversationThread,
  createThreadMessage,
  deriveThreadTitleFromPrompt,
  moveThreadToTrash,
  restoreThreadFromTrash,
  type Run,
  type RunResult,
  type RunThread,
  type ThreadMessage
} from "@gravity/domain";

import type {
  ClockPort,
  FilesystemPort,
  IdGeneratorPort,
  PersistencePort,
  ThreadRuntimePort
} from "../../contracts/index.js";
import type {
  StartRunResult,
  RunRecord,
  TrashedThreadRecord,
  ThreadPanelState,
  ThreadRecord
} from "../../dto/index.js";
import { RunService } from "../run/run-service.js";

interface ProjectThreadExecution {
  filesystem?: FilesystemPort;
  runService: RunService;
}

interface ThreadPanelCallbacks {
  onThreadUpdate(state: ThreadPanelState): void;
}

export class ThreadPanelService {
  private readonly callbacks: ThreadPanelCallbacks | undefined;
  private readonly projectExecution: ProjectThreadExecution | undefined;

  constructor(
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly persistence: PersistencePort,
    private readonly threadRuntime?: ThreadRuntimePort,
    projectExecutionOrCallbacks?: ProjectThreadExecution | ThreadPanelCallbacks,
    callbacks?: ThreadPanelCallbacks
  ) {
    if (
      projectExecutionOrCallbacks &&
      "runService" in projectExecutionOrCallbacks
    ) {
      this.projectExecution = projectExecutionOrCallbacks;
      this.callbacks = callbacks;
      return;
    }

    this.callbacks = projectExecutionOrCallbacks;
  }

  async hydrate(activeThreadId?: string | null): Promise<ThreadPanelState> {
    const persistedState = await this.persistence.loadState();
    const state = this.toThreadPanelState(persistedState);
    return {
      ...state,
      activeThreadId:
        activeThreadId &&
        state.threads.some((thread) => thread.runThread.id === activeThreadId)
          ? activeThreadId
          : (state.threads.at(-1)?.runThread.id ?? null)
    };
  }

  async createConversationThread(): Promise<ThreadPanelState> {
    const runThread = createConversationThread({
      createdAt: this.clock.now(),
      id: this.ids.next("thread")
    });

    await this.persistence.saveRunThread(runThread);
    return this.hydrate(runThread.id);
  }

  async createChatThread(): Promise<ThreadPanelState> {
    const thread = createChatThread({
      createdAt: this.clock.now(),
      id: this.ids.next("thread")
    });

    await this.persistence.saveRunThread(thread);
    return this.hydrate(thread.id);
  }

  async trashThread(threadId: string): Promise<ThreadPanelState> {
    const persistedState = await this.persistence.loadState();
    const runThread = persistedState.runThreads.find(
      (thread) => thread.id === threadId
    );

    if (!runThread) {
      throw new Error(`Unknown thread: ${threadId}`);
    }

    if (!runThread.trashedAt) {
      await this.persistence.saveRunThread(
        moveThreadToTrash({
          thread: runThread,
          trashedAt: this.clock.now()
        })
      );
    }

    return this.hydrate();
  }

  async renameThread(input: {
    threadId: string;
    title: string;
  }): Promise<ThreadPanelState> {
    const persistedState = await this.persistence.loadState();
    const runThread = persistedState.runThreads.find(
      (thread) => thread.id === input.threadId
    );

    if (!runThread || runThread.trashedAt) {
      throw new Error(`Unknown thread: ${input.threadId}`);
    }

    await this.persistence.saveRunThread({
      ...runThread,
      title: input.title.trim() || runThread.title
    });

    return this.hydrate(runThread.id);
  }

  async restoreThread(threadId: string): Promise<ThreadPanelState> {
    const persistedState = await this.persistence.loadState();
    const runThread = persistedState.runThreads.find(
      (thread) => thread.id === threadId
    );

    if (!runThread) {
      throw new Error(`Unknown thread: ${threadId}`);
    }
    if (!runThread.trashedAt) {
      throw new Error(`Thread is not in trash: ${threadId}`);
    }

    await this.persistence.saveRunThread(restoreThreadFromTrash(runThread));
    return this.hydrate(threadId);
  }

  async emptyTrash(): Promise<ThreadPanelState> {
    const persistedState = await this.persistence.loadState();
    const trashedThreads = persistedState.runThreads.filter((thread) =>
      Boolean(thread.trashedAt)
    );

    for (const thread of trashedThreads) {
      await this.persistence.deleteThreadData(thread.id);
    }

    return this.hydrate();
  }

  async sendMessage(input: {
    content: string;
    threadId: string;
  }): Promise<ThreadPanelState> {
    const content = input.content.trim();
    if (!content) {
      throw new Error("Thread message is required.");
    }

    const persistedState = await this.persistence.loadState();
    const runThread = persistedState.runThreads.find(
      (thread) => thread.id === input.threadId
    );
    if (!runThread) {
      throw new Error(`Unknown thread: ${input.threadId}`);
    }
    if (runThread.trashedAt) {
      throw new Error(`Thread is in trash: ${input.threadId}`);
    }

    const existingMessages = persistedState.threadMessages.filter(
      (message) => message.threadId === runThread.id
    );
    const createdAt = this.clock.now();
    const userMessage = createThreadMessage({
      content,
      createdAt,
      id: this.ids.next("thread_message"),
      role: "user",
      threadId: runThread.id
    });
    let assistantMessage = createThreadMessage({
      content: "",
      createdAt,
      id: this.ids.next("thread_message"),
      role: "assistant",
      threadId: runThread.id
    });

    await this.persistence.saveThreadMessage(userMessage);
    await this.persistence.saveThreadMessage(assistantMessage);

    if (runThread.title === "New thread" && existingMessages.length === 0) {
      await this.persistence.saveRunThread({
        ...runThread,
        title: deriveThreadTitleFromPrompt(content)
      });
    }

    if (runThread.kind === "project") {
      await this.startProjectRunForThread({
        assistantMessage,
        content,
        persistedState,
        runThread
      });
      return this.hydrate(runThread.id);
    }

    if (this.threadRuntime) {
      const persistence = this.persistence;
      const hydrate = (activeThreadId: string) => this.hydrate(activeThreadId);
      const callbacks = this.callbacks;
      const emitUpdate = async () => {
        callbacks?.onThreadUpdate(await hydrate(runThread.id));
      };
      const recordStreamError = async (message: string) => {
        assistantMessage = {
          ...assistantMessage,
          content:
            assistantMessage.content || `Conversation stream failed: ${message}`
        };
        await persistence.saveThreadMessage(assistantMessage);
        await emitUpdate();
      };
      void this.threadRuntime
        .startThreadTurn({
          async onComplete(finalContent) {
            assistantMessage = {
              ...assistantMessage,
              content: finalContent
            };
            await persistence.saveThreadMessage(assistantMessage);
            await emitUpdate();
          },
          async onDelta(delta) {
            assistantMessage = {
              ...assistantMessage,
              content: assistantMessage.content + delta
            };
            await persistence.saveThreadMessage(assistantMessage);
            await emitUpdate();
          },
          onError: recordStreamError,
          prompt: content,
          projectId: runThread.projectId,
          threadId: runThread.id
        })
        .catch((error: unknown) =>
          recordStreamError(
            error instanceof Error
              ? error.message
              : "Conversation stream failed to start."
          )
        );
    }

    return this.hydrate(runThread.id);
  }

  async completeRunMessage(input: {
    content: string;
    runId: string;
  }): Promise<ThreadPanelState | null> {
    const state = await this.updateAssistantMessageForRun({
      fallbackContent: "",
      runId: input.runId,
      selectContent: () => input.content
    });
    if (state) {
      this.callbacks?.onThreadUpdate(state);
    }
    return state;
  }

  async failRunMessage(input: {
    failureMessage: string;
    runId: string;
  }): Promise<ThreadPanelState | null> {
    const state = await this.updateAssistantMessageForRun({
      fallbackContent: `Project run failed: ${input.failureMessage}`,
      runId: input.runId,
      selectContent: (currentContent) => currentContent
    });
    if (state) {
      this.callbacks?.onThreadUpdate(state);
    }
    return state;
  }

  private async startProjectRunForThread(input: {
    assistantMessage: ThreadMessage;
    content: string;
    persistedState: Awaited<ReturnType<PersistencePort["loadState"]>>;
    runThread: RunThread;
  }): Promise<StartRunResult> {
    if (!this.projectExecution) {
      throw new Error("Project thread execution is not configured.");
    }
    if (!input.runThread.projectId) {
      throw new Error(
        `Project thread is missing a project id: ${input.runThread.id}`
      );
    }

    await this.ensureProjectExecutionAvailable(input.runThread.projectId);

    const activeRun = input.persistedState.runs.find(
      (run) =>
        run.projectId === input.runThread.projectId &&
        run.status === "in_progress"
    );
    if (activeRun) {
      throw new Error("Only one active run is allowed per project.");
    }

    const runNumber =
      input.persistedState.runs.filter(
        (run) => run.threadId === input.runThread.id
      ).length + 1;

    const startedRun = await this.projectExecution.runService.start({
      projectId: input.runThread.projectId,
      prompt: input.content,
      runNumber,
      threadId: input.runThread.id
    });

    await this.persistence.saveThreadMessage({
      ...input.assistantMessage,
      content: ""
    });

    return startedRun;
  }

  private async ensureProjectExecutionAvailable(
    projectId: string
  ): Promise<void> {
    if (!this.projectExecution?.filesystem) {
      return;
    }

    const persistedState = await this.persistence.loadState();
    const project = persistedState.projects.find(
      (currentProject) => currentProject.id === projectId
    );
    if (!project) {
      throw new Error(`Unknown project: ${projectId}`);
    }

    const pathDetails = await this.projectExecution.filesystem.inspectPath(
      project.rootPath
    );
    if (pathDetails.status !== "ready") {
      throw new Error(
        "Project context is unavailable. Reattach it before starting new execution."
      );
    }
  }

  private async updateAssistantMessageForRun(input: {
    fallbackContent: string;
    runId: string;
    selectContent: (currentContent: string) => string;
  }): Promise<ThreadPanelState | null> {
    const persistedState = await this.persistence.loadState();
    const run = persistedState.runs.find(
      (currentRun) => currentRun.id === input.runId
    );
    if (!run) {
      return null;
    }

    const messages = persistedState.threadMessages
      .filter((message) => message.threadId === run.threadId)
      .toSorted((left, right) => left.createdAt.localeCompare(right.createdAt));
    const assistantMessage = messages
      .toReversed()
      .find((message) => message.role === "assistant");
    if (!assistantMessage) {
      return this.hydrate(run.threadId);
    }

    await this.persistence.saveThreadMessage({
      ...assistantMessage,
      content:
        input.selectContent(assistantMessage.content) ||
        assistantMessage.content ||
        input.fallbackContent
    });

    return this.hydrate(run.threadId);
  }

  private toThreadPanelState(
    persistedState: Awaited<ReturnType<PersistencePort["loadState"]>>
  ): ThreadPanelState {
    const messagesByThreadId = groupByThreadId(persistedState.threadMessages);
    const runsByThreadId = groupRunsByThreadId(persistedState.runs);
    const runResultsByRunId = new Map(
      persistedState.runResults.map((runResult) => [runResult.runId, runResult])
    );
    const sortedThreads = persistedState.runThreads.toSorted((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    );
    const threads = sortedThreads
      .filter(
        (runThread) =>
          !runThread.trashedAt &&
          (runThread.kind === "chat" || runThread.kind === "conversation")
      )
      .map((runThread) =>
        this.toThreadRecord(
          runThread,
          messagesByThreadId.get(runThread.id) ?? [],
          runsByThreadId.get(runThread.id) ?? [],
          runResultsByRunId
        )
      );
    const trashedThreads = sortedThreads
      .filter((runThread) => Boolean(runThread.trashedAt))
      .map((runThread) =>
        this.toTrashedThreadRecord(
          runThread,
          messagesByThreadId.get(runThread.id) ?? [],
          runsByThreadId.get(runThread.id) ?? [],
          runResultsByRunId
        )
      );

    return {
      activeThreadId: threads.at(-1)?.runThread.id ?? null,
      threads,
      trashedThreads
    };
  }

  private toTrashedThreadRecord(
    runThread: RunThread,
    messages: ThreadMessage[],
    runs: Run[],
    runResultsByRunId: Map<string, RunResult>
  ): TrashedThreadRecord {
    const runRecords = runs
      .toSorted((left, right) => left.runNumber - right.runNumber)
      .map(
        (run): RunRecord => ({
          activityRows: [],
          agentActivityItems: [],
          run,
          runResult: runResultsByRunId.get(run.id) ?? {
            artifactPaths: [],
            content: "",
            failureMessage: null,
            runId: run.id,
            status: "pending"
          }
        })
      );

    return {
      latestMessage: messages.at(-1) ?? null,
      latestRun: runRecords.at(-1) ?? null,
      restorableUntil: addDays(runThread.trashedAt!, 30),
      runThread,
      trashedAt: runThread.trashedAt!
    };
  }

  private toThreadRecord(
    runThread: RunThread,
    messages: ThreadMessage[],
    runs: Run[],
    runResultsByRunId: Map<string, RunResult>
  ): ThreadRecord {
    const runRecords = runs
      .toSorted((left, right) => left.runNumber - right.runNumber)
      .map(
        (run): RunRecord => ({
          activityRows: [],
          agentActivityItems: [],
          run,
          runResult: runResultsByRunId.get(run.id) ?? {
            artifactPaths: [],
            content: "",
            failureMessage: null,
            runId: run.id,
            status: "pending"
          }
        })
      );

    return {
      latestMessage: messages.at(-1) ?? null,
      messages: messages.toSorted((left, right) =>
        left.createdAt.localeCompare(right.createdAt)
      ),
      thread: runThread,
      runThread,
      runs: runRecords
    };
  }
}

function addDays(value: string, days: number): string {
  const nextDate = new Date(value);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate.toISOString();
}

function groupByThreadId(
  messages: ThreadMessage[]
): Map<string, ThreadMessage[]> {
  const grouped = new Map<string, ThreadMessage[]>();
  for (const message of messages) {
    grouped.set(message.threadId, [
      ...(grouped.get(message.threadId) ?? []),
      message
    ]);
  }
  return grouped;
}

function groupRunsByThreadId(runs: Run[]): Map<string, Run[]> {
  const grouped = new Map<string, Run[]>();
  for (const run of runs) {
    grouped.set(run.threadId, [...(grouped.get(run.threadId) ?? []), run]);
  }
  return grouped;
}
