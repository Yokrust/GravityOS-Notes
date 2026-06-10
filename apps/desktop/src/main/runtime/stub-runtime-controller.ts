import { join } from "node:path";

import type { PersistencePort, RuntimePort } from "@gravity/application";
import type { Run } from "@gravity/domain";

interface RuntimeCompletionInput {
  artifactPaths: string[];
  content: string;
  runId: string;
}

interface RuntimeFailureInput extends RuntimeCompletionInput {
  failureMessage: string;
}

interface ActiveStubRun {
  artifactPaths: string[];
  eventTimers: ReturnType<typeof setTimeout>[];
  partialContent: string;
  run: Run;
  runtimeRunId: string;
  timer: ReturnType<typeof setTimeout>;
}

export class StubRuntimeController implements RuntimePort {
  private readonly activeRunsByRunId = new Map<string, ActiveStubRun>();
  private readonly activeRunsByRuntimeId = new Map<string, ActiveStubRun>();
  private nextRuntimeRunId = 0;

  constructor(
    private readonly persistence: PersistencePort,
    private readonly callbacks: {
      onComplete(input: RuntimeCompletionInput): Promise<void>;
      onFail(input: RuntimeFailureInput): Promise<void>;
    }
  ) {}

  async startRun(run: Run): Promise<{
    actorId: string;
    runtimeRunId: string;
  }> {
    const runtimeRunId = `stub-runtime-run-${this.nextRuntimeRunId + 1}`;
    this.nextRuntimeRunId += 1;

    const activeRun: ActiveStubRun = {
      artifactPaths: await this.createArtifactPaths(run),
      eventTimers: [],
      partialContent: this.createPartialContent(run),
      run,
      runtimeRunId,
      timer: setTimeout(() => {
        void this.finishRun(runtimeRunId);
      }, 1200)
    };

    this.activeRunsByRunId.set(run.id, activeRun);
    this.activeRunsByRuntimeId.set(runtimeRunId, activeRun);

    return {
      actorId: "stub-runtime",
      runtimeRunId
    };
  }

  async stopRun(runtimeRunId: string): Promise<void> {
    const activeRun = this.activeRunsByRuntimeId.get(runtimeRunId);
    if (!activeRun) {
      return;
    }

    clearTimeout(activeRun.timer);
    this.releaseRun(activeRun);
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

    await this.stopRun(activeRun.runtimeRunId);

    return {
      artifactPaths: activeRun.artifactPaths,
      content: activeRun.partialContent,
      runtimeRunId: activeRun.runtimeRunId
    };
  }

  private async finishRun(runtimeRunId: string): Promise<void> {
    const activeRun = this.activeRunsByRuntimeId.get(runtimeRunId);
    if (!activeRun) {
      return;
    }

    this.releaseRun(activeRun);

    if (this.shouldFail(activeRun.run.prompt)) {
      await this.callbacks.onFail({
        artifactPaths: [],
        content: [
          activeRun.partialContent,
          "",
          "The stub runtime hit a deterministic failure before final output."
        ].join("\n"),
        failureMessage:
          "Stub runtime failed because the prompt requested a simulated failure.",
        runId: activeRun.run.id
      });
      return;
    }

    await this.callbacks.onComplete({
      artifactPaths: activeRun.artifactPaths,
      content: [
        activeRun.partialContent,
        "",
        "Completed with the stub runtime.",
        "Artifacts have been recorded for the run."
      ].join("\n"),
      runId: activeRun.run.id
    });
  }

  private releaseRun(activeRun: ActiveStubRun): void {
    clearTimeout(activeRun.timer);
    for (const eventTimer of activeRun.eventTimers) {
      clearTimeout(eventTimer);
    }
    this.activeRunsByRunId.delete(activeRun.run.id);
    this.activeRunsByRuntimeId.delete(activeRun.runtimeRunId);
  }

  private createPartialContent(run: Run): string {
    return [
      `Stub runtime accepted Run ${run.runNumber}.`,
      "",
      "Prompt",
      run.prompt,
      "",
      "Working notes",
      `- Project: ${requireRunProjectId(run)}`,
      `- Thread: ${run.threadId}`,
      "- Partial output is preserved when the run is stopped."
    ].join("\n");
  }

  private async createArtifactPaths(run: Run): Promise<string[]> {
    const persistedState = await this.persistence.loadState();
    const projectId = requireRunProjectId(run);
    const project = persistedState.projects.find(
      (entry) => entry.id === projectId
    );
    const artifactRoot = project?.rootPath ?? projectId;

    return [
      join(artifactRoot, ".gravity", "artifacts", `run-${run.runNumber}.md`)
    ];
  }

  private shouldFail(prompt: string): boolean {
    return /\bfail(?:ure|ed|ing)?\b/i.test(prompt);
  }
}

function requireRunProjectId(run: Run): string {
  if (!run.projectId) {
    throw new Error(`Run is not attached to a Project: ${run.id}`);
  }

  return run.projectId;
}
