import {
  completeRun,
  createAgentActivityItem,
  createProjectThread,
  createRunThread,
  type AgentActivityKind,
  type AgentActivityItem,
  type AgentActivityOutput,
  type AgentActivityPathAssociation,
  type AgentActivityStatus,
  type Run,
  type RunResult,
  type RunThread,
  updateRunResult
} from "@gravity/domain";

import type {
  ClockPort,
  FilesystemPort,
  IdGeneratorPort,
  PersistencePort,
  RuntimePort
} from "../../contracts/index.js";
import type {
  RunPanelState,
  RunActivityPathLink,
  RunActivityRow,
  RunThreadRecord,
  StartRunResult
} from "../../dto/index.js";
import { RunService } from "../run/run-service.js";

export class RunPanelService {
  constructor(
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly persistence: PersistencePort,
    private readonly runtime: RuntimePort,
    private readonly runService: RunService,
    private readonly filesystem?: FilesystemPort
  ) {}

  async hydrate(projectId: string): Promise<RunPanelState> {
    const persistedState = await this.persistence.loadState();
    return this.toRunPanelState(projectId, persistedState);
  }

  async createThread(projectId: string): Promise<RunPanelState> {
    await this.ensureProjectExecutionAvailable(projectId);

    const persistedState = await this.persistence.loadState();
    const existingThreads = persistedState.runThreads.filter(
      (runThread) =>
        runThread.kind !== "conversation" &&
        runThread.kind !== "chat" &&
        runThread.projectId === projectId &&
        !runThread.trashedAt
    );
    const runThread = createRunThread({
      createdAt: this.clock.now(),
      projectId,
      id: this.ids.next("run_thread"),
      title: `Thread ${existingThreads.length + 1}`
    });

    await this.persistence.saveRunThread(runThread);

    return this.hydrate(projectId);
  }

  async createProjectThread(projectId: string): Promise<RunPanelState> {
    await this.ensureProjectExecutionAvailable(projectId);

    const persistedState = await this.persistence.loadState();
    const existingThreads = persistedState.runThreads.filter(
      (runThread) =>
        runThread.kind !== "conversation" &&
        runThread.kind !== "chat" &&
        runThread.projectId === projectId &&
        !runThread.trashedAt
    );
    const thread = createProjectThread({
      createdAt: this.clock.now(),
      id: this.ids.next("run_thread"),
      projectId,
      title: `Thread ${existingThreads.length + 1}`
    });

    await this.persistence.saveRunThread(thread);

    return this.hydrate(projectId);
  }

  async upgradeChatThreadToProject(input: {
    projectId: string;
    threadId: string;
  }): Promise<RunPanelState> {
    await this.ensureProjectExecutionAvailable(input.projectId);

    const persistedState = await this.persistence.loadState();
    const thread = persistedState.runThreads.find(
      (currentThread) => currentThread.id === input.threadId
    );
    if (!thread || thread.trashedAt) {
      throw new Error(`Unknown chat thread: ${input.threadId}`);
    }
    if (thread.kind !== "chat" && thread.kind !== "conversation") {
      throw new Error(`Thread is already project-scoped: ${input.threadId}`);
    }

    await this.persistence.saveRunThread({
      ...thread,
      kind: "project",
      projectId: input.projectId
    });

    return this.hydrate(input.projectId);
  }

  async renameThread(input: {
    projectId: string;
    threadId: string;
    title: string;
  }): Promise<RunPanelState> {
    const persistedState = await this.persistence.loadState();
    const runThread = persistedState.runThreads.find(
      (currentRunThread) => currentRunThread.id === input.threadId
    );

    if (!runThread || runThread.trashedAt) {
      throw new Error(`Unknown run thread: ${input.threadId}`);
    }
    if (runThread.projectId !== input.projectId) {
      throw new Error(`Unknown run thread: ${input.threadId}`);
    }

    await this.persistence.saveRunThread({
      ...runThread,
      title: input.title.trim() || runThread.title
    });

    return this.hydrate(input.projectId);
  }

