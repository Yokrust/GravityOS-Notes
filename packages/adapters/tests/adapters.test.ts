import Database from "better-sqlite3";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import {
  createAgentActivityItem,
  createProject,
  createInitialRunResult,
  createRunThread,
  startRun
} from "@gravity/domain";

import {
  AuthStorage,
  NodeFilesystemAdapter,
  PiAuthAdapter,
  PiRuntimeAdapter,
  SqlitePersistenceAdapter
} from "../src/index.js";

describe("node filesystem adapter", () => {
  it("detects the root AGENTS.md file in a temp folder system", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "gravity-"));
    const adapter = new NodeFilesystemAdapter();

    try {
      await writeFile(join(rootPath, "AGENTS.md"), "# map");

      expect(await adapter.hasFile(join(rootPath, "AGENTS.md"))).toBe(true);
    } finally {
      await rm(rootPath, { force: true, recursive: true });
    }
  });

  it("lists immediate child entries for a folder system path", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "gravity-"));
    const adapter = new NodeFilesystemAdapter();

    try {
      await writeFile(join(rootPath, "AGENTS.md"), "# map");
      await writeFile(join(rootPath, "notes.md"), "# notes");

      const children = await adapter.listDirectory(rootPath);

      expect(children.map((entry) => entry.path.split("/").at(-1))).toEqual([
        "AGENTS.md",
        "notes.md"
      ]);
    } finally {
      await rm(rootPath, { force: true, recursive: true });
    }
  });
});

