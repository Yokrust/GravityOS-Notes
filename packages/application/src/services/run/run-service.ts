import {
  createAgentActivityItem,
  createInitialRunResult,
  startRun
} from "@gravity/domain";

import type {
  ClockPort,
  IdGeneratorPort,
  PersistencePort,
  RuntimePort
} from "../../contracts/index.js";
import type { StartRunResult } from "../../dto/index.js";

export class RunService {
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

    const run = startRun({
      id: this.ids.next("run"),
      projectId,
      threadId,
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
    const runtimeSession = await this.runtime.startRun(run);

    await this.persistence.saveRun(run);
    await this.persistence.saveRunResult(runResult);
    await this.persistence.saveAgentActivityItem(promptActivityItem);

    return {
      actorId: runtimeSession.actorId,
      agentActivityItems: [promptActivityItem],
      run,
      runResult,
      runtimeRunId: runtimeSession.runtimeRunId
    };
  }
}