  async startRun(input: {
    projectId: string;
    prompt: string;
    threadId: string;
  }): Promise<StartRunResult & { state: RunPanelState }> {
    const prompt = input.prompt.trim();
    if (!prompt) {
      throw new Error("Run prompt is required.");
    }

    await this.ensureProjectExecutionAvailable(input.projectId);

    const persistedState = await this.persistence.loadState();
    const activeRun = persistedState.runs.find(
      (run) => run.projectId === input.projectId && run.status === "in_progress"
    );

    if (activeRun) {
      throw new Error("Only one active Run is allowed per Project.");
    }

    const runThread = persistedState.runThreads.find(
      (currentRunThread) => currentRunThread.id === input.threadId
    );
    if (
      !runThread ||
      runThread.projectId !== input.projectId ||
      runThread.trashedAt
    ) {
      throw new Error(`Unknown run thread: ${input.threadId}`);
    }

    const runNumber =
      persistedState.runs.filter((run) => run.threadId === input.threadId)
        .length + 1;
    const startedRun = await this.runService.start({
      projectId: input.projectId,
      prompt,
      runNumber,
      threadId: input.threadId
    });

    return {
      ...startedRun,
      state: await this.toRunPanelState(input.projectId, {
        ...persistedState,
        agentActivityItems: [
          ...persistedState.agentActivityItems,
          ...startedRun.agentActivityItems
        ],
        runResults: [...persistedState.runResults, startedRun.runResult],
        runs: [...persistedState.runs, startedRun.run]
      })
    };
  }

  async completeRun(input: {
    artifactPaths: string[];
    content: string;
    runId: string;
  }): Promise<RunPanelState | null> {
    return this.finalizeRun({
      artifactPaths: input.artifactPaths,
      content: input.content,
      failureMessage: null,
      runId: input.runId,
      runStatus: "completed",
      runResultStatus: "completed"
    });
  }

  async failRun(input: {
    artifactPaths: string[];
    content: string;
    failureMessage: string;
    runId: string;
  }): Promise<RunPanelState | null> {
    return this.finalizeRun({
      artifactPaths: input.artifactPaths,
      content: input.content,
      failureMessage: input.failureMessage,
      runId: input.runId,
      runStatus: "failed",
      runResultStatus: "failed"
    });
  }

  async stopRun(input: {
    projectId: string;
    runId: string;
  }): Promise<RunPanelState | null> {
    const persistedState = await this.persistence.loadState();
    const run = persistedState.runs.find(
      (currentRun) => currentRun.id === input.runId
    );

    if (!run || run.projectId !== input.projectId) {
      throw new Error(`Unknown run: ${input.runId}`);
    }

    const stoppedRun = await this.runtime.stopRunByRunId(input.runId);

    return this.finalizeRun({
      artifactPaths: stoppedRun.artifactPaths,
      content: stoppedRun.content,
      failureMessage: null,
      runId: input.runId,
      runStatus: "stopped",
      runResultStatus: "stopped"
    });
  }

  async recordAgentActivity(input: {
    completedAt?: string | null;
    kind: AgentActivityKind;
    output?: AgentActivityOutput;
    pathAssociations?: AgentActivityPathAssociation[];
    runId: string;
    startedAt?: string;
    status: AgentActivityStatus;
    text: string;
  }): Promise<RunPanelState | null> {
    const persistedState = await this.persistence.loadState();
    const run = persistedState.runs.find(
      (currentRun) => currentRun.id === input.runId
    );

    if (!run) {
      throw new Error(`Unknown run: ${input.runId}`);
    }

    const sequence =
      persistedState.agentActivityItems.filter(
        (activityItem) => activityItem.runId === input.runId
      ).length + 1;
    const startedAt = input.startedAt ?? this.clock.now();
    const activityItem = createAgentActivityItem({
      completedAt:
        input.completedAt ??
        (input.status === "in_progress" || input.status === "pending"
          ? null
          : startedAt),
      id: this.ids.next("agent_activity"),
      kind: input.kind,
      ...(input.output ? { output: input.output } : {}),
      pathAssociations: input.pathAssociations ?? [],
      runId: input.runId,
      sequence,
      startedAt,
      status: input.status,
      text: input.text
    });

    await this.persistence.saveAgentActivityItem(activityItem);

    return maybeToRunPanelState(
      run,
      {
        ...persistedState,
        agentActivityItems: [...persistedState.agentActivityItems, activityItem]
      },
      (projectId, state) => this.toRunPanelState(projectId, state)
    );
  }