describe("sqlite persistence adapter", () => {
  it("round-trips persisted folder systems, runs, activity streams, and run results", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "gravity-db-"));
    const databasePath = join(rootPath, "gravity.sqlite");
    const adapter = new SqlitePersistenceAdapter(databasePath);

    try {
      const project = createProject({
        id: "fs-1",
        displayName: "Gravity",
        rootPath: "C:/gravity",
        roleAssignments: [{ path: "C:/gravity/docs", role: "context_source" }]
      });
      const runThread = createRunThread({
        id: "thread-1",
        projectId: project.id,
        title: "Thread 1",
        createdAt: "2026-04-25T18:00:00.000Z"
      });
      const run = startRun({
        id: "run-1",
        projectId: project.id,
        threadId: runThread.id,
        runNumber: 1,
        prompt: "Persist me",
        startedAt: "2026-04-25T18:01:00.000Z"
      });
      const runResult = createInitialRunResult(run.id);
      const promptActivityItem = createAgentActivityItem({
        completedAt: "2026-04-25T18:01:00.000Z",
        id: "activity-1",
        kind: "prompt",
        runId: run.id,
        sequence: 1,
        startedAt: "2026-04-25T18:01:00.000Z",
        status: "completed",
        text: "Persist me"
      });
      const commandActivityItem = createAgentActivityItem({
        completedAt: "2026-04-25T18:01:02.000Z",
        id: "activity-2",
        kind: "command",
        output: {
          head: "first lines",
          tail: "last lines",
          truncatedByteCount: 2048,
          truncatedLineCount: 12
        },
        pathAssociations: [
          {
            confidence: "high",
            path: "C:/gravity/packages"
          }
        ],
        runId: run.id,
        sequence: 2,
        startedAt: "2026-04-25T18:01:01.000Z",
        status: "completed",
        text: "Listed packages"
      });
      await adapter.saveProjects([project]);
      await adapter.saveAppMetadata({
        selectedProjectId: project.id
      });
      await adapter.saveRunThread(runThread);
      await adapter.saveRun(run);
      await adapter.saveRunResult(runResult);
      await adapter.saveAgentActivityItem(commandActivityItem);
      await adapter.saveAgentActivityItem(promptActivityItem);

      expect(await adapter.loadState()).toEqual({
        projects: [project],
        threads: [runThread],
        runThreads: [runThread],
        threadMessages: [],
        runs: [run],
        runResults: [runResult],
        agentActivityItems: [promptActivityItem, commandActivityItem],
        customSatelliteTypes: [],
        customSatelliteInstances: [],
        appMetadata: {
          selectedProjectId: project.id
        }
      });
    } finally {
      adapter.close();
      await rm(rootPath, { force: true, recursive: true });
    }
  });

  it("merges notebook metadata updates and round-trips persisted notes", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "gravity-db-"));
    const databasePath = join(rootPath, "gravity.sqlite");
    const adapter = new SqlitePersistenceAdapter(databasePath);

    try {
      const notesState = {
        notebookRoot: "/Users/example/Notes",
        activeNoteId: "/Users/example/Notes/Ideas.md",
        expandedFolders: {
          "/Users/example/Notes/Personal": true
        }
      };

      await adapter.saveAppMetadata({
        selectedProjectId: "project-1"
      });
      await adapter.saveAppMetadata({
        selectedProjectId: "project-1",
        notesState
      });
      await adapter.saveAppMetadata({
        selectedProjectId: "project-2"
      });

      await expect(adapter.loadState()).resolves.toMatchObject({
        customSatelliteTypes: [],
        customSatelliteInstances: [],
        appMetadata: {
          selectedProjectId: "project-2",
          notesState
        }
      });
    } finally {
      adapter.close();
      await rm(rootPath, { force: true, recursive: true });
    }
  });

  it("deletes a folder system and its scoped history without touching other systems", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "gravity-db-"));
    const databasePath = join(rootPath, "gravity.sqlite");
    const adapter = new SqlitePersistenceAdapter(databasePath);

    try {
      const firstProject = createProject({
        id: "fs-1",
        displayName: "Gravity",
        rootPath: "C:/gravity"
      });
      const secondProject = createProject({
        id: "fs-2",
        displayName: "Docs",
        rootPath: "C:/docs"
      });
      const secondRunThread = createRunThread({
        id: "thread-2",
        projectId: secondProject.id,
        title: "Thread 2",
        createdAt: "2026-04-25T18:02:00.000Z"
      });
      const secondRun = startRun({
        id: "run-2",
        projectId: secondProject.id,
        threadId: secondRunThread.id,
        runNumber: 1,
        prompt: "Keep me",
        startedAt: "2026-04-25T18:03:00.000Z"
      });

      await adapter.saveProjects([firstProject, secondProject]);
      await adapter.saveAppMetadata({
        selectedProjectId: firstProject.id
      });
      await adapter.saveRunThread(
        createRunThread({
          id: "thread-1",
          projectId: firstProject.id,
          title: "Thread 1",
          createdAt: "2026-04-25T18:00:00.000Z"
        })
      );
      await adapter.saveRun(
        startRun({
          id: "run-1",
          projectId: firstProject.id,
          threadId: "thread-1",
          runNumber: 1,
          prompt: "Delete me",
          startedAt: "2026-04-25T18:01:00.000Z"
        })
      );
      await adapter.saveRunThread(secondRunThread);
      await adapter.saveRun(secondRun);
      await adapter.saveRunResult(createInitialRunResult(secondRun.id));

      await adapter.deleteProjectData(firstProject.id);

      expect(await adapter.loadState()).toEqual({
        projects: [secondProject],
        threads: [secondRunThread],
        runThreads: [secondRunThread],
        threadMessages: [],
        runs: [secondRun],
        runResults: [createInitialRunResult(secondRun.id)],
        agentActivityItems: [],
        customSatelliteTypes: [],
        customSatelliteInstances: [],
        appMetadata: {
          selectedProjectId: null
        }
      });
    } finally {
      adapter.close();
      await rm(rootPath, { force: true, recursive: true });
    }
  });

  it("loads legacy schema and payload fields into canonical project terminology", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "gravity-db-"));
    const databasePath = join(rootPath, "gravity.sqlite");
    const database = new Database(databasePath);
    const legacyProject = createProject({
      id: "project-1",
      displayName: "Gravity",
      rootPath: "C:/gravity"
    });
    const legacyRunThread = {
      createdAt: "2026-04-25T18:00:00.000Z",
      folderSystemId: "project-1",
      id: "thread-1",
      kind: "project" as const,
      title: "Thread 1",
      trashedAt: null
    };
    const legacyRun = {
      completedAt: null,
      folderSystemId: "project-1",
      id: "run-1",
      prompt: "Legacy run",
      runNumber: 1,
      runThreadId: "thread-1",
      startedAt: "2026-04-25T18:01:00.000Z",
      status: "in_progress" as const,
      threadId: undefined
    };
    const runResult = createInitialRunResult("run-1");
    const activityItem = createAgentActivityItem({
      completedAt: "2026-04-25T18:01:00.000Z",
      id: "activity-1",
      kind: "prompt",
      runId: "run-1",
      sequence: 1,
      startedAt: "2026-04-25T18:01:00.000Z",
      status: "completed",
      text: "Legacy run"
    });
    try {
      database.exec(`
        CREATE TABLE folder_systems (
          id TEXT PRIMARY KEY,
          payload TEXT NOT NULL
        );
        CREATE TABLE run_threads (
          id TEXT PRIMARY KEY,
          folder_system_id TEXT,
          payload TEXT NOT NULL
        );
        CREATE TABLE thread_messages (
          id TEXT PRIMARY KEY,
          thread_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE TABLE runs (
          id TEXT PRIMARY KEY,
          folder_system_id TEXT NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE TABLE run_results (
          run_id TEXT PRIMARY KEY,
          folder_system_id TEXT NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE TABLE agent_activity_items (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL,
          folder_system_id TEXT NOT NULL,
          sequence INTEGER NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE TABLE app_metadata (
          key TEXT PRIMARY KEY,
          payload TEXT NOT NULL
        );
      `);

      database
        .prepare("INSERT INTO folder_systems (id, payload) VALUES (?, ?)")
        .run(legacyProject.id, JSON.stringify(legacyProject));
      database
        .prepare(
          "INSERT INTO run_threads (id, folder_system_id, payload) VALUES (?, ?, ?)"
        )
        .run(
          legacyRunThread.id,
          legacyRunThread.folderSystemId,
          JSON.stringify(legacyRunThread)
        );
      database
        .prepare(
          "INSERT INTO runs (id, folder_system_id, payload) VALUES (?, ?, ?)"
        )
        .run(legacyRun.id, legacyRun.folderSystemId, JSON.stringify(legacyRun));
      database
        .prepare(
          "INSERT INTO run_results (run_id, folder_system_id, payload) VALUES (?, ?, ?)"
        )
        .run(
          runResult.runId,
          legacyRun.folderSystemId,
          JSON.stringify(runResult)
        );
      database
        .prepare(
          "INSERT INTO agent_activity_items (id, run_id, folder_system_id, sequence, payload) VALUES (?, ?, ?, ?, ?)"
        )
        .run(
          activityItem.id,
          activityItem.runId,
          legacyRun.folderSystemId,
          activityItem.sequence,
          JSON.stringify(activityItem)
        );
      database
        .prepare("INSERT INTO app_metadata (key, payload) VALUES ('app', ?)")
        .run(JSON.stringify({ selectedFolderSystemId: "project-1" }));
    } finally {
      database.close();
    }

    const adapter = new SqlitePersistenceAdapter(databasePath);

    try {
      expect(await adapter.loadState()).toEqual({
        projects: [legacyProject],
        threads: [
          {
            createdAt: "2026-04-25T18:00:00.000Z",
            id: "thread-1",
            kind: "project",
            projectId: "project-1",
            title: "Thread 1",
            trashedAt: null
          }
        ],
        runThreads: [
          {
            createdAt: "2026-04-25T18:00:00.000Z",
            id: "thread-1",
            kind: "project",
            projectId: "project-1",
            title: "Thread 1",
            trashedAt: null
          }
        ],
        threadMessages: [],
        runs: [
          {
            completedAt: null,
            id: "run-1",
            projectId: "project-1",
            prompt: "Legacy run",
            runNumber: 1,
            startedAt: "2026-04-25T18:01:00.000Z",
            status: "in_progress",
            threadId: "thread-1"
          }
        ],
        runResults: [runResult],
        agentActivityItems: [activityItem],
        customSatelliteTypes: [],
        customSatelliteInstances: [],
        appMetadata: {
          selectedProjectId: "project-1"
        }
      });
    } finally {
      adapter.close();
      await rm(rootPath, { force: true, recursive: true });
    }
  });

  it("ignores legacy trace rows after the schema has already been renamed", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "gravity-db-"));
    const databasePath = join(rootPath, "gravity.sqlite");
    const database = new Database(databasePath);

    try {
      database.exec(`
        CREATE TABLE projects (
          id TEXT PRIMARY KEY,
          payload TEXT NOT NULL
        );
        CREATE TABLE run_threads (
          id TEXT PRIMARY KEY,
          project_id TEXT,
          payload TEXT NOT NULL
        );
        CREATE TABLE thread_messages (
          id TEXT PRIMARY KEY,
          thread_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE TABLE runs (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE TABLE run_results (
          run_id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE TABLE agent_activity_items (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          sequence INTEGER NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE TABLE traces (
          run_id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE TABLE app_metadata (
          key TEXT PRIMARY KEY,
          payload TEXT NOT NULL
        );
      `);

      database.prepare("INSERT INTO projects (id, payload) VALUES (?, ?)").run(
        "project-1",
        JSON.stringify(
          createProject({
            id: "project-1",
            displayName: "Gravity",
            rootPath: "C:/gravity"
          })
        )
      );
      database
        .prepare(
          "INSERT INTO run_threads (id, project_id, payload) VALUES (?, ?, ?)"
        )
        .run(
          "thread-1",
          "project-1",
          JSON.stringify({
            createdAt: "2026-04-25T18:00:00.000Z",
            folderSystemId: "project-1",
            id: "thread-1",
            kind: "project",
            title: "Thread 1",
            trashedAt: null
          })
        );
      database
        .prepare(
          "INSERT INTO traces (run_id, project_id, payload) VALUES (?, ?, ?)"
        )
        .run(
          "run-1",
          "project-1",
          JSON.stringify({
            actorId: "actor-1",
            events: [],
            folderSystemId: "project-1",
            id: "trace-1",
            runId: "run-1",
            status: "in_progress"
          })
        );
    } finally {
      database.close();
    }

    const adapter = new SqlitePersistenceAdapter(databasePath);

    try {
      expect((await adapter.loadState()).runThreads[0]).toEqual({
        createdAt: "2026-04-25T18:00:00.000Z",
        id: "thread-1",
        kind: "project",
        projectId: "project-1",
        title: "Thread 1",
        trashedAt: null
      });
    } finally {
      adapter.close();
      await rm(rootPath, { force: true, recursive: true });
    }
  });

  it("deletes thread-scoped run data for canonical threadId payloads", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "gravity-db-"));
    const databasePath = join(rootPath, "gravity.sqlite");
    const adapter = new SqlitePersistenceAdapter(databasePath);

    try {
      const project = createProject({
        id: "project-1",
        displayName: "Gravity",
        rootPath: "C:/gravity"
      });
      const runThread = createRunThread({
        id: "thread-1",
        projectId: project.id,
        title: "Thread 1",
        createdAt: "2026-04-25T18:00:00.000Z"
      });
      const run = startRun({
        id: "run-1",
        projectId: project.id,
        threadId: runThread.id,
        runNumber: 1,
        prompt: "Delete me",
        startedAt: "2026-04-25T18:01:00.000Z"
      });
      const runResult = createInitialRunResult(run.id);
      const activityItem = createAgentActivityItem({
        completedAt: "2026-04-25T18:01:00.000Z",
        id: "activity-1",
        kind: "prompt",
        runId: run.id,
        sequence: 1,
        startedAt: "2026-04-25T18:01:00.000Z",
        status: "completed",
        text: "Delete me"
      });

      await adapter.saveProjects([project]);
      await adapter.saveRunThread(runThread);
      await adapter.saveRun(run);
      await adapter.saveRunResult(runResult);
      await adapter.saveAgentActivityItem(activityItem);

      await adapter.deleteThreadData(runThread.id);

      expect(await adapter.loadState()).toEqual({
        projects: [project],
        threads: [],
        runThreads: [],
        threadMessages: [],
        runs: [],
        runResults: [],
        agentActivityItems: [],
        customSatelliteTypes: [],
        customSatelliteInstances: [],
        appMetadata: {
          selectedProjectId: null
        }
      });
    } finally {
      adapter.close();
      await rm(rootPath, { force: true, recursive: true });
    }
  });
});

