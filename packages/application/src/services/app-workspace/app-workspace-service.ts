import type { ProjectState } from "../../contracts/index.js";
import type {
  AppWorkspaceActiveThread,
  AppWorkspaceCommand,
  AppWorkspaceHydrateInput,
  AppWorkspaceState,
  RunThreadRecord,
  ThreadPanelState
} from "../../dto/index.js";
import type { ProjectService } from "../folder-system/folder-system-service.js";
import type { RunPanelService } from "../run-panel/run-panel-service.js";
import type { ThreadPanelService } from "../thread-panel/thread-panel-service.js";

export class AppWorkspaceService {
  private openThreadId: string | null = null;

  constructor(
    private readonly services: {
      projects: ProjectService;
      runPanel: RunPanelService;
      threadPanel: ThreadPanelService;
    }
  ) {}

  async hydrate(
    input: AppWorkspaceHydrateInput = {}
  ): Promise<AppWorkspaceState> {
    if (input.selectedProjectId) {
      await this.services.projects.select(input.selectedProjectId);
    }
    this.openThreadId = input.openThreadId ?? this.openThreadId;
    return this.snapshot();
  }

  async execute(command: AppWorkspaceCommand): Promise<AppWorkspaceState> {
    switch (command.type) {
      case "selectProject":
        await this.services.projects.select(command.projectId);
        break;
      case "openThread":
        this.openThreadId = command.threadId;
        break;
      case "createProjectThread": {
        const state = await this.services.runPanel.createProjectThread(
          command.projectId
        );
        await this.services.projects.select(command.projectId);
        this.openThreadId = state.runThreads.at(-1)?.runThread.id ?? null;
        break;
      }
      case "upgradeChatThreadToProject":
        await this.services.runPanel.upgradeChatThreadToProject({
          projectId: command.projectId,
          threadId: command.threadId
        });
        await this.services.projects.select(command.projectId);
        this.openThreadId = command.threadId;
        break;
      case "trashThread":
        await this.services.threadPanel.trashThread(command.threadId);
        if (this.openThreadId === command.threadId) {
          this.openThreadId = null;
        }
        break;
      case "restoreThread":
        await this.services.threadPanel.restoreThread(command.threadId);
        this.openThreadId = command.threadId;
        break;
      case "emptyTrash":
        await this.services.threadPanel.emptyTrash();
        break;
      case "refresh":
        break;
    }

    return this.snapshot();
  }

  private async snapshot(): Promise<AppWorkspaceState> {
    const projects = await this.services.projects.hydrate();
    const projectThreadsByProjectId =
      await this.hydrateProjectThreadsByProjectId(projects);
    const openedProjectThread = this.findProjectThread(
      projectThreadsByProjectId,
      this.openThreadId
    );
    const selectedProjectId =
      openedProjectThread?.projectId ?? projects.selectedProjectId;
    const selectedProjects =
      selectedProjectId && selectedProjectId !== projects.selectedProjectId
        ? await this.services.projects.select(selectedProjectId)
        : projects;
    const chatThreads = await this.services.threadPanel.hydrate(
      openedProjectThread ? null : this.openThreadId
    );
    const activeProjectThreads = selectedProjectId
      ? (projectThreadsByProjectId[selectedProjectId] ?? [])
      : [];
    const activeThread = this.resolveActiveThread({
      activeProjectThreads,
      chatThreads,
      openedProjectThread,
      selectedProjectId
    });
    const { threadExecutionStatusByThreadId, turnExecutionStatusByTurnId } =
      this.resolveExecutionStatus({
        chatThreads,
        projectThreadsByProjectId
      });

    this.openThreadId = activeThread?.record.runThread.id ?? null;

    return {
      activeThread,
      chatThreads,
      projectThreadsByProjectId,
      projects: selectedProjects,
      selectedProjectId: selectedProjects.selectedProjectId,
      threadExecutionStatusByThreadId,
      turnExecutionStatusByTurnId
    };
  }

  private async hydrateProjectThreadsByProjectId(
    projects: ProjectState
  ): Promise<Record<string, RunThreadRecord[]>> {
    const entries = await Promise.all(
      projects.projects
        .filter((project) => project.pathStatus === "ready")
        .map(async (project) => {
          const state = await this.services.runPanel.hydrate(
            project.project.id
          );
          return [project.project.id, state.runThreads] as const;
        })
    );

    return Object.fromEntries(entries);
  }