  private async finalizeRun(input: {
    artifactPaths: string[];
    content: string;
    failureMessage: string | null;
    runId: string;
    runResultStatus: RunResult["status"];
    runStatus: Extract<Run["status"], "completed" | "failed" | "stopped">;
  }): Promise<RunPanelState | null> {
    const persistedState = await this.persistence.loadState();
    const run = persistedState.runs.find(
      (currentRun) => currentRun.id === input.runId
    );
    const runResult = persistedState.runResults.find(
      (currentRunResult) => currentRunResult.runId === input.runId
    );

    if (!run || !runResult) {
      throw new Error(`Unknown run: ${input.runId}`);
    }

    const nextRun = completeRun({
      completedAt: this.clock.now(),
      run,
      status: input.runStatus
    });
    const nextRunResult = updateRunResult({
      artifactPaths: input.artifactPaths,
      content: input.content,
      failureMessage: input.failureMessage,
      runResult,
      status: input.runResultStatus
    });

    await this.persistence.saveRun(nextRun);
    await this.persistence.saveRunResult(nextRunResult);

    const nextPersistedState = {
      ...persistedState,
      runResults: persistedState.runResults.map((currentRunResult) =>
        currentRunResult.runId === nextRunResult.runId
          ? nextRunResult
          : currentRunResult
      ),
      runs: persistedState.runs.map((currentRun) =>
        currentRun.id === nextRun.id ? nextRun : currentRun
      )
    };
    return maybeToRunPanelState(run, nextPersistedState, (projectId, state) =>
      this.toRunPanelState(projectId, state)
    );
  }

  private async toRunPanelState(
    projectId: string,
    persistedState: Awaited<ReturnType<PersistencePort["loadState"]>>
  ): Promise<RunPanelState> {
    const runResultsByRunId = new Map(
      persistedState.runResults.map((runResult) => [runResult.runId, runResult])
    );
    const agentActivityItemsByRunId = groupAgentActivityByRunId(
      persistedState.agentActivityItems
    );
    const runThreads = await Promise.all(
      persistedState.runThreads
        .filter(
          (runThread) =>
            runThread.kind !== "conversation" &&
            runThread.kind !== "chat" &&
            runThread.projectId === projectId &&
            !runThread.trashedAt
        )
        .toSorted((left, right) =>
          left.createdAt.localeCompare(right.createdAt)
        )
        .map((runThread) =>
          this.toRunThreadRecord(
            runThread,
            persistedState,
            agentActivityItemsByRunId,
            persistedState.runs,
            runResultsByRunId
          )
        )
    );
    const activeRunId =
      runThreads
        .flatMap((runThread) => runThread.runs)
        .find((runRecord) => runRecord.run.status === "in_progress")?.run.id ??
      null;

    return {
      activeRunId,
      projectId,
      runThreads
    };
  }

  private async toRunThreadRecord(
    runThread: RunThread,
    persistedState: Awaited<ReturnType<PersistencePort["loadState"]>>,
    agentActivityItemsByRunId: Map<
      string,
      Awaited<ReturnType<PersistencePort["loadState"]>>["agentActivityItems"]
    >,
    runs: Run[],
    runResultsByRunId: Map<string, RunResult>
  ): Promise<RunThreadRecord> {
    const runRecords = await Promise.all(
      runs
        .filter((run) => run.threadId === runThread.id)
        .toSorted((left, right) => left.runNumber - right.runNumber)
        .map(async (run) => {
          const agentActivityItems =
            agentActivityItemsByRunId.get(run.id) ?? [];

          return {
            activityRows: await this.toRunActivityRows({
              activityItems: agentActivityItems,
              projectId: requireRunProjectId(run),
              persistedState
            }),
            agentActivityItems,
            run,
            runResult: runResultsByRunId.get(run.id) ?? {
              artifactPaths: [],
              content: "",
              failureMessage: null,
              runId: run.id,
              status: "pending" as const
            }
          };
        })
    );

    return {
      latestRun: runRecords.at(-1) ?? null,
      thread: runThread,
      runThread,
      runs: runRecords
    };
  }

  private async toRunActivityRows(input: {
    activityItems: AgentActivityItem[];
    projectId: string;
    persistedState: Awaited<ReturnType<PersistencePort["loadState"]>>;
  }): Promise<RunActivityRow[]> {
    const project = input.persistedState.projects.find(
      (currentProject) => currentProject.id === input.projectId
    );
    const rootPath = project?.rootPath ?? null;
    const activityItems = coalesceAdjacentMessageFragments(input.activityItems);

    return Promise.all(
      activityItems.map(async (activityItem) => ({
        completedAt: activityItem.completedAt,
        id: activityItem.id,
        isCollapsed:
          activityItem.kind === "command" || activityItem.kind === "tool",
        kind: activityItem.kind,
        outputPreview: activityItem.output
          ? {
              ...activityItem.output,
              wasTruncated:
                activityItem.output.truncatedByteCount > 0 ||
                activityItem.output.truncatedLineCount > 0
            }
          : null,
        pathLinks: await this.toRunActivityPathLinks({
          pathAssociations: activityItem.pathAssociations,
          rootPath
        }),
        sequence: activityItem.sequence,
        startedAt: activityItem.startedAt,
        status: activityItem.status,
        text: activityItem.text
      }))
    );
  }

