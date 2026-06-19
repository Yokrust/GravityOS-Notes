import {
  completeRun,
  createAgentActivityItem,
  createInitialRunResult,
  startRun,
  updateRunResult
} from "@gravity/domain";

import type {
  ClockPort,
  IdGeneratorPort,
  PersistencePort,
  RuntimePort
} from "../../contracts/index.js";
import type { StartRunResult } from "../../dto/index.js";

export class RunService {
  private readonly startQueuesByScope = new Map<string, Promise<void>>();

  constructor(
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly persistence: PersistencePort,
    private readonly runtime: RuntimePort
  ) {}

  async start(input: {
    projectId?: string | null;
    threadId?: string;
    runThreadId?: string;
    runNumber: number;
    prompt: string;
  }): Promise<StartRunResult> {
    const projectId = input.projectId ?? null;
    const threadId = input.threadId ?? input.runThreadId;
    if (!threadId) {
      throw new Error("Runs require a thread id.");
    }

    return this.enqueueStart(activeRunScope(projectId, threadId), () =>
      this.startAfterActiveRunLimit({
        ...input,
        projectId,
        threadId
      })
    );
  }

  private async startAfterActiveRunLimit(input: {
    projectId: string | null;
    threadId: string;
    runNumber: number;
    prompt: string;
  }): Promise<StartRunResult> {
    const persistedState = await this.persistence.loadState();
    const activeRun = persistedState.runs.find(
      (run) =>
        run.status === "in_progress" &&
        (input.projectId
          ? run.projectId === input.projectId
          : run.projectId === null && run.threadId === input.threadId)
    );
    if (activeRun) {
      throw new Error(
        input.projectId
          ? "Only one active Run is allowed per Project."
          : "Only one active Run is allowed per Chat Thread."
      );
    }

    const run = startRun({
      id: this.ids.next("run"),
      projectId: input.projectId,
      threadId: input.threadId,
      runNumber: input.runNumber,
      prompt: input.prompt,
      startedAt: this.clock.now()
    });
    const runResult = createInitialRunResult(run.id);
    const promptActivityItem = createAgentActivityItem({
      completedAt: run.startedAt,
      id: this.ids.next("agent_activity"),
      kind: "prompt",
      runId: run.id,
      sequence: 1,
      startedAt: run.startedAt,
      status: "completed",
      text: run.prompt
    });
    await this.persistence.saveRun(run);
    await this.persistence.saveRunResult(runResult);
    await this.persistence.saveAgentActivityItem(promptActivityItem);

    let runtimeSession: Awaited<ReturnType<RuntimePort["startRun"]>>;
    try {
      runtimeSession = await this.runtime.startRun(run);
    } catch (error) {
      const failureMessage =
        error instanceof Error ? error.message : "Runtime failed to start.";
      await this.persistence.saveRun(
        completeRun({
          completedAt: this.clock.now(),
          run,
          status: "failed"
        })
      );
      await this.persistence.saveRunResult(
        updateRunResult({
          artifactPaths: [],
          content: "",
          failureMessage,
          runResult,
          status: "failed"
        })
      );
      throw error;
    }

    return {
      actorId: runtimeSession.actorId,
      agentActivityItems: [promptActivityItem],
      run,
      runResult,
      runtimeRunId: runtimeSession.runtimeRunId
    };
  }

  private async enqueueStart<T>(
    scope: string,
    start: () => Promise<T>
  ): Promise<T> {
    const previous = this.startQueuesByScope.get(scope) ?? Promise.resolve();
    let releaseCurrent = () => {};
    const current = previous
      .catch(() => {})
      .then(
        () =>
          new Promise<void>((resolve) => {
            releaseCurrent = resolve;
          })
      );
    this.startQueuesByScope.set(scope, current);

    await previous.catch(() => {});
    try {
      return await start();
    } finally {
      releaseCurrent();
      if (this.startQueuesByScope.get(scope) === current) {
        this.startQueuesByScope.delete(scope);
      }
    }
  }
}

function activeRunScope(projectId: string | null, threadId: string): string {
  return projectId ? `project:${projectId}` : `thread:${threadId}`;
}