describe("pi runtime adapter", () => {
  it("starts a pi-backed session in the selected folder system root", async () => {
    let capturedCwd: string | null = null;
    let capturedPrompt: string | null = null;

    const adapter = new PiRuntimeAdapter({
      createSession: async ({ cwd }) => {
        capturedCwd = cwd;

        return {
          runtimeRunId: "pi-runtime-run-1",
          actorId: "pi-agent",
          session: {
            async prompt(prompt: string) {
              capturedPrompt = prompt;
              return {
                text: "Completed from pi."
              };
            },
            subscribe() {
              return () => {};
            }
          }
        };
      },
      resolveRootPath: async () => "C:/gravity"
    });

    const result = await adapter.startRun(
      startRun({
        id: "run-1",
        projectId: "folder-system-1",
        threadId: "thread-1",
        runNumber: 1,
        prompt: "Summarize the repo",
        startedAt: "2026-04-27T23:00:00.000Z"
      })
    );

    expect(result).toEqual({
      actorId: "pi-agent",
      runtimeRunId: "pi-runtime-run-1"
    });
    expect(capturedCwd).toBe("C:/gravity");
    await adapter.waitForRunToFinish("run-1");
    expect(capturedPrompt).toBe("Summarize the repo");
  });

  it("returns the pi result when stopping an active run by run id", async () => {
    let sessionClosed = false;

    const adapter = new PiRuntimeAdapter({
      createSession: async () => ({
        runtimeRunId: "pi-runtime-run-1",
        actorId: "pi-agent",
        session: {
          async prompt() {
            return new Promise<{ text: string }>(() => {
              return;
            });
          },
          subscribe() {
            return () => {};
          },
          async close() {
            sessionClosed = true;
          }
        }
      }),
      resolveRootPath: async () => "C:/gravity"
    });

    await adapter.startRun(
      startRun({
        id: "run-1",
        projectId: "folder-system-1",
        threadId: "thread-1",
        runNumber: 1,
        prompt: "Long running task",
        startedAt: "2026-04-27T23:00:00.000Z"
      })
    );

    const stopped = await adapter.stopRunByRunId("run-1");

    expect(stopped).toEqual({
      artifactPaths: [],
      content: "",
      runtimeRunId: "pi-runtime-run-1"
    });
    expect(sessionClosed).toBe(true);
  });

  it("coalesces streamed assistant text deltas into one message activity item", async () => {
    const activityItems: Array<{
      kind: string;
      runId: string;
      status: string;
      text: string;
    }> = [];
    let listener: ((event: unknown) => void) | null = null;

    const adapter = new PiRuntimeAdapter({
      createSession: async () => ({
        runtimeRunId: "pi-runtime-run-1",
        actorId: "pi-agent",
        session: {
          async prompt() {
            for (const delta of [
              "Created",
              " `",
              "test",
              "/testing",
              ".md",
              "`"
            ]) {
              listener?.({
                assistantMessageEvent: {
                  delta,
                  type: "text_delta"
                },
                type: "message_update"
              });
            }
            return {
              text: "Completed from pi."
            };
          },
          subscribe(nextListener) {
            listener = nextListener;
            return () => {
              listener = null;
            };
          }
        }
      }),
      onActivity: async (activityItem) => {
        activityItems.push(activityItem);
      },
      resolveRootPath: async () => "C:/gravity"
    });

    await adapter.startRun(
      startRun({
        id: "run-1",
        projectId: "folder-system-1",
        threadId: "thread-1",
        runNumber: 1,
        prompt: "Stream updates",
        startedAt: "2026-04-27T23:00:00.000Z"
      })
    );
    await adapter.waitForRunToFinish("run-1");

    expect(activityItems).toEqual([
      {
        kind: "message",
        runId: "run-1",
        status: "completed",
        text: "Created `test/testing.md`"
      }
    ]);
  });

  it("translates pi reasoning and tool events into activity items", async () => {
    const activityItems: Array<{
      kind: string;
      output?: unknown;
      pathAssociations?: unknown[];
      status: string;
      text: string;
    }> = [];
    let listener: ((event: unknown) => void) | null = null;

    const adapter = new PiRuntimeAdapter({
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
              args: { path: "output/welcome.md" },
              toolCallId: "tool-2",
              toolName: "write",
              type: "tool_execution_start"
            });
            listener?.({
              args: { path: "output/welcome.md" },
              isError: false,
              result: {
                content: [{ text: "Wrote file", type: "text" }]
              },
              toolCallId: "tool-2",
              toolName: "write",
              type: "tool_execution_end"
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
      onActivity: async (activityItem) => {
        activityItems.push(activityItem);
      },
      resolveRootPath: async () => "C:/gravity"
    });

    await adapter.startRun(
      startRun({
        id: "run-1",
        projectId: "folder-system-1",
        threadId: "thread-1",
        runNumber: 1,
        prompt: "Trace runtime events",
        startedAt: "2026-04-27T23:00:00.000Z"
      })
    );
    await adapter.waitForRunToFinish("run-1");

    expect(activityItems.map((item) => item.kind)).toEqual([
      "reasoning",
      "tool",
      "tool",
      "tool",
      "tool"
    ]);
    expect(activityItems).toMatchObject([
      {
        kind: "reasoning",
        status: "completed",
        text: "Inspecting files."
      },
      {
        kind: "tool",
        status: "in_progress",
        text: "Using read on AGENTS.md"
      },
      {
        kind: "tool",
        output: {
          head: "Agent instructions",
          tail: "Agent instructions"
        },
        pathAssociations: [
          {
            confidence: "high",
            path: "C:/gravity/AGENTS.md"
          }
        ],
        status: "completed",
        text: "read completed: AGENTS.md"
      },
      {
        kind: "tool",
        status: "in_progress",
        text: "Using write on output/welcome.md"
      },
      {
        kind: "tool",
        pathAssociations: [
          {
            confidence: "high",
            path: "C:/gravity/output/welcome.md"
          }
        ],
        status: "completed",
        text: "write completed: output/welcome.md"
      }
    ]);
  });

  it("completes a run even when activity callbacks reject", async () => {
    const reportedErrors: Array<{ message: string; runId: string | null }> = [];
    let completedRunId: string | null = null;
    let listener: ((event: unknown) => void) | null = null;

    const adapter = new PiRuntimeAdapter({
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
      onActivity: async (activityItem) => {
        if (activityItem.kind === "reasoning") {
          throw new Error("Activity persistence failed.");
        }
      },
      onComplete: async ({ runId }) => {
        completedRunId = runId;
      },
      onPersistenceWarning: async (payload) => {
        reportedErrors.push(payload);
      },
      resolveRootPath: async () => "C:/gravity"
    });

    await adapter.startRun(
      startRun({
        id: "run-1",
        projectId: "folder-system-1",
        threadId: "thread-1",
        runNumber: 1,
        prompt: "Stay alive",
        startedAt: "2026-04-27T23:00:00.000Z"
      })
    );
    const result = await adapter.waitForRunToFinish("run-1");

    expect(result).toEqual({
      artifactPaths: [],
      content: "Done.",
      runtimeRunId: "pi-runtime-run-1"
    });
    expect(completedRunId).toBe("run-1");
    expect(reportedErrors).toEqual([
      {
        message: "Activity persistence failed.",
        runId: "run-1"
      }
    ]);
  });

  it("surfaces a failed pi-backed run after start", async () => {
    const adapter = new PiRuntimeAdapter({
      createSession: async () => ({
        runtimeRunId: "pi-runtime-run-1",
        actorId: "pi-agent",
        session: {
          async prompt() {
            throw new Error("Provider auth missing.");
          },
          subscribe() {
            return () => {};
          }
        }
      }),
      resolveRootPath: async () => "C:/gravity"
    });

    await adapter.startRun(
      startRun({
        id: "run-1",
        projectId: "folder-system-1",
        threadId: "thread-1",
        runNumber: 1,
        prompt: "Run and fail",
        startedAt: "2026-04-27T23:00:00.000Z"
      })
    );

    await expect(adapter.waitForRunToFinish("run-1")).rejects.toThrow(
      "Provider auth missing."
    );
  });
});