  private async toRunActivityPathLinks(input: {
    pathAssociations: AgentActivityPathAssociation[];
    rootPath: string | null;
  }): Promise<RunActivityPathLink[]> {
    return Promise.all(
      input.pathAssociations.map(async (association) => {
        const label = formatProjectRelativePath({
          path: association.path,
          rootPath: input.rootPath
        });

        if (association.confidence !== "high") {
          return {
            confidence: association.confidence,
            label,
            path: association.path,
            reason: "Path association is not confident enough to link.",
            status: "unavailable" as const
          };
        }

        if (!this.filesystem) {
          return {
            confidence: association.confidence,
            label,
            path: association.path,
            status: "ready" as const
          };
        }

        const details = await this.filesystem.inspectPath(association.path);
        return {
          confidence: association.confidence,
          label,
          path: association.path,
          status: details.status === "ready" ? "ready" : "missing"
        };
      })
    );
  }

  private async ensureProjectExecutionAvailable(
    projectId: string
  ): Promise<void> {
    if (!this.filesystem) {
      return;
    }

    const persistedState = await this.persistence.loadState();
    const project = persistedState.projects.find(
      (currentProject) => currentProject.id === projectId
    );
    if (!project) {
      throw new Error(`Unknown project: ${projectId}`);
    }

    const pathDetails = await this.filesystem.inspectPath(project.rootPath);
    if (pathDetails.status !== "ready") {
      throw new Error(
        "Project context is unavailable. Reattach it before starting new execution."
      );
    }
  }
}

function formatProjectRelativePath(input: {
  path: string;
  rootPath: string | null;
}): string {
  const path = normalizePath(input.path);
  const rootPath = input.rootPath ? normalizePath(input.rootPath) : null;

  if (!rootPath) {
    return path;
  }

  if (path === rootPath) {
    return ".";
  }

  if (path.startsWith(`${rootPath}/`)) {
    return path.slice(rootPath.length + 1);
  }

  return path;
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/\/+$/, "");
}

function coalesceAdjacentMessageFragments(
  activityItems: AgentActivityItem[]
): AgentActivityItem[] {
  const coalescedItems: AgentActivityItem[] = [];

  for (const activityItem of activityItems) {
    const previousItem = coalescedItems.at(-1);
    if (
      previousItem &&
      isPlainCompletedMessage(previousItem) &&
      isPlainCompletedMessage(activityItem)
    ) {
      coalescedItems[coalescedItems.length - 1] = {
        ...previousItem,
        completedAt: activityItem.completedAt,
        text: `${previousItem.text}${activityItem.text}`
      };
      continue;
    }

    coalescedItems.push(activityItem);
  }

  return coalescedItems;
}

function isPlainCompletedMessage(activityItem: AgentActivityItem): boolean {
  return (
    activityItem.kind === "message" &&
    activityItem.status === "completed" &&
    !activityItem.output &&
    activityItem.pathAssociations.length === 0
  );
}

function groupAgentActivityByRunId(
  activityItems: Awaited<
    ReturnType<PersistencePort["loadState"]>
  >["agentActivityItems"]
): Map<
  string,
  Awaited<ReturnType<PersistencePort["loadState"]>>["agentActivityItems"]
> {
  const grouped = new Map<
    string,
    Awaited<ReturnType<PersistencePort["loadState"]>>["agentActivityItems"]
  >();

  for (const activityItem of activityItems.toSorted(
    (left, right) =>
      left.runId.localeCompare(right.runId) || left.sequence - right.sequence
  )) {
    grouped.set(activityItem.runId, [
      ...(grouped.get(activityItem.runId) ?? []),
      activityItem
    ]);
  }

  return grouped;
}

function requireRunProjectId(run: Run): string {
  if (!run.projectId) {
    throw new Error(`Run is not attached to a Project: ${run.id}`);
  }

  return run.projectId;
}

function maybeToRunPanelState(
  run: Run,
  persistedState: Awaited<ReturnType<PersistencePort["loadState"]>>,
  toRunPanelState: (
    projectId: string,
    persistedState: Awaited<ReturnType<PersistencePort["loadState"]>>
  ) => Promise<RunPanelState>
): Promise<RunPanelState | null> {
  if (!run.projectId) {
    return Promise.resolve(null);
  }

  return toRunPanelState(run.projectId, persistedState);
}
