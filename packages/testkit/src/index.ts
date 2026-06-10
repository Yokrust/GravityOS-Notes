import type {
  AuthPort,
  AuthState,
  AppMetadata,
  ClockPort,
  FilesystemPort,
  IdGeneratorPort,
  PersistedAppState,
  PersistencePort,
  RuntimePort
} from "@gravity/application";
import type {
  AgentActivityItem,
  Project,
  Run,
  RunResult,
  RunThread,
  Thread,
  ThreadMessage
} from "@gravity/domain";

export function createStubFilesystem(files: string[]): FilesystemPort {
  const normalize = (value: string) => value.replaceAll("\\", "/");
  const fileMap = new Map(files.map((file) => [normalize(file), ""]));
  const directorySet = new Set(
    files.flatMap((file) => {
      const normalized = normalize(file);
      const directories: string[] = [];
      const segments = normalized.split("/");

      for (let index = 1; index < segments.length - 1; index += 1) {
        directories.push(segments.slice(0, index + 1).join("/"));
      }

      return directories;
    })
  );

  return {
    baseName(path) {
      return normalize(path).split("/").at(-1) ?? "";
    },
    async deletePath(path, options) {
      const normalized = normalize(path);
      fileMap.delete(normalized);
      directorySet.delete(normalized);

      if (options?.recursive) {
        for (const file of fileMap.keys()) {
          if (file.startsWith(`${normalized}/`)) fileMap.delete(file);
        }
        for (const directory of directorySet) {
          if (directory.startsWith(`${normalized}/`)) {
            directorySet.delete(directory);
          }
        }
      }
    },
    directoryName(path) {
      return normalize(path).split("/").slice(0, -1).join("/");
    },
    async hasFile(path: string) {
      return fileMap.has(normalize(path));
    },
    isPathInside(rootPath, targetPath) {
      const root = normalize(rootPath).replace(/\/+$/, "");
      const target = normalize(targetPath);
      return target === root || target.startsWith(`${root}/`);
    },
    async listDirectory(path) {
      const normalizedParentPath = normalize(path);

      return [...directorySet, ...fileMap.keys()]
        .filter((candidate) => candidate !== normalizedParentPath)
        .filter((candidate) => {
          const segments = candidate.split("/");
          return (
            segments.length > 1 &&
            segments.slice(0, -1).join("/") === normalizedParentPath
          );
        })
        .map((candidate) => ({
          path: candidate,
          type: directorySet.has(candidate)
            ? ("directory" as const)
            : ("file" as const)
        }))
        .toSorted((left, right) => left.path.localeCompare(right.path));
    },
    async inspectPath(path) {
      const normalized = normalize(path);
      if (fileMap.has(normalized)) {
        return {
          kind: "file" as const,
          modifiedAt: 0,
          status: "ready" as const
        };
      }

      if (directorySet.has(normalized)) {
        return {
          kind: "directory" as const,
          modifiedAt: 0,
          status: "ready" as const
        };
      }

      return { kind: null, status: "missing" as const };
    },
    async readFile(path) {
      const content = fileMap.get(normalize(path));
      if (content === undefined) {
        throw new Error(`Missing file: ${path}`);
      }

      return content;
    },
    async movePath(sourcePath, destinationPath) {
      const source = normalize(sourcePath);
      const destination = normalize(destinationPath);

      if (fileMap.has(source)) {
        const content = fileMap.get(source) ?? "";
        fileMap.delete(source);
        fileMap.set(destination, content);
        return;
      }

      if (directorySet.has(source)) {
        const directories = [...directorySet].filter(
          (path) => path === source || path.startsWith(`${source}/`)
        );
        const files = [...fileMap.entries()].filter(([path]) =>
          path.startsWith(`${source}/`)
        );
        for (const path of directories) directorySet.delete(path);
        for (const [path] of files) fileMap.delete(path);
        for (const path of directories) {
          directorySet.add(destination + path.slice(source.length));
        }
        for (const [path, content] of files) {
          fileMap.set(destination + path.slice(source.length), content);
        }
      }
    },
    relativePath(fromPath, toPath) {
      const from = normalize(fromPath).split("/");
      const to = normalize(toPath).split("/");
      while (from.length > 0 && to.length > 0 && from[0] === to[0]) {
        from.shift();
        to.shift();
      }
      return [...from.map(() => ".."), ...to].join("/");
    },
    resolvePath(path, ...segments) {
      const parts = normalize([path, ...segments].join("/")).split("/");
      const resolved: string[] = [];
      for (const part of parts) {
        if (!part || part === ".") continue;
        if (part === "..") {
          resolved.pop();
        } else {
          resolved.push(part);
        }
      }
      return `${path.startsWith("/") ? "/" : ""}${resolved.join("/")}`;
    },
    async createDirectory(path) {
      const normalized = normalize(path);
      directorySet.add(normalized);
      const parts = normalized.split("/");
      for (let index = 1; index < parts.length - 1; index += 1) {
        directorySet.add(parts.slice(0, index + 1).join("/"));
      }
    },
    async writeFile(path, content) {
      const normalized = normalize(path);
      fileMap.set(normalized, content);
      const parts = normalized.split("/");
      for (let index = 1; index < parts.length - 1; index += 1) {
        directorySet.add(parts.slice(0, index + 1).join("/"));
      }
    }
  };
}