  private findProjectThread(
    projectThreadsByProjectId: Record<string, RunThreadRecord[]>,
    threadId: string | null
  ): { projectId: string } | null {
    if (!threadId) {
      return null;
    }

    for (const [projectId, threads] of Object.entries(
      projectThreadsByProjectId
    )) {
      const thread = threads.find(
        (currentThread) => currentThread.runThread.id === threadId
      );
      if (thread) {
        return { projectId: requireRunThreadProjectId(thread) ?? projectId };
      }
    }

    return null;
  }

  private resolveActiveThread(input: {
    activeProjectThreads: RunThreadRecord[];
    chatThreads: ThreadPanelState;
    openedProjectThread: { projectId: string } | null;
    selectedProjectId: string | null;
  }): AppWorkspaceActiveThread | null {
    if (
      this.openThreadId &&
      input.openedProjectThread &&
      input.selectedProjectId
    ) {
      const record = input.activeProjectThreads.find(
        (thread) => thread.runThread.id === this.openThreadId
      );
      if (!record) {
        const projectThread = Object.values({
          [input.openedProjectThread.projectId]: input.activeProjectThreads
        })
          .flat()
          .find((thread) => thread.runThread.id === this.openThreadId);
        if (projectThread) {
          return {
            kind: "project",
            projectId: input.openedProjectThread.projectId,
            record: projectThread
          };
        }
      }
      if (record) {
        return {
          kind: "project",
          projectId: input.openedProjectThread.projectId,
          record
        };
      }
    }

    if (this.openThreadId) {
      const activeChatThread =
        input.chatThreads.threads.find(
          (thread) => thread.runThread.id === this.openThreadId
        ) ?? null;
      if (activeChatThread) {
        return {
          kind: "chat",
          record: activeChatThread
        };
      }
    }

    const fallbackProjectThread = input.activeProjectThreads.at(-1);
    if (input.selectedProjectId && fallbackProjectThread) {
      return {
        kind: "project",
        projectId: input.selectedProjectId,
        record: fallbackProjectThread
      };
    }

    const activeChatThread = input.chatThreads.activeThreadId
      ? (input.chatThreads.threads.find(
          (thread) => thread.runThread.id === input.chatThreads.activeThreadId
        ) ?? null)
      : null;
    if (activeChatThread) {
      return {
        kind: "chat",
        record: activeChatThread
      };
    }

    return null;
  }

  private resolveExecutionStatus(input: {
    chatThreads: ThreadPanelState;
    projectThreadsByProjectId: Record<string, RunThreadRecord[]>;
  }): Pick<
    AppWorkspaceState,
    "threadExecutionStatusByThreadId" | "turnExecutionStatusByTurnId"
  > {
    const threadExecutionStatusByThreadId: AppWorkspaceState["threadExecutionStatusByThreadId"] =
      {};
    const turnExecutionStatusByTurnId: AppWorkspaceState["turnExecutionStatusByTurnId"] =
      {};

    for (const thread of input.chatThreads.threads) {
      const latestAssistantMessage = thread.messages
        .toReversed()
        .find((message) => message.role === "assistant");
      const status = latestAssistantMessage
        ? latestAssistantMessage.content
          ? "completed"
          : "in_progress"
        : "idle";

      threadExecutionStatusByThreadId[thread.runThread.id] = {
        currentTurnId: latestAssistantMessage?.id ?? null,
        status,
        threadId: thread.runThread.id
      };

      if (latestAssistantMessage) {
        turnExecutionStatusByTurnId[latestAssistantMessage.id] = {
          kind: "chat",
          status: latestAssistantMessage.content ? "completed" : "in_progress",
          threadId: thread.runThread.id,
          turnId: latestAssistantMessage.id
        };
      }
    }

    for (const thread of Object.values(
      input.projectThreadsByProjectId
    ).flat()) {
      const activeRun =
        thread.runs.find((record) => record.run.status === "in_progress") ??
        null;
      const latestRun = thread.runs.at(-1) ?? null;
      const currentTurn = activeRun ?? latestRun;

      threadExecutionStatusByThreadId[thread.runThread.id] = {
        currentTurnId: currentTurn?.run.id ?? null,
        status: currentTurn?.run.status ?? "idle",
        threadId: thread.runThread.id
      };

      for (const run of thread.runs) {
        turnExecutionStatusByTurnId[run.run.id] = {
          kind: "project",
          status: run.run.status,
          threadId: thread.runThread.id,
          turnId: run.run.id
        };
      }
    }

    return {
      threadExecutionStatusByThreadId,
      turnExecutionStatusByTurnId
    };
  }
}

function requireRunThreadProjectId(thread: RunThreadRecord): string | null {
  return thread.runThread.projectId ?? thread.runThread.projectId ?? null;
}
