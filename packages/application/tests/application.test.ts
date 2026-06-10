import { describe, expect, it } from "vitest";
import {
  completeRun,
  createProject,
  createProjectThread,
  startRun
} from "@gravity/domain";
import { PiRuntimeAdapter } from "../../adapters/src/index.js";

import {
  AuthService,
  AppWorkspaceService,
  MapService,
  ProjectService,
  RunPanelService,
  RunService,
  ThreadPanelService
} from "../src/index.js";
import {
  createFixedClock,
  createInMemoryPersistence,
  createSequentialIdGenerator,
  createStubFilesystem,
  createStubAuth,
  createStubRuntime
} from "../../testkit/src/index.js";

describe("application bootstrap", () => {
  it("registers a project, selects it, and reports root map presence", async () => {
    const ids = createSequentialIdGenerator();
    const filesystem = createStubFilesystem(["C:/gravity/AGENTS.md"]);
    const mapService = new MapService(filesystem);
    const projects = new ProjectService(
      ids,
      filesystem,
      mapService,
      createInMemoryPersistence()
    );

    const state = await projects.register("C:/gravity");

    expect(state.selectedProjectId).toBe("project-1");
    expect(state.projects).toHaveLength(1);
    expect(state.projects[0]?.project.rootPath).toBe("C:/gravity");
    expect(state.projects[0]?.project.displayName).toBe("gravity");
    expect(state.projects[0]?.hasRootMap).toBe(true);
    expect(state.projects[0]?.pathStatus).toBe("ready");
  });

  it("renames, switches, and forgets projects without touching disk paths", async () => {
    const filesystem = createStubFilesystem([]);
    const projects = new ProjectService(
      createSequentialIdGenerator(),
      filesystem,
      new MapService(filesystem),
      createInMemoryPersistence()
    );

    await projects.register("C:/gravity");
    await projects.register("C:/gravity-docs");

    let state = await projects.rename("project-2", "Docs");
    expect(state.projects[1]?.project.displayName).toBe("Docs");

    state = await projects.select("project-2");
    expect(state.selectedProjectId).toBe("project-2");

    state = await projects.remove("project-2");
    expect(state.selectedProjectId).toBe("project-1");
    expect(state.projects.map((entry) => entry.project.id)).toEqual([
      "project-1"
    ]);
    expect(state.projects[0]?.project.rootPath).toBe("C:/gravity");
  });

  it("reports missing paths without blocking registration", async () => {
    const filesystem = createStubFilesystem([]);
    const projects = new ProjectService(
      createSequentialIdGenerator(),
      filesystem,
      new MapService(filesystem),
      createInMemoryPersistence()
    );

    const state = await projects.register("C:/missing");

    expect(state.projects[0]?.pathStatus).toBe("missing");
    expect(state.projects[0]?.hasRootMap).toBe(false);
  });

  it("keeps unavailable project history browsable, blocks execution, and restores it after reattachment", async () => {
    const persistence = createInMemoryPersistence({
      projects: [
        createProject({
          id: "project-1",
          displayName: "Gravity",
          rootPath: "C:/missing-gravity"
        })
      ],
      runThreads: [
        createProjectThread({
          createdAt: "2026-05-02T19:00:00.000Z",
          id: "run_thread-legacy-1",
          projectId: "project-1",
          title: "Recovered thread"
        })
      ],
      runs: [
        completeRun({
          completedAt: "2026-05-02T19:20:00.000Z",
          run: startRun({
            id: "run-1",
            projectId: "project-1",
            prompt: "Inspect prior work",
            runNumber: 1,
            threadId: "run_thread-legacy-1",
            startedAt: "2026-05-02T19:05:00.000Z"
          }),
          status: "completed"
        })
      ]
    });
    const filesystem = createStubFilesystem([
      "C:/reattached-gravity/AGENTS.md"
    ]);
    const clock = createFixedClock("2026-05-02T20:00:00.000Z");
    const ids = createSequentialIdGenerator();
    const projects = new ProjectService(
      ids,
      filesystem,
      new MapService(filesystem),
      persistence
    );
    const runtime = createStubRuntime();
    const runPanel = new RunPanelService(
      clock,
      ids,
      persistence,
      runtime,
      new RunService(clock, ids, persistence, runtime),
      filesystem
    );

    const unavailableProjects = await projects.hydrate();
    const unavailableHistory = await runPanel.hydrate("project-1");

    expect(unavailableProjects.projects[0]?.pathStatus).toBe("missing");
    expect(unavailableHistory.runThreads[0]?.runThread.title).toBe(
      "Recovered thread"
    );
    await expect(runPanel.createProjectThread("project-1")).rejects.toThrow(
      "Project context is unavailable. Reattach it before starting new execution."
    );

    const reattachedProjects = await projects.reattach(
      "project-1",
      "C:/reattached-gravity"
    );
    const reattachedThreadState =
      await runPanel.createProjectThread("project-1");
    const resumedRun = await runPanel.startRun({
      projectId: "project-1",
      prompt: "Resume execution",
      threadId: reattachedThreadState.runThreads[1]!.runThread.id
    });

    expect(reattachedProjects.projects[0]?.pathStatus).toBe("ready");
    expect(reattachedProjects.projects[0]?.project.rootPath).toBe(
      "C:/reattached-gravity"
    );
    expect(resumedRun.run.runNumber).toBe(1);
  });

  it("supports the canonical project, thread, and run model through public APIs", async () => {
    const persistence = createInMemoryPersistence({
      projects: [
        createProject({
          id: "project-1",
          displayName: "Gravity",
          rootPath: "C:/gravity"
        })
      ],
      appMetadata: {
        selectedProjectId: "project-1"
      }
    });
    const filesystem = createStubFilesystem(["C:/gravity/AGENTS.md"]);
    const clock = createFixedClock("2026-05-02T20:00:00.000Z");
    const ids = createSequentialIdGenerator();
    const mapService = new MapService(filesystem, persistence);
    const projects = new ProjectService(
      ids,
      filesystem,
      mapService,
      persistence
    );
    const threadPanel = new ThreadPanelService(clock, ids, persistence);
    const runService = new RunService(
      clock,
      ids,
      persistence,
      createStubRuntime()
    );
    const runPanel = new RunPanelService(
      clock,
      ids,
      persistence,
      createStubRuntime(),
      runService
    );

    const projectState = await projects.hydrate();
    expect(projectState.selectedProjectId).toBe("project-1");
    expect(projectState.projects[0]?.project).toMatchObject({
      displayName: "Gravity",
      id: "project-1",
      rootPath: "C:/gravity"
    });

    const chatState = await threadPanel.createChatThread();
    expect(chatState.threads[0]?.thread).toMatchObject({
      kind: "chat",
      projectId: null
    });

    const projectThreadState = await runPanel.createProjectThread("project-1");
    const projectThread = projectThreadState.runThreads[0]?.thread;
    expect(projectThread).toMatchObject({
      kind: "project",
      projectId: "project-1"
    });

    const started = await runService.start({
      projectId: "project-1",
      threadId: projectThread!.id,
      runNumber: 1,
      prompt: "Start the harness-first project model"
    });

    expect(started.run).toMatchObject({
      projectId: "project-1",
      threadId: projectThread!.id
    });

    const persistedState = await persistence.loadState();
    expect(persistedState.projects.map((project) => project.id)).toEqual([
      "project-1"
    ]);
    expect(persistedState.threads.map((thread) => thread.id)).toEqual([
      "thread-1",
      "run_thread-1"
    ]);
  });

  it("upgrades a chat thread into its selected project without duplicating continuity", async () => {
    const persistence = createInMemoryPersistence({
      projects: [
        createProject({
          id: "project-1",
          displayName: "Gravity",
          rootPath: "C:/gravity"
        })
      ]
    });
    const filesystem = createStubFilesystem(["C:/gravity/AGENTS.md"]);
    const clock = createFixedClock("2026-05-05T12:00:00.000Z");
    const ids = createSequentialIdGenerator();
    const threadPanel = new ThreadPanelService(clock, ids, persistence);
    const runPanel = new RunPanelService(
      clock,
      ids,
      persistence,
      createStubRuntime(),
      new RunService(clock, ids, persistence, createStubRuntime()),
      filesystem
    );

    const chatState = await threadPanel.createChatThread();
    const chatThreadId = chatState.activeThreadId!;
    await threadPanel.sendMessage({
      content: "Keep this conversation when I attach the project.",
      threadId: chatThreadId
    });

    const upgradedProjectState = await runPanel.upgradeChatThreadToProject({
      projectId: "project-1",
      threadId: chatThreadId
    });
    const chatNavigationState = await threadPanel.hydrate(chatThreadId);
    const persistedState = await persistence.loadState();

    expect(upgradedProjectState.runThreads).toHaveLength(1);
    expect(upgradedProjectState.runThreads[0]?.runThread).toMatchObject({
      projectId: "project-1",
      id: chatThreadId,
      kind: "project"
    });
    expect(chatNavigationState.threads).toHaveLength(0);
    expect(
      persistedState.threadMessages.map((message) => message.threadId)
    ).toEqual([chatThreadId, chatThreadId]);
    expect(persistedState.runThreads.map((thread) => thread.id)).toEqual([
      chatThreadId
    ]);
  });

  it("hydrates a coherent workspace snapshot across chat and ready project threads", async () => {
    const persistence = createInMemoryPersistence({
      projects: [
        createProject({
          id: "project-1",
          displayName: "Gravity",
          rootPath: "C:/gravity"
        }),
        createProject({
          id: "project-2",
          displayName: "Missing",
          rootPath: "C:/missing"
        })
      ],
      appMetadata: {
        selectedProjectId: "project-1"
      }
    });
    const filesystem = createStubFilesystem(["C:/gravity/AGENTS.md"]);
    const clock = createFixedClock("2026-05-05T12:00:00.000Z");
    const ids = createSequentialIdGenerator();
    const runtime = createStubRuntime();
    const workspace = new AppWorkspaceService({
      projects: new ProjectService(
        ids,
        filesystem,
        new MapService(filesystem),
        persistence
      ),
      runPanel: new RunPanelService(
        clock,
        ids,
        persistence,
        runtime,
        new RunService(clock, ids, persistence, runtime),
        filesystem
      ),
      threadPanel: new ThreadPanelService(clock, ids, persistence)
    });

    await workspace.execute({
      type: "createProjectThread",
      projectId: "project-1"
    });
    const state = await workspace.hydrate();

    expect(state.selectedProjectId).toBe("project-1");
    expect(Object.keys(state.projectThreadsByProjectId)).toEqual(["project-1"]);
    expect(state.activeThread).toMatchObject({
      kind: "project",
      projectId: "project-1",
      record: {
        runThread: {
          kind: "project",
          projectId: "project-1"
        }
      }
    });
    expect(
      state.threadExecutionStatusByThreadId[
        state.activeThread?.record.runThread.id ?? ""
      ]
    ).toMatchObject({
      currentTurnId: null,
      status: "idle",
      threadId: state.activeThread?.record.runThread.id
    });
    expect(
      state.projects.projects.map((project) => project.project.id)
    ).toEqual(["project-1", "project-2"]);
  });

  it("opens a project thread from another project by selecting its owner", async () => {
    const persistence = createInMemoryPersistence({
      projects: [
        createProject({
          id: "project-1",
          displayName: "Gravity",
          rootPath: "C:/gravity"
        }),
        createProject({
          id: "project-2",
          displayName: "Docs",
          rootPath: "C:/docs"
        })
      ],
      appMetadata: {
        selectedProjectId: "project-1"
      }
    });
    const filesystem = createStubFilesystem([
      "C:/gravity/AGENTS.md",
      "C:/docs/AGENTS.md"
    ]);
    const clock = createFixedClock("2026-05-05T12:00:00.000Z");
    const ids = createSequentialIdGenerator();
    const runtime = createStubRuntime();
    const workspace = new AppWorkspaceService({
      projects: new ProjectService(
        ids,
        filesystem,
        new MapService(filesystem),
        persistence
      ),
      runPanel: new RunPanelService(
        clock,
        ids,
        persistence,
        runtime,
        new RunService(clock, ids, persistence, runtime),
        filesystem
      ),
      threadPanel: new ThreadPanelService(clock, ids, persistence)
    });

    const created = await workspace.execute({
      type: "createProjectThread",
      projectId: "project-2"
    });
    const threadId = created.activeThread!.record.runThread.id;
    const opened = await workspace.execute({ type: "openThread", threadId });

    expect(opened.selectedProjectId).toBe("project-2");
    expect(opened.activeThread).toEqual({
      kind: "project",
      projectId: "project-2",
      record: opened.projectThreadsByProjectId["project-2"]?.[0]
    });
    expect(opened.chatThreads.activeThreadId).toBeNull();
  });

  it("exposes project thread execution status through workspace state", async () => {
    const persistence = createInMemoryPersistence({
      projects: [
        createProject({
          id: "project-1",
          displayName: "Gravity",
          rootPath: "C:/gravity"
        })
      ],
      appMetadata: {
        selectedProjectId: "project-1"
      }
    });
    const filesystem = createStubFilesystem(["C:/gravity/AGENTS.md"]);
    const clock = createFixedClock("2026-05-05T12:00:00.000Z");
    const ids = createSequentialIdGenerator();
    const runtime = createStubRuntime();
    const runService = new RunService(clock, ids, persistence, runtime);
    const runPanel = new RunPanelService(
      clock,
      ids,
      persistence,
      runtime,
      runService,
      filesystem
    );
    const threadPanel = new ThreadPanelService(clock, ids, persistence);
    const workspace = new AppWorkspaceService({
      projects: new ProjectService(
        ids,
        filesystem,
        new MapService(filesystem),
        persistence
      ),
      runPanel,
      threadPanel
    });

    const created = await workspace.execute({
      type: "createProjectThread",
      projectId: "project-1"
    });
    const threadId = created.activeThread!.record.runThread.id;
    const started = await runPanel.startRun({
      projectId: "project-1",
      prompt: "Inspect the selected project",
      threadId
    });
    const hydrated = await workspace.hydrate({ openThreadId: threadId });

    expect(hydrated.activeThread).toMatchObject({
      kind: "project",
      projectId: "project-1",
      record: {
        runThread: {
          id: threadId
        }
      }
    });
    expect(hydrated.threadExecutionStatusByThreadId[threadId]).toEqual({
      currentTurnId: started.run.id,
      status: "in_progress",
      threadId
    });
    expect(hydrated.turnExecutionStatusByTurnId[started.run.id]).toEqual({
      kind: "project",
      status: "in_progress",
      threadId,
      turnId: started.run.id
    });
  });

  it("derives chat turn execution status from the active assistant placeholder", async () => {
    const persistence = createInMemoryPersistence();
    const clock = createFixedClock("2026-05-05T12:00:00.000Z");
    const ids = createSequentialIdGenerator();
    const filesystem = createStubFilesystem([]);
    const threadPanel = new ThreadPanelService(clock, ids, persistence, {
      async startThreadTurn() {
        return { streamId: "conversation-stream-1" };
      }
    });
    const workspace = new AppWorkspaceService({
      projects: new ProjectService(
        ids,
        filesystem,
        new MapService(filesystem),
        persistence
      ),
      runPanel: new RunPanelService(
        clock,
        ids,
        persistence,
        createStubRuntime(),
        new RunService(clock, ids, persistence, createStubRuntime()),
        filesystem
      ),
      threadPanel
    });

    const created = await threadPanel.createConversationThread();
    const threadId = created.activeThreadId!;
    await threadPanel.sendMessage({
      content: "Design the new thread surface",
      threadId
    });
    const hydrated = await workspace.hydrate({ openThreadId: threadId });
    const turnId =
      hydrated.activeThread?.kind === "chat"
        ? hydrated.activeThread.record.messages.at(-1)?.id
        : null;

    expect(hydrated.activeThread).toMatchObject({
      kind: "chat",
      record: {
        runThread: {
          id: threadId
        }
      }
    });
    expect(hydrated.threadExecutionStatusByThreadId[threadId]).toEqual({
      currentTurnId: turnId,
      status: "in_progress",
      threadId
    });
    expect(turnId).not.toBeNull();
    expect(hydrated.turnExecutionStatusByTurnId[turnId!]).toEqual({
      kind: "chat",
      status: "in_progress",
      threadId,
      turnId
    });
  });

  it("hydrates persisted projects and selection from storage", async () => {
    const filesystem = createStubFilesystem(["C:/gravity/AGENTS.md"]);
    const persistence = createInMemoryPersistence({
      projects: [
        createProject({
          id: "project-1",
          displayName: "Gravity",
          rootPath: "C:/gravity",
          roleAssignments: [{ path: "C:/gravity/docs", role: "context_source" }]
        }),
        createProject({
          id: "project-2",
          displayName: "Drafts",
          rootPath: "C:/drafts"
        })
      ],
      appMetadata: {
        selectedProjectId: "project-2"
      }
    });
    const projects = new ProjectService(
      createSequentialIdGenerator(),
      filesystem,
      new MapService(filesystem),
      persistence
    );

    const state = await projects.hydrate();

    expect(state.selectedProjectId).toBe("project-2");
    expect(state.projects.map((entry) => entry.project.id)).toEqual([
      "project-1",
      "project-2"
    ]);
    expect(state.projects[0]?.hasRootMap).toBe(true);
    expect(state.projects[0]?.project.roleAssignments).toEqual([
      { path: "C:/gravity/docs", role: "context_source" }
    ]);
    expect(state.projects[1]?.pathStatus).toBe("missing");
  });

  it("hydrates sanitized provider auth state and trims API key updates", async () => {
    const auth = createStubAuth({
      providers: [
        {
          displayName: "OpenAI",
          providerId: "openai",
          status: {
            configured: false
          },
          supportsApiKey: true,
          supportsOAuth: false
        },
        {
          displayName: "GitHub Copilot",
          providerId: "github-copilot",
          status: {
            configured: true,
            source: "stored"
          },
          supportsApiKey: true,
          supportsOAuth: true
        }
      ]
    });
    const service = new AuthService(auth);

    const initialState = await service.hydrate();

    expect(
      initialState.providers.map((provider) => provider.providerId)
    ).toEqual(["github-copilot", "openai"]);
    expect(initialState.providers[1]?.status.configured).toBe(false);

    const updatedState = await service.saveApiKey({
      apiKey: "  sk-openai-123  ",
      providerId: "openai"
    });

    expect(
      updatedState.providers.find(
        (provider) => provider.providerId === "openai"
      )
    ).toMatchObject({
      status: {
        configured: true,
        source: "stored"
      }
    });
    expect(auth.apiKeyUpdates).toEqual([
      {
        apiKey: "sk-openai-123",
        providerId: "openai"
      }
    ]);
  });

  it("rejects blank API key submissions before they reach the auth port", async () => {
    const auth = createStubAuth({
      providers: [
        {
          displayName: "OpenAI",
          providerId: "openai",
          status: {
            configured: false
          },
          supportsApiKey: true,
          supportsOAuth: false
        }
      ]
    });
    const service = new AuthService(auth);

    await expect(
      service.saveApiKey({
        apiKey: "   ",
        providerId: "openai"
      })
    ).rejects.toThrow("API key is required.");
    expect(auth.apiKeyUpdates).toEqual([]);
  });

  it("persists conversation threads, messages, and first-prompt titles", async () => {
    const persistence = createInMemoryPersistence();
    const service = new ThreadPanelService(
      createFixedClock("2026-05-02T20:00:00.000Z"),
      createSequentialIdGenerator(),
      persistence
    );

    const created = await service.createConversationThread();
    const threadId = created.activeThreadId;

    expect(threadId).toBe("thread-1");
    expect(created.threads[0]?.runThread).toMatchObject({
      projectId: null,
      kind: "conversation",
      title: "New thread"
    });

    const updated = await service.sendMessage({
      content: "Design the new thread surface",
      threadId: threadId!
    });

    expect(updated.threads[0]?.runThread.title).toBe(
      "Design the new thread surface"
    );
    expect(updated.threads[0]?.messages.map((message) => message.role)).toEqual(
      ["user", "assistant"]
    );
    expect((await persistence.loadState()).threadMessages).toHaveLength(2);
  });

  it("streams pi conversation output into the assistant thread message", async () => {
    const persistence = createInMemoryPersistence();
    const service = new ThreadPanelService(
      createFixedClock("2026-05-02T20:00:00.000Z"),
      createSequentialIdGenerator(),
      persistence,
      {
        async startThreadTurn(input) {
          expect(input.projectId).toBeNull();
          await input.onDelta("Hello ");
          await input.onDelta("from Pi.");
          await input.onComplete("Hello from Pi.");
          return { streamId: "conversation-stream-1" };
        }
      }
    );

    const created = await service.createConversationThread();
    const updated = await service.sendMessage({
      content: "Introduce yourself",
      threadId: created.activeThreadId!
    });

    expect(updated.threads[0]?.messages.map((message) => message.role)).toEqual(
      ["user", "assistant"]
    );
    expect(updated.threads[0]?.messages).toMatchObject([
      {
        content: "Introduce yourself",
        role: "user"
      },
      {
        role: "assistant"
      }
    ]);

    const hydrated = await service.hydrate(created.activeThreadId);
    expect(hydrated.threads[0]?.messages.at(-1)).toMatchObject({
      content: "Hello from Pi.",
      role: "assistant"
    });
  });

  it("starts project work through the thread panel while preserving thread messages", async () => {
    const persistence = createInMemoryPersistence({
      projects: [
        createProject({
          id: "project-1",
          displayName: "Gravity",
          rootPath: "C:/gravity"
        })
      ],
      runThreads: [
        createProjectThread({
          createdAt: "2026-05-05T12:00:00.000Z",
          id: "thread-1",
          projectId: "project-1",
          title: "Project thread"
        })
      ]
    });
    const filesystem = createStubFilesystem(["C:/gravity/AGENTS.md"]);
    const clock = createFixedClock("2026-05-05T12:05:00.000Z");
    const ids = createSequentialIdGenerator();
    const runtime = createStubRuntime();
    const service = new ThreadPanelService(clock, ids, persistence, undefined, {
      filesystem,
      runService: new RunService(clock, ids, persistence, runtime)
    });

    await service.sendMessage({
      content: "Inspect the selected project",
      threadId: "thread-1"
    });

    const persistedState = await persistence.loadState();
    expect(persistedState.threadMessages).toMatchObject([
      {
        content: "Inspect the selected project",
        role: "user",
        threadId: "thread-1"
      },
      {
        content: "",
        role: "assistant",
        threadId: "thread-1"
      }
    ]);
    expect(persistedState.runs).toMatchObject([
      {
        projectId: "project-1",
        prompt: "Inspect the selected project",
        threadId: "thread-1"
      }
    ]);
    await service.completeRunMessage({
      content: "Project inspection complete.",
      runId: persistedState.runs[0]!.id
    });

    expect((await persistence.loadState()).threadMessages.at(-1)).toMatchObject(
      {
        content: "Project inspection complete.",
        role: "assistant",
        threadId: "thread-1"
      }
    );
  });

  it("moves chat and project threads into a shared trash bin and hides them from active history", async () => {
    const persistence = createInMemoryPersistence({
      projects: [
        createProject({
          id: "project-1",
          displayName: "Gravity",
          rootPath: "C:/gravity"
        })
      ]
    });
    const clock = createFixedClock("2026-05-03T12:00:00.000Z");
    const ids = createSequentialIdGenerator();
    const runService = new RunService(
      clock,
      ids,
      persistence,
      createStubRuntime()
    );
    const runPanel = new RunPanelService(
      clock,
      ids,
      persistence,
      createStubRuntime(),
      runService
    );
    const threadPanel = new ThreadPanelService(
      clock,
      ids,
      persistence,
      undefined,
      { runService }
    );

    const chatThreadState = await threadPanel.createChatThread();
    const projectThreadState = await runPanel.createProjectThread("project-1");
    const chatThreadId = chatThreadState.activeThreadId!;
    const projectThreadId = projectThreadState.runThreads[0]!.thread.id;

    await threadPanel.sendMessage({
      content: "Keep this detached discussion recoverable.",
      threadId: chatThreadId
    });
    const projectRun = await runPanel.startRun({
      projectId: "project-1",
      prompt:
        "Produce project history that should disappear from active views.",
      threadId: projectThreadId
    });
    await runPanel.completeRun({
      artifactPaths: ["C:/gravity/output/report.md"],
      content: "Completed project work.",
      runId: projectRun.run.id
    });

    const trashedChatState = await threadPanel.trashThread(chatThreadId);

    expect(
      trashedChatState.threads.some(
        (thread) => thread.thread.id === chatThreadId
      )
    ).toBe(false);
    expect(trashedChatState.trashedThreads).toMatchObject([
      {
        runThread: {
          id: chatThreadId
        }
      }
    ]);

    const trashedProjectState = await threadPanel.trashThread(projectThreadId);
    const projectPanelAfterTrash = await runPanel.hydrate("project-1");

    expect(
      trashedProjectState.threads.some(
        (thread) => thread.thread.id === projectThreadId
      )
    ).toBe(false);
    expect(
      trashedProjectState.trashedThreads.map((thread) => thread.runThread.id)
    ).toEqual([chatThreadId, projectThreadId]);
    expect(projectPanelAfterTrash.runThreads).toHaveLength(0);
  });

  it("restores trashed threads before the recovery deadline and permanently deletes remaining trash", async () => {
    const persistence = createInMemoryPersistence({
      projects: [
        createProject({
          id: "project-1",
          displayName: "Gravity",
          rootPath: "C:/gravity"
        })
      ]
    });
    const ids = createSequentialIdGenerator();
    const trashedAtClock = createFixedClock("2026-05-03T12:00:00.000Z");
    const threadPanel = new ThreadPanelService(
      trashedAtClock,
      ids,
      persistence
    );
    const runService = new RunService(
      trashedAtClock,
      ids,
      persistence,
      createStubRuntime()
    );
    const runPanel = new RunPanelService(
      trashedAtClock,
      ids,
      persistence,
      createStubRuntime(),
      runService
    );

    const chatThreadState = await threadPanel.createChatThread();
    const projectThreadState = await runPanel.createProjectThread("project-1");
    const chatThreadId = chatThreadState.activeThreadId!;
    const projectThreadId = projectThreadState.runThreads[0]!.thread.id;

    await threadPanel.sendMessage({
      content: "Recover this chat if needed.",
      threadId: chatThreadId
    });
    const chatRun = await runService.start({
      prompt: "Track detached work so empty trash has data to remove.",
      runNumber: 1,
      threadId: chatThreadId
    });
    await runPanel.completeRun({
      artifactPaths: [],
      content: "Detached work complete.",
      runId: chatRun.run.id
    });

    await threadPanel.trashThread(chatThreadId);
    const trashedState = await threadPanel.trashThread(projectThreadId);

    expect(trashedState.trashedThreads).toMatchObject([
      {
        restorableUntil: "2026-06-02T12:00:00.000Z",
        runThread: { id: chatThreadId }
      },
      {
        restorableUntil: "2026-06-02T12:00:00.000Z",
        runThread: { id: projectThreadId }
      }
    ]);

    const restoreClock = createFixedClock("2026-05-20T09:00:00.000Z");
    const restoreThreadPanel = new ThreadPanelService(
      restoreClock,
      ids,
      persistence
    );
    const restoredState =
      await restoreThreadPanel.restoreThread(projectThreadId);
    const restoredRunPanel = await runPanel.hydrate("project-1");

    expect(
      restoredRunPanel.runThreads.some(
        (thread) => thread.runThread.id === projectThreadId
      )
    ).toBe(true);
    expect(
      restoredState.threads.map((thread) => thread.thread.id)
    ).not.toContain(projectThreadId);
    expect(
      restoredState.trashedThreads.map((thread) => thread.runThread.id)
    ).toEqual([chatThreadId]);

    const emptiedState = await restoreThreadPanel.emptyTrash();
    const persistedState = await persistence.loadState();

    expect(emptiedState.trashedThreads).toEqual([]);
    expect(
      persistedState.runThreads.some((thread) => thread.id === chatThreadId)
    ).toBe(false);
    expect(
      persistedState.runs.some((run) => run.threadId === chatThreadId)
    ).toBe(false);
    expect(
      persistedState.runResults.some(
        (result) => result.runId === chatRun.run.id
      )
    ).toBe(false);
  });

  it("restores trashed project threads into unavailable projects without restoring executability", async () => {
    const persistence = createInMemoryPersistence({
      projects: [
        createProject({
          id: "project-1",
          displayName: "Gravity",
          rootPath: "C:/missing-gravity"
        })
      ],
      runThreads: [
        createProjectThread({
          createdAt: "2026-05-03T10:00:00.000Z",
          id: "run_thread-legacy-1",
          projectId: "project-1",
          title: "Recovered project thread"
        })
      ],
      runs: [
        completeRun({
          completedAt: "2026-05-03T10:15:00.000Z",
          run: startRun({
            id: "run-1",
            projectId: "project-1",
            prompt: "Keep this project history visible after restore.",
            runNumber: 1,
            threadId: "run_thread-legacy-1",
            startedAt: "2026-05-03T10:05:00.000Z"
          }),
          status: "completed"
        })
      ]
    });
    const filesystem = createStubFilesystem([]);
    const clock = createFixedClock("2026-05-20T09:00:00.000Z");
    const ids = createSequentialIdGenerator();
    const projects = new ProjectService(
      ids,
      filesystem,
      new MapService(filesystem),
      persistence
    );
    const threadPanel = new ThreadPanelService(clock, ids, persistence);
    const runtime = createStubRuntime();
    const runPanel = new RunPanelService(
      clock,
      ids,
      persistence,
      runtime,
      new RunService(clock, ids, persistence, runtime),
      filesystem
    );

    await threadPanel.trashThread("run_thread-legacy-1");
    const restoredState = await threadPanel.restoreThread(
      "run_thread-legacy-1"
    );
    const unavailableProjects = await projects.hydrate();
    const restoredProjectHistory = await runPanel.hydrate("project-1");

    expect(
      restoredState.trashedThreads.map((thread) => thread.runThread.id)
    ).toEqual([]);
    expect(unavailableProjects.projects[0]?.pathStatus).toBe("missing");
    expect(restoredProjectHistory.runThreads).toMatchObject([
      {
        runThread: {
          id: "run_thread-legacy-1",
          projectId: "project-1",
          title: "Recovered project thread"
        },
        runs: [
          {
            run: {
              id: "run-1",
              projectId: "project-1"
            }
          }
        ]
      }
    ]);
    await expect(runPanel.createProjectThread("project-1")).rejects.toThrow(
      "Project context is unavailable. Reattach it before starting new execution."
    );
  });

  it("keeps chat turns separate while project thread messages start tracked runs", async () => {
    const persistence = createInMemoryPersistence({
      projects: [
        createProject({
          id: "project-1",
          displayName: "Gravity",
          rootPath: "C:/gravity"
        })
      ]
    });
    const clock = createFixedClock("2026-05-03T12:00:00.000Z");
    const ids = createSequentialIdGenerator();
    const runService = new RunService(
      clock,
      ids,
      persistence,
      createStubRuntime()
    );
    const runPanel = new RunPanelService(
      clock,
      ids,
      persistence,
      createStubRuntime(),
      runService
    );
    const threadPanel = new ThreadPanelService(
      clock,
      ids,
      persistence,
      undefined,
      { runService }
    );

    const chatThreadState = await threadPanel.createChatThread();
    const chatThreadId = chatThreadState.activeThreadId!;
    const projectThreadState = await runPanel.createProjectThread("project-1");
    const projectThreadId = projectThreadState.runThreads[0]!.thread.id;

    await threadPanel.sendMessage({
      content: "Let's discuss the migration plan before we run anything.",
      threadId: chatThreadId
    });
    await threadPanel.sendMessage({
      content: "Review the project approach before execution.",
      threadId: projectThreadId
    });

    let threadState = await threadPanel.hydrate();
    let projectThreadPanelState = await runPanel.hydrate("project-1");
    expect(
      threadState.threads.find((thread) => thread.thread.id === chatThreadId)
        ?.runs
    ).toHaveLength(0);
    expect(
      projectThreadPanelState.runThreads.find(
        (thread) => thread.thread.id === projectThreadId
      )?.runs
    ).toHaveLength(1);

    const chatRun = await runService.start({
      prompt: "Search the docs and summarize the runtime options.",
      runNumber: 1,
      threadId: chatThreadId
    });

    await runPanel.recordAgentActivity({
      kind: "command",
      runId: chatRun.run.id,
      status: "completed",
      text: "Ran web research for runtime options."
    });
    await runPanel.completeRun({
      artifactPaths: [],
      content: "Summarized runtime options.",
      runId: chatRun.run.id
    });

    threadState = await threadPanel.hydrate();
    projectThreadPanelState = await runPanel.hydrate("project-1");
    const projectRun =
      projectThreadPanelState.runThreads.find(
        (thread) => thread.thread.id === projectThreadId
      )?.runs[0]?.run ?? null;

    expect(projectRun).not.toBeNull();
    expect(
      threadState.threads.find((thread) => thread.thread.id === chatThreadId)
        ?.runs[0]?.runResult
    ).toMatchObject({
      content: "Summarized runtime options.",
      status: "completed"
    });
    expect(
      projectThreadPanelState.runThreads.find(
        (thread) => thread.thread.id === projectThreadId
      )?.runs[0]?.run.projectId
    ).toBe("project-1");
  });

  it("creates a run, initial run result, and prompt activity without creating a trace", async () => {
    const persistence = createInMemoryPersistence();
    const service = new RunService(
      createFixedClock("2026-04-22T20:10:00.000Z"),
      createSequentialIdGenerator(),
      persistence,
      createStubRuntime()
    );

    const result = await service.start({
      projectId: "project-1",
      threadId: "thread-1",
      runNumber: 1,
      prompt: "Start the first run"
    });

    expect(result.run.status).toBe("in_progress");
    expect(result.runResult.status).toBe("pending");
    expect(result.runResult.failureMessage).toBeNull();
    expect(result.agentActivityItems).toEqual([
      {
        completedAt: "2026-04-22T20:10:00.000Z",
        id: "agent_activity-1",
        kind: "prompt",
        pathAssociations: [],
        runId: result.run.id,
        sequence: 1,
        startedAt: "2026-04-22T20:10:00.000Z",
        status: "completed",
        text: "Start the first run"
      }
    ]);
    expect(result).not.toHaveProperty("trace");
    expect(await persistence.getRun(result.run.id)).not.toBeNull();
    expect((await persistence.loadState()).runResults).toEqual([
      result.runResult
    ]);
    expect((await persistence.loadState()).agentActivityItems).toEqual(
      result.agentActivityItems
    );
  });

  it("loads and saves a root map draft explicitly", async () => {
    const rootPath = process.platform === "win32" ? "C:/gravity" : "/gravity";
    const filesystem = createStubFilesystem([]);
    await filesystem.createDirectory(rootPath);
    const persistence = createInMemoryPersistence();
    const mapService = new MapService(filesystem, persistence);

    const initialDraft = await mapService.loadDraft({
      projectId: "project-1",
      rootPath
    });

    expect(initialDraft.actionLabel).toBe("Create Root Map");
    expect(initialDraft.isRoot).toBe(true);
    expect(initialDraft.content).toContain("## Purpose");

    const savedDraft = await mapService.saveDraft({
      content: "# AGENTS.md\n\n## Purpose\nKeep Gravity tidy.",
      projectId: "project-1",
      rootPath
    });

    expect(savedDraft.actionLabel).toBe("Edit Root Map");
    expect(savedDraft.content).toContain("Keep Gravity tidy.");
    expect(await filesystem.readFile(`${rootPath}/AGENTS.md`)).toContain(
      "Keep Gravity tidy."
    );
  });

  it("uses nested-map labels for targeted folders", async () => {
    const rootPath = process.platform === "win32" ? "C:/gravity" : "/gravity";
    const docsPath = `${rootPath}/docs`;
    const filesystem = createStubFilesystem([]);
    await filesystem.createDirectory(rootPath);
    await filesystem.createDirectory(docsPath);
    const mapService = new MapService(filesystem, createInMemoryPersistence());

    const firstDraft = await mapService.loadDraft({
      projectId: "project-1",
      rootPath,
      targetFolderPath: docsPath
    });

    expect(firstDraft.actionLabel).toBe("Add Nested Map");
    expect(firstDraft.isRoot).toBe(false);

    await mapService.saveDraft({
      content: "# AGENTS.md\n\n## Scope\nDocs only.",
      projectId: "project-1",
      rootPath,
      targetFolderPath: docsPath
    });

    const secondDraft = await mapService.loadDraft({
      projectId: "project-1",
      rootPath,
      targetFolderPath: docsPath
    });

    expect(secondDraft.actionLabel).toBe("Edit Nested Map");
    expect(secondDraft.content).toContain("Docs only.");
  });

  it("resolves relative nested map targets under the project root", async () => {
    const rootPath = process.platform === "win32" ? "C:/gravity" : "/gravity";
    const docsPath = `${rootPath}/docs`;
    const filesystem = createStubFilesystem([]);
    await filesystem.createDirectory(rootPath);
    await filesystem.createDirectory(docsPath);
    const mapService = new MapService(filesystem, createInMemoryPersistence());

    const draft = await mapService.loadDraft({
      projectId: "project-1",
      rootPath,
      targetFolderPath: "docs"
    });

    expect(draft.actionLabel).toBe("Add Nested Map");
    expect(draft.documentPath).toBe(
      process.platform === "win32"
        ? "C:\\gravity\\docs\\AGENTS.md"
        : "/gravity/docs/AGENTS.md"
    );
    expect(draft.isRoot).toBe(false);
    expect(draft.targetFolderPath).toBe(
      process.platform === "win32" ? "C:\\gravity\\docs" : "/gravity/docs"
    );
  });

  it("rejects nested map targets outside the project root", async () => {
    const filesystem = createStubFilesystem([]);
    await filesystem.createDirectory("C:/gravity");
    await filesystem.createDirectory("C:/outside");
    const mapService = new MapService(filesystem, createInMemoryPersistence());

    await expect(
      mapService.loadDraft({
        projectId: "project-1",
        rootPath: "C:/gravity",
        targetFolderPath: "../outside"
      })
    ).rejects.toThrow("Nested map targets must stay within the Project.");
  });

  it("disables map editing while a run is active for the project", async () => {
    const rootPath = process.platform === "win32" ? "C:/gravity" : "/gravity";
    const filesystem = createStubFilesystem([]);
    await filesystem.createDirectory(rootPath);
    const persistence = createInMemoryPersistence({
      runs: [
        startRun({
          id: "run-1",
          projectId: "project-1",
          threadId: "thread-1",
          runNumber: 1,
          prompt: "Work in progress",
          startedAt: "2026-04-25T18:00:00.000Z"
        })
      ]
    });
    const mapService = new MapService(filesystem, persistence);

    const draft = await mapService.loadDraft({
      projectId: "project-1",
      rootPath
    });

    expect(draft.isEditingLocked).toBe(true);
    await expect(
      mapService.saveDraft({
        content: "# AGENTS.md",
        projectId: "project-1",
        rootPath
      })
    ).rejects.toThrow("Map editing is disabled while a Run is active.");
  });

  it("creates run threads with deterministic default titles and hydrates them", async () => {
    const persistence = createInMemoryPersistence();
    const runPanel = new RunPanelService(
      createFixedClock("2026-04-25T18:00:00.000Z"),
      createSequentialIdGenerator(),
      persistence,
      createStubRuntime(),
      new RunService(
        createFixedClock("2026-04-25T18:00:00.000Z"),
        createSequentialIdGenerator(),
        persistence,
        createStubRuntime()
      )
    );

    await runPanel.createThread("project-1");
    const state = await runPanel.createThread("project-1");

    expect(state.runThreads.map((thread) => thread.runThread.title)).toEqual([
      "Thread 1",
      "Thread 2"
    ]);
  });

  it("renames a run thread without crossing folder-system boundaries", async () => {
    const persistence = createInMemoryPersistence();
    const clock = createFixedClock("2026-04-25T18:05:00.000Z");
    const ids = createSequentialIdGenerator();
    const runtime = createStubRuntime();
    const runPanel = new RunPanelService(
      clock,
      ids,
      persistence,
      runtime,
      new RunService(clock, ids, persistence, runtime)
    );

    const firstState = await runPanel.createThread("project-1");
    await runPanel.createThread("project-2");
    const renamedState = await runPanel.renameThread({
      projectId: "project-1",
      threadId: firstState.runThreads[0]!.runThread.id,
      title: "Planning"
    });

    expect(renamedState.runThreads[0]!.runThread.title).toBe("Planning");
    await expect(
      runPanel.renameThread({
        projectId: "project-1",
        threadId: "run_thread-2",
        title: "Cross-folder rename"
      })
    ).rejects.toThrow("Unknown run thread: run_thread-2");
  });

  it("starts runs sequentially within a thread and enforces one active run per project", async () => {
    const persistence = createInMemoryPersistence();
    const clock = createFixedClock("2026-04-25T18:10:00.000Z");
    const ids = createSequentialIdGenerator();
    const runtime = createStubRuntime();
    const runPanel = new RunPanelService(
      clock,
      ids,
      persistence,
      runtime,
      new RunService(clock, ids, persistence, runtime)
    );

    const threadState = await runPanel.createThread("project-1");
    const threadId = threadState.runThreads[0]!.runThread.id;
    const started = await runPanel.startRun({
      projectId: "project-1",
      prompt: "First prompt",
      threadId: threadId
    });

    expect(started.run.runNumber).toBe(1);
    expect(started.runtimeRunId).toBe("runtime-run-1");
    await expect(
      runPanel.startRun({
        projectId: "project-1",
        prompt: "Second prompt",
        threadId: threadId
      })
    ).rejects.toThrow("Only one active Run is allowed per Project.");

    await runPanel.completeRun({
      artifactPaths: ["C:/gravity/.gravity/artifacts/run-1.md"],
      content: "First completed run",
      runId: started.run.id
    });

    const secondRun = await runPanel.startRun({
      projectId: "project-1",
      prompt: "Second prompt after completion",
      threadId: threadId
    });

    expect(secondRun.run.runNumber).toBe(2);
  });

  it("appends ordered agent activity and hydrates it through the run panel", async () => {
    const persistence = createInMemoryPersistence();
    const clock = createFixedClock("2026-04-25T18:15:00.000Z");
    const ids = createSequentialIdGenerator();
    const runtime = createStubRuntime();
    const runPanel = new RunPanelService(
      clock,
      ids,
      persistence,
      runtime,
      new RunService(clock, ids, persistence, runtime)
    );

    const threadState = await runPanel.createThread("project-1");
    const started = await runPanel.startRun({
      projectId: "project-1",
      prompt: "Explain the project",
      threadId: threadState.runThreads[0]!.runThread.id
    });

    await runPanel.recordAgentActivity({
      kind: "reasoning",
      runId: started.run.id,
      status: "completed",
      text: "Inspecting the package layout."
    });
    const state = await runPanel.recordAgentActivity({
      kind: "command",
      output: {
        head: "packages/application",
        tail: "packages/domain",
        truncatedByteCount: 128,
        truncatedLineCount: 6
      },
      pathAssociations: [
        {
          confidence: "high",
          path: "C:/gravity/packages"
        }
      ],
      runId: started.run.id,
      status: "completed",
      text: "Listed workspace packages."
    });

    expect(
      state.runThreads[0]!.latestRun!.agentActivityItems.map((item) => ({
        kind: item.kind,
        sequence: item.sequence,
        text: item.text
      }))
    ).toEqual([
      {
        kind: "prompt",
        sequence: 1,
        text: "Explain the project"
      },
      {
        kind: "reasoning",
        sequence: 2,
        text: "Inspecting the package layout."
      },
      {
        kind: "command",
        sequence: 3,
        text: "Listed workspace packages."
      }
    ]);

    const hydrated = await runPanel.hydrate("project-1");
    expect(hydrated.runThreads[0]!.latestRun!.agentActivityItems[2]).toEqual({
      completedAt: "2026-04-25T18:15:00.000Z",
      id: "agent_activity-3",
      kind: "command",
      output: {
        head: "packages/application",
        tail: "packages/domain",
        truncatedByteCount: 128,
        truncatedLineCount: 6
      },
      pathAssociations: [
        {
          confidence: "high",
          path: "C:/gravity/packages"
        }
      ],
      runId: started.run.id,
      sequence: 3,
      startedAt: "2026-04-25T18:15:00.000Z",
      status: "completed",
      text: "Listed workspace packages."
    });
  });

  it("hydrates run panel activity rows with truncation metadata and path link states", async () => {
    const persistence = createInMemoryPersistence({
      projects: [
        createProject({
          displayName: "Gravity",
          id: "project-1",
          rootPath: "C:/gravity"
        })
      ]
    });
    const filesystem = createStubFilesystem([
      "C:/gravity/packages/application/src/index.ts"
    ]);
    const clock = createFixedClock("2026-04-25T18:16:00.000Z");
    const ids = createSequentialIdGenerator();
    const runtime = createStubRuntime();
    const runPanel = new RunPanelService(
      clock,
      ids,
      persistence,
      runtime,
      new RunService(clock, ids, persistence, runtime),
      filesystem
    );

    await runPanel.createThread("project-1");
    const started = await runPanel.startRun({
      projectId: "project-1",
      prompt: "Inspect app paths",
      threadId: "run_thread-1"
    });

    await runPanel.recordAgentActivity({
      kind: "command",
      output: {
        head: "src/index.ts",
        tail: "src/missing.ts",
        truncatedByteCount: 1024,
        truncatedLineCount: 8
      },
      pathAssociations: [
        {
          confidence: "high",
          path: "C:/gravity/packages/application/src/index.ts"
        },
        {
          confidence: "high",
          path: "C:/gravity/packages/application/src/missing.ts"
        },
        {
          confidence: "medium",
          path: "C:/gravity/packages/application/src/guessed.ts"
        }
      ],
      runId: started.run.id,
      status: "completed",
      text: "Listed application source files."
    });

    const state = await runPanel.hydrate("project-1");
    const commandRow = state.runThreads[0]!.latestRun!.activityRows[1]!;

    expect(commandRow).toMatchObject({
      id: "agent_activity-2",
      kind: "command",
      outputPreview: {
        head: "src/index.ts",
        tail: "src/missing.ts",
        truncatedByteCount: 1024,
        truncatedLineCount: 8,
        wasTruncated: true
      },
      text: "Listed application source files."
    });
    expect(commandRow.pathLinks).toEqual([
      {
        confidence: "high",
        label: "packages/application/src/index.ts",
        path: "C:/gravity/packages/application/src/index.ts",
        status: "ready"
      },
      {
        confidence: "high",
        label: "packages/application/src/missing.ts",
        path: "C:/gravity/packages/application/src/missing.ts",
        status: "missing"
      },
      {
        confidence: "medium",
        label: "packages/application/src/guessed.ts",
        path: "C:/gravity/packages/application/src/guessed.ts",
        reason: "Path association is not confident enough to link.",
        status: "unavailable"
      }
    ]);
  });

  it("coalesces adjacent message fragments into one run panel activity row", async () => {
    const persistence = createInMemoryPersistence({
      projects: [
        createProject({
          displayName: "Gravity",
          id: "project-1",
          rootPath: "C:/gravity"
        })
      ]
    });
    const clock = createFixedClock("2026-04-25T18:17:00.000Z");
    const ids = createSequentialIdGenerator();
    const runtime = createStubRuntime();
    const runPanel = new RunPanelService(
      clock,
      ids,
      persistence,
      runtime,
      new RunService(clock, ids, persistence, runtime)
    );

    await runPanel.createThread("project-1");
    const started = await runPanel.startRun({
      projectId: "project-1",
      prompt: "Create a test file",
      threadId: "run_thread-1"
    });

    for (const text of ["Created", " `", "test", "/testing", ".md", "`"]) {
      await runPanel.recordAgentActivity({
        kind: "message",
        runId: started.run.id,
        status: "completed",
        text
      });
    }

    const state = await runPanel.hydrate("project-1");

    expect(
      state.runThreads[0]!.latestRun!.agentActivityItems.map(
        (item) => item.text
      )
    ).toEqual([
      "Create a test file",
      "Created",
      " `",
      "test",
      "/testing",
      ".md",
      "`"
    ]);
    expect(
      state.runThreads[0]!.latestRun!.activityRows.map((row) => ({
        kind: row.kind,
        sequence: row.sequence,
        text: row.text
      }))
    ).toEqual([
      {
        kind: "prompt",
        sequence: 1,
        text: "Create a test file"
      },
      {
        kind: "message",
        sequence: 2,
        text: "Created `test/testing.md`"
      }
    ]);
  });

  it("preserves partial run results when stopping an active run", async () => {
    const persistence = createInMemoryPersistence();
    const clock = createFixedClock("2026-04-25T18:20:00.000Z");
    const ids = createSequentialIdGenerator();
    const runtime = createStubRuntime();
    const runPanel = new RunPanelService(
      clock,
      ids,
      persistence,
      runtime,
      new RunService(clock, ids, persistence, runtime)
    );

    const threadState = await runPanel.createThread("project-1");
    const started = await runPanel.startRun({
      projectId: "project-1",
      prompt: "Stop me",
      threadId: threadState.runThreads[0]!.runThread.id
    });
    const state = await runPanel.stopRun({
      projectId: "project-1",
      runId: started.run.id
    });

    expect(state.activeRunId).toBeNull();
    expect(state.runThreads[0]!.latestRun?.run.status).toBe("stopped");
    expect(state.runThreads[0]!.latestRun?.runResult.status).toBe("stopped");
    expect(state.runThreads[0]!.latestRun?.runResult.content).toBe(
      "Partial output"
    );
    expect(state.runThreads[0]!.latestRun?.agentActivityItems).toMatchObject([
      {
        kind: "prompt",
        sequence: 1,
        status: "completed",
        text: "Stop me"
      }
    ]);
  });

  it("does not stop a run through another project boundary", async () => {
    const persistence = createInMemoryPersistence();
    const clock = createFixedClock("2026-04-25T18:25:00.000Z");
    const ids = createSequentialIdGenerator();
    const runtime = createStubRuntime();
    const runPanel = new RunPanelService(
      clock,
      ids,
      persistence,
      runtime,
      new RunService(clock, ids, persistence, runtime)
    );

    await runPanel.createThread("project-1");
    const secondThreadState = await runPanel.createThread("project-2");
    const started = await runPanel.startRun({
      projectId: "project-2",
      prompt: "Do not stop me from folder one",
      threadId: secondThreadState.runThreads[0]!.runThread.id
    });

    await expect(
      runPanel.stopRun({
        projectId: "project-1",
        runId: started.run.id
      })
    ).rejects.toThrow(`Unknown run: ${started.run.id}`);
  });

  it("captures runtime failures in the persisted run result", async () => {
    const persistence = createInMemoryPersistence();
    const clock = createFixedClock("2026-04-25T18:30:00.000Z");
    const ids = createSequentialIdGenerator();
    const runtime = createStubRuntime();
    const runPanel = new RunPanelService(
      clock,
      ids,
      persistence,
      runtime,
      new RunService(clock, ids, persistence, runtime)
    );

    const threadState = await runPanel.createThread("project-1");
    const started = await runPanel.startRun({
      projectId: "project-1",
      prompt: "Fail me",
      threadId: threadState.runThreads[0]!.runThread.id
    });
    const state = await runPanel.failRun({
      artifactPaths: [],
      content: "",
      failureMessage: "Stub runtime failed.",
      runId: started.run.id
    });

    expect(state.runThreads[0]!.latestRun?.run.status).toBe("failed");
    expect(state.runThreads[0]!.latestRun?.runResult.failureMessage).toBe(
      "Stub runtime failed."
    );
    expect(state.runThreads[0]!.latestRun?.agentActivityItems).toMatchObject([
      {
        kind: "prompt",
        sequence: 1,
        status: "completed",
        text: "Fail me"
      }
    ]);
  });

  it("completes a pi-backed run through RunPanelService even when activity and trace persistence callbacks fail", async () => {
    const persistence = createInMemoryPersistence({
      projects: [
        createProject({
          displayName: "Gravity",
          id: "project-1",
          rootPath: "C:/gravity"
        })
      ]
    });
    const filesystem = createStubFilesystem(["C:/gravity/AGENTS.md"]);
    const clock = createFixedClock("2026-04-28T00:00:00.000Z");
    const ids = createSequentialIdGenerator();
    const traceErrors: Array<{ message: string; runId: string | null }> = [];
    let listener: ((event: unknown) => void) | null = null;
    let runPanel: RunPanelService | null = null;

    const runtime = new PiRuntimeAdapter({
      createSession: async () => ({
        runtimeRunId: "pi-runtime-run-1",
        actorId: "pi-agent",
        session: {
          async prompt() {
            listener?.({
              assistantMessageEvent: {
                delta: "Inspecting files.",
                type: "thinking_delta"
              },
              type: "message_update"
            });
            listener?.({
              assistantMessageEvent: {
                content: "Inspecting files.",
                type: "thinking_end"
              },
              type: "message_update"
            });
            listener?.({
              args: { path: "AGENTS.md" },
              toolCallId: "tool-1",
              toolName: "read",
              type: "tool_execution_start"
            });
            listener?.({
              args: { path: "AGENTS.md" },
              isError: false,
              result: {
                content: [{ text: "Agent instructions", type: "text" }]
              },
              toolCallId: "tool-1",
              toolName: "read",
              type: "tool_execution_end"
            });
            listener?.({
              assistantMessageEvent: {
                delta: "Done.",
                type: "text_delta"
              },
              type: "message_update"
            });
          },
          subscribe(nextListener) {
            listener = nextListener;
            return () => {
              listener = null;
            };
          }
        }
      }),
      onActivity: async (input) => {
        if (input.kind === "reasoning") {
          throw new Error("Activity persistence failed.");
        }

        await runPanel?.recordAgentActivity(input);
      },
      onComplete: async (input) => {
        await runPanel?.completeRun(input);
      },
      onFail: async (input) => {
        await runPanel?.failRun(input);
      },
      onPersistenceWarning: async (input) => {
        traceErrors.push(input);
      },
      resolveRootPath: async () => "C:/gravity"
    });
    runPanel = new RunPanelService(
      clock,
      ids,
      persistence,
      runtime,
      new RunService(clock, ids, persistence, runtime),
      filesystem
    );

    const threadState = await runPanel.createThread("project-1");
    const started = await runPanel.startRun({
      projectId: "project-1",
      prompt: "Stay alive",
      threadId: threadState.runThreads[0]!.runThread.id
    });
    await runtime.waitForRunToFinish(started.run.id);

    const state = await runPanel.hydrate("project-1");
    const latestRun = state.runThreads[0]!.latestRun;

    expect(latestRun?.run.status).toBe("completed");
    expect(latestRun?.runResult).toMatchObject({
      content: "Done.",
      failureMessage: null,
      status: "completed"
    });
    expect(traceErrors).toEqual([
      {
        message: "Activity persistence failed.",
        runId: started.run.id
      }
    ]);
  });

  it("persists pi reasoning, command, and tool activity through RunPanelService", async () => {
    const persistence = createInMemoryPersistence({
      projects: [
        createProject({
          displayName: "Gravity",
          id: "project-1",
          rootPath: "C:/gravity"
        })
      ]
    });
    const filesystem = createStubFilesystem([
      "C:/gravity/AGENTS.md",
      "C:/gravity/output/report.md"
    ]);
    const clock = createFixedClock("2026-04-28T00:10:00.000Z");
    const ids = createSequentialIdGenerator();
    let listener: ((event: unknown) => void) | null = null;
    let runPanel: RunPanelService | null = null;

    const runtime = new PiRuntimeAdapter({
      createSession: async () => ({
        runtimeRunId: "pi-runtime-run-1",
        actorId: "pi-agent",
        session: {
          async prompt() {
            listener?.({
              assistantMessageEvent: {
                delta: "Inspecting files.",
                type: "thinking_delta"
              },
              type: "message_update"
            });
            listener?.({
              assistantMessageEvent: {
                content: "Inspecting files.",
                type: "thinking_end"
              },
              type: "message_update"
            });
            listener?.({
              args: { path: "AGENTS.md" },
              toolCallId: "tool-1",
              toolName: "read",
              type: "tool_execution_start"
            });
            listener?.({
              args: { path: "AGENTS.md" },
              isError: false,
              result: {
                content: [{ text: "Agent instructions", type: "text" }]
              },
              toolCallId: "tool-1",
              toolName: "read",
              type: "tool_execution_end"
            });
            listener?.({
              args: { command: "pnpm test" },
              toolCallId: "tool-2",
              toolName: "bash",
              type: "tool_execution_start"
            });
            listener?.({
              args: { command: "pnpm test" },
              isError: false,
              result: {
                content: [{ text: "tests passed", type: "text" }]
              },
              toolCallId: "tool-2",
              toolName: "bash",
              type: "tool_execution_end"
            });
            listener?.({
              args: { path: "output/report.md" },
              toolCallId: "tool-3",
              toolName: "write",
              type: "tool_execution_start"
            });
            listener?.({
              args: { path: "output/report.md" },
              isError: false,
              result: {
                content: [{ text: "Wrote report", type: "text" }]
              },
              toolCallId: "tool-3",
              toolName: "write",
              type: "tool_execution_end"
            });
            listener?.({
              assistantMessageEvent: {
                delta: "Run complete.",
                type: "text_delta"
              },
              type: "message_update"
            });
          },
          subscribe(nextListener) {
            listener = nextListener;
            return () => {
              listener = null;
            };
          }
        }
      }),
      onActivity: async (input) => {
        await runPanel?.recordAgentActivity(input);
      },
      onComplete: async (input) => {
        await runPanel?.completeRun(input);
      },
      onFail: async (input) => {
        await runPanel?.failRun(input);
      },
      resolveRootPath: async () => "C:/gravity"
    });
    runPanel = new RunPanelService(
      clock,
      ids,
      persistence,
      runtime,
      new RunService(clock, ids, persistence, runtime),
      filesystem
    );

    const threadState = await runPanel.createThread("project-1");
    const started = await runPanel.startRun({
      projectId: "project-1",
      prompt: "Trace runtime events",
      threadId: threadState.runThreads[0]!.runThread.id
    });
    await runtime.waitForRunToFinish(started.run.id);

    const state = await runPanel.hydrate("project-1");
    const latestRun = state.runThreads[0]!.latestRun;

    expect(latestRun?.run.status).toBe("completed");
    expect(latestRun?.runResult).toMatchObject({
      content: "Run complete.",
      failureMessage: null,
      status: "completed"
    });
    expect(latestRun?.agentActivityItems.map((item) => item.kind)).toEqual([
      "prompt",
      "reasoning",
      "tool",
      "tool",
      "command",
      "command",
      "tool",
      "tool",
      "message"
    ]);
    expect(latestRun?.activityRows.map((row) => row.text)).toEqual([
      "Trace runtime events",
      "Inspecting files.",
      "Using read on AGENTS.md",
      "read completed: AGENTS.md",
      "Running command: pnpm test",
      "Command completed: pnpm test",
      "Using write on output/report.md",
      "write completed: output/report.md",
      "Run complete."
    ]);
  });

  it("streams pi conversation text deltas without creating a run", async () => {
    let listener: ((event: unknown) => void) | null = null;
    const deltas: string[] = [];
    let completedContent = "";
    let capturedCwd: string | null = null;
    const runtime = new PiRuntimeAdapter({
      createSession: async ({ cwd }) => ({
        actorId: "pi-agent",
        runtimeRunId: "pi-runtime-run-1",
        session: {
          async prompt() {
            capturedCwd = cwd;
            listener?.({
              assistantMessageEvent: {
                delta: "Hello ",
                type: "text_delta"
              },
              type: "message_update"
            });
            listener?.({
              assistantMessageEvent: {
                delta: "there.",
                type: "text_delta"
              },
              type: "message_update"
            });
          },
          subscribe(nextListener) {
            listener = nextListener;
            return () => {
              listener = null;
            };
          }
        }
      }),
      resolveConversationCwd: ({ threadId }) =>
        `C:/gravity-chat-workspaces/${threadId}`,
      resolveRootPath: async () => "C:/gravity"
    });

    await runtime.startThreadTurn({
      onComplete: async (content) => {
        completedContent = content;
      },
      onDelta: async (delta) => {
        deltas.push(delta);
      },
      prompt: "Say hello",
      projectId: null,
      threadId: "thread-1"
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(deltas).toEqual(["Hello ", "there."]);
    expect(completedContent).toBe("Hello there.");
    expect(capturedCwd).toBe("C:/gravity-chat-workspaces/thread-1");
  });

  it("starts project thread turns in the project root", async () => {
    let capturedCwd: string | null = null;
    const runtime = new PiRuntimeAdapter({
      createSession: async ({ cwd }) => ({
        actorId: "pi-agent",
        runtimeRunId: "pi-runtime-run-1",
        session: {
          async prompt() {
            capturedCwd = cwd;
          },
          subscribe() {
            return () => {};
          }
        }
      }),
      resolveConversationCwd: ({ threadId }) =>
        `C:/gravity-chat-workspaces/${threadId}`,
      resolveRootPath: async (projectId) => `C:/projects/${projectId}`
    });

    await runtime.startThreadTurn({
      onDelta: async () => {
        return;
      },
      projectId: "gravity",
      prompt: "Inspect the project",
      threadId: "thread-1"
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(capturedCwd).toBe("C:/projects/gravity");
  });
});