export function createInMemoryPersistence(
  initialState?: Partial<PersistedAppState>
): PersistencePort {
  const projectsById = new Map<string, Project>(
    (initialState?.projects ?? []).map((project) => [project.id, project])
  );
  const runThreads = new Map<string, RunThread>(
    (initialState?.runThreads ?? initialState?.threads ?? []).map(
      (runThread) => [runThread.id, runThread]
    )
  );
  const threadMessages = new Map<string, ThreadMessage>();
  const runs = new Map<string, Run>();
  const runResults = new Map<string, RunResult>();
  const agentActivityItems = new Map<string, AgentActivityItem>();
  const initialNotesState = initialState?.appMetadata?.notesState;
  let appMetadata: AppMetadata = {
    selectedProjectId: initialState?.appMetadata?.selectedProjectId ?? null
  };

  if (initialNotesState !== undefined) {
    appMetadata.notesState = cloneNotesState(initialNotesState);
  }

  for (const run of initialState?.runs ?? []) {
    runs.set(run.id, run);
  }

  for (const message of initialState?.threadMessages ?? []) {
    threadMessages.set(message.id, message);
  }

  for (const runResult of initialState?.runResults ?? []) {
    runResults.set(runResult.runId, runResult);
  }

  for (const activityItem of initialState?.agentActivityItems ?? []) {
    agentActivityItems.set(activityItem.id, activityItem);
  }

  return {
    async loadState() {
      const projects = [...projectsById.values()] as Project[];
      const threads = [...runThreads.values()] as Thread[];
      return {
        projects,
        threads,
        runThreads: threads,
        threadMessages: [...threadMessages.values()].toSorted(
          (left, right) =>
            left.threadId.localeCompare(right.threadId) ||
            left.createdAt.localeCompare(right.createdAt)
        ),
        runs: [...runs.values()],
        runResults: [...runResults.values()],
        agentActivityItems: [...agentActivityItems.values()].toSorted(
          (left, right) =>
            left.runId.localeCompare(right.runId) ||
            left.sequence - right.sequence
        ),
        appMetadata: { ...appMetadata }
      };
    },
    async saveProjects(nextProjects) {
      projectsById.clear();
      for (const project of nextProjects) {
        projectsById.set(project.id, project);
      }
    },
    async saveAppMetadata(nextAppMetadata) {
      const nextNotesState =
        nextAppMetadata.notesState === undefined
          ? appMetadata.notesState
          : cloneNotesState(nextAppMetadata.notesState);

      appMetadata = {
        ...appMetadata,
        selectedProjectId: nextAppMetadata.selectedProjectId ?? null,
        ...(nextNotesState === undefined ? {} : { notesState: nextNotesState })
      };
    },
    async saveRunThread(runThread) {
      runThreads.set(runThread.id, runThread);
    },
    async saveThreadMessage(message) {
      threadMessages.set(message.id, message);
    },
    async saveRun(run) {
      runs.set(run.id, run);
    },
    async saveRunResult(runResult) {
      runResults.set(runResult.runId, runResult);
    },
    async saveAgentActivityItem(activityItem) {
      agentActivityItems.set(activityItem.id, activityItem);
    },
    async getRun(runId) {
      return runs.get(runId) ?? null;
    },
    async deleteThreadData(threadId) {
      runThreads.delete(threadId);

      for (const [messageId, message] of threadMessages.entries()) {
        if (message.threadId === threadId) {
          threadMessages.delete(messageId);
        }
      }

      for (const [runId, run] of runs.entries()) {
        if (run.threadId !== threadId) {
          continue;
        }

        runs.delete(runId);
        runResults.delete(runId);

        for (const [
          activityItemId,
          activityItem
        ] of agentActivityItems.entries()) {
          if (activityItem.runId === runId) {
            agentActivityItems.delete(activityItemId);
          }
        }
      }
    },
    async deleteProjectData(projectId) {
      projectsById.delete(projectId);
      for (const [threadId, runThread] of runThreads.entries()) {
        if (runThread.projectId === projectId) {
          runThreads.delete(threadId);
        }
      }

      for (const [runId, run] of runs.entries()) {
        if (run.projectId !== projectId) {
          continue;
        }

        runs.delete(runId);
        runResults.delete(runId);
        for (const [
          activityItemId,
          activityItem
        ] of agentActivityItems.entries()) {
          if (activityItem.runId === runId) {
            agentActivityItems.delete(activityItemId);
          }
        }
      }

      if (appMetadata.selectedProjectId === projectId) {
        appMetadata = {
          ...appMetadata,
          selectedProjectId: null
        };
      }
    }
  };
}