describe("pi auth adapter", () => {
  it("lists sanitized provider auth state from pi storage", async () => {
    const authStorage = AuthStorage.inMemory({
      openai: {
        key: "sk-openai",
        type: "api_key"
      }
    });
    const adapter = new PiAuthAdapter({
      authStorage,
      providers: [
        {
          displayName: "OpenAI",
          providerId: "openai",
          supportsApiKey: true,
          supportsOAuth: false
        },
        {
          displayName: "GitHub Copilot",
          providerId: "github-copilot",
          supportsApiKey: true,
          supportsOAuth: true
        }
      ]
    });

    const state = await adapter.getState();

    expect(state.activeFlow).toBeNull();
    expect(state.providers).toEqual([
      {
        displayName: "GitHub Copilot",
        providerId: "github-copilot",
        status: {
          configured: false
        },
        supportsApiKey: true,
        supportsOAuth: true
      },
      {
        displayName: "OpenAI",
        providerId: "openai",
        status: {
          configured: true,
          source: "stored"
        },
        supportsApiKey: true,
        supportsOAuth: false
      }
    ]);
  });

  it("persists API key updates through pi auth storage", async () => {
    const authStorage = AuthStorage.inMemory();
    const adapter = new PiAuthAdapter({
      authStorage,
      providers: [
        {
          displayName: "OpenAI",
          providerId: "openai",
          supportsApiKey: true,
          supportsOAuth: false
        }
      ]
    });

    const state = await adapter.setApiKey({
      apiKey: "sk-openai-123",
      providerId: "openai"
    });

    expect(authStorage.get("openai")).toEqual({
      key: "sk-openai-123",
      type: "api_key"
    });
    expect(state.providers[0]).toMatchObject({
      providerId: "openai",
      status: {
        configured: true,
        source: "stored"
      }
    });
  });

  it("keeps OAuth login flow state in main until pi requests user input", async () => {
    const adapter = new PiAuthAdapter({
      authStorage: AuthStorage.inMemory(),
      loginWithOAuth: async (_providerId, callbacks) => {
        callbacks.onAuth({
          instructions: "Approve access in the browser.",
          url: "https://example.com/oauth"
        });
        const code = await callbacks.onPrompt({
          message: "Paste the verification code.",
          placeholder: "code"
        });

        expect(code).toBe("oauth-code-123");
      },
      providers: [
        {
          displayName: "GitHub Copilot",
          providerId: "github-copilot",
          supportsApiKey: true,
          supportsOAuth: true
        }
      ]
    });

    await adapter.beginOAuthLogin("github-copilot");
    const waitingState = await adapter.getState();

    expect(waitingState.activeFlow).toMatchObject({
      authUrl: "https://example.com/oauth",
      instructions: "Approve access in the browser.",
      prompt: {
        kind: "text",
        message: "Paste the verification code.",
        placeholder: "code"
      },
      providerId: "github-copilot",
      providerName: "GitHub Copilot",
      status: "awaiting_input"
    });

    const completedState = await adapter.submitOAuthInput({
      flowId: waitingState.activeFlow!.flowId,
      value: "oauth-code-123"
    });

    expect(completedState.activeFlow).toBeNull();
  });
});