function cloneNotesState(
  state: AppMetadata["notesState"]
): Exclude<AppMetadata["notesState"], undefined> {
  if (!state) {
    return null;
  }

  return {
    activeNoteId: state.activeNoteId ?? null,
    expandedFolders: { ...state.expandedFolders },
    notebookRoot: state.notebookRoot ?? null
  };
}

export function createStubAuth(initialState?: Partial<AuthState>): AuthPort & {
  apiKeyUpdates: Array<{
    apiKey: string;
    providerId: string;
  }>;
} {
  let state: AuthState = {
    activeFlow: initialState?.activeFlow ?? null,
    providers: [...(initialState?.providers ?? [])].toSorted((left, right) =>
      left.providerId.localeCompare(right.providerId)
    )
  };
  const apiKeyUpdates: Array<{
    apiKey: string;
    providerId: string;
  }> = [];

  return {
    apiKeyUpdates,
    async beginOAuthLogin(providerId) {
      state = {
        ...state,
        activeFlow: {
          flowId: "auth_flow-1",
          progressMessage: "Starting provider login...",
          prompt: null,
          providerId,
          providerName:
            state.providers.find(
              (provider) => provider.providerId === providerId
            )?.displayName ?? providerId,
          status: "in_progress"
        }
      };
      return state;
    },
    async getState() {
      return state;
    },
    async logout(providerId) {
      state = {
        ...state,
        activeFlow:
          state.activeFlow?.providerId === providerId ? null : state.activeFlow,
        providers: state.providers.map((provider) =>
          provider.providerId === providerId
            ? {
                ...provider,
                status: {
                  configured: false
                }
              }
            : provider
        )
      };
      return state;
    },
    async setApiKey(input) {
      apiKeyUpdates.push(input);
      state = {
        ...state,
        providers: state.providers.map((provider) =>
          provider.providerId === input.providerId
            ? {
                ...provider,
                status: {
                  configured: true,
                  source: "stored"
                }
              }
            : provider
        )
      };
      return state;
    },
    async submitOAuthInput() {
      state = {
        ...state,
        activeFlow: null
      };
      return state;
    }
  };
}

export function createFixedClock(value: string): ClockPort {
  return {
    now() {
      return value;
    }
  };
}

export function createSequentialIdGenerator(): IdGeneratorPort {
  const counts = new Map<string, number>();

  return {
    next(prefix: string) {
      const nextValue = (counts.get(prefix) ?? 0) + 1;
      counts.set(prefix, nextValue);
      return `${prefix}-${nextValue}`;
    }
  };
}

export function createStubRuntime(): RuntimePort {
  let nextRuntimeRunId = 0;
  const runtimeRunIdsByRunId = new Map<string, string>();

  return {
    async startRun(run) {
      nextRuntimeRunId += 1;
      const runtimeRunId = `runtime-run-${nextRuntimeRunId}`;
      runtimeRunIdsByRunId.set(run.id, runtimeRunId);
      return {
        actorId: "actor-1",
        runtimeRunId
      };
    },
    async stopRun() {
      return;
    },
    async stopRunByRunId(runId) {
      const runtimeRunId = runtimeRunIdsByRunId.get(runId);
      if (!runtimeRunId) {
        throw new Error(`Unknown active run: ${runId}`);
      }

      runtimeRunIdsByRunId.delete(runId);

      return {
        artifactPaths: ["C:/gravity/output/partial.md"],
        content: "Partial output",
        runtimeRunId
      };
    }
  };
}
