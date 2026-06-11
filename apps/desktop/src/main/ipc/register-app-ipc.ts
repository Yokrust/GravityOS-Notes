import { BrowserWindow, dialog, ipcMain, shell } from "electron";
import { mkdir } from "node:fs/promises";

import {
  AuthStorage,
  NodeFilesystemAdapter,
  PiAuthAdapter,
  PiCustomSatelliteGenerator,
  PiRuntimeAdapter,
  SqlitePersistenceAdapter
} from "@gravity/adapters";
import {
  AuthService,
  AppWorkspaceService,
  CustomSatelliteService,
  MapService,
  NotesService,
  ProjectService,
  RunPanelService,
  RunService,
  ThreadPanelService,
  type AuthStateRecord,
  type AppWorkspaceCommand,
  type AppWorkspaceHydrateInput,
  type AppWorkspaceState,
  type NotesNavigationState,
  type ProjectOverview,
  type ProjectState,
  type RunPanelState
} from "@gravity/application";
import type { CustomSatelliteProposal, SatelliteValue } from "@gravity/domain";

import { resetDemoProject } from "../demo/demo-folder-system.js";
import {
  resolveChatRuntimeWorkspacePath,
  resolveDemoProjectPath,
  resolveDemoTemplatePath,
  resolvePersistenceDatabasePath,
  resolvePiAuthStoragePath
} from "../infrastructure/app-paths.js";

function createSequentialIdGenerator() {
  const counts = new Map<string, number>();

  return {
    next(prefix: string) {
      const nextValue = (counts.get(prefix) ?? 0) + 1;
      counts.set(prefix, nextValue);
      return `${prefix}-${nextValue}`;
    }
  };
}

const ids = createSequentialIdGenerator();
const clock = {
  now() {
    return new Date().toISOString();
  }
};
const filesystem = new NodeFilesystemAdapter();
const persistence = new SqlitePersistenceAdapter(
  resolvePersistenceDatabasePath()
);
const authStorage = AuthStorage.create(resolvePiAuthStoragePath());
const auth = new PiAuthAdapter({
  authStorage,
  async loginWithOAuth(providerId, callbacks) {
    await authStorage.login(providerId, {
      ...callbacks,
      onAuth(info) {
        void shell.openExternal(info.url);
        callbacks.onAuth(info);
      }
    });
  }
});
const maps = new MapService(filesystem, persistence);
const authService = new AuthService(auth);
const runPanelRef: { current: RunPanelService | null } = { current: null };
const runtime = new PiRuntimeAdapter({
  authStorage,
  async onActivity(input) {
    await runPanelRef.current?.recordAgentActivity(input);
  },
  async onComplete(input) {
    await runPanelRef.current?.completeRun(input);
    await threadPanel.completeRunMessage(input);
  },
  async onFail(input) {
    await runPanelRef.current?.failRun(input);
    await threadPanel.failRunMessage(input);
  },
  async resolveRootPath(projectId) {
    const persistedState = await persistence.loadState();
    const project = persistedState.projects.find(
      (entry) => entry.id === projectId
    );

    if (!project) {
      throw new Error(`Unknown project: ${projectId}`);
    }

    return project.rootPath;
  },
  async resolveConversationCwd(input) {
    const workspacePath = resolveChatRuntimeWorkspacePath(input.threadId);
    await mkdir(workspacePath, { recursive: true });
    return workspacePath;
  }
});
const runs = new RunService(clock, ids, persistence, runtime);
const runPanel = new RunPanelService(
  clock,
  ids,
  persistence,
  runtime,
  runs,
  filesystem
);
runPanelRef.current = runPanel;
const threadPanel = new ThreadPanelService(
  clock,
  ids,
  persistence,
  runtime,
  {
    filesystem,
    runService: runs
  },
  {
    onThreadUpdate(state) {
      broadcastThreadUpdate(state);
    }
  }
);
const projects = new ProjectService(ids, filesystem, maps, persistence);
const notes = new NotesService(filesystem, persistence);
const customSatellites = new CustomSatelliteService(
  clock,
  ids,
  persistence,
  new PiCustomSatelliteGenerator({ authStorage })
);
const workspace = new AppWorkspaceService({
  projects,
  runPanel,
  threadPanel
});

function serializeProject(entry: ProjectOverview) {
  return {
    id: entry.project.id,
    displayName: entry.project.displayName,
    rootPath: entry.project.rootPath,
    hasRootMap: entry.hasRootMap,
    pathStatus: entry.pathStatus
  };
}

function serializeProjects(state: ProjectState) {
  return {
    selectedProjectId: state.selectedProjectId,
    projects: state.projects.map(serializeProject)
  };
}

function serializeRunPanelState(state: RunPanelState) {
  return state;
}

function serializeAuthState(state: AuthStateRecord) {
  return state;
}

function serializeWorkspaceState(state: AppWorkspaceState) {
  return {
    ...state,
    projects: serializeProjects(state.projects)
  };
}

function broadcastThreadUpdate(
  state: Awaited<ReturnType<ThreadPanelService["hydrate"]>>
) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("threads:update", state);
  }
}

export function registerAppIpc(): void {
  ipcMain.handle("app:get-bootstrap-status", async () => ({
    appName: "Gravity",
    packageCount: 4
  }));

  ipcMain.handle("projects:get-state", async () =>
    serializeProjects(await projects.hydrate())
  );
  ipcMain.handle("projects:register", async (_, rootPath: string) =>
    serializeProjects(await projects.register(rootPath))
  );
  ipcMain.handle("projects:create", async (_, rootPath: string) =>
    serializeProjects(await projects.create(rootPath))
  );
  ipcMain.handle("projects:choose-directory", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"]
    });

    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
  ipcMain.handle(
    "projects:reattach",
    async (_, projectId: string, rootPath: string) =>
      serializeProjects(await projects.reattach(projectId, rootPath))
  );
  ipcMain.handle(
    "projects:rename",
    async (_, projectId: string, displayName: string) =>
      serializeProjects(await projects.rename(projectId, displayName))
  );
  ipcMain.handle("projects:select", async (_, projectId: string) =>
    serializeProjects(await projects.select(projectId))
  );
  ipcMain.handle("projects:remove", async (_, projectId: string) =>
    serializeProjects(await projects.remove(projectId))
  );
  ipcMain.handle("projects:create-demo", async () => {
    const targetPath = resolveDemoProjectPath();
    await resetDemoProject({
      sourcePath: resolveDemoTemplatePath(),
      targetPath
    });

    let state = await projects.register(targetPath);
    if (state.selectedProjectId) {
      state = await projects.rename(state.selectedProjectId, "Demo Project");
    }

    return serializeProjects(state);
  });
  ipcMain.handle("notes:get-state", async () => notes.hydrate());
  ipcMain.handle("notes:choose-directory", async () => {
    const result = await dialog.showOpenDialog({
      buttonLabel: "Usar como cuaderno",
      properties: ["openDirectory", "createDirectory"],
      title: "Elige la carpeta de Gravity Notes"
    });

    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
  ipcMain.handle("notes:attach", async (_, notebookRoot: string) =>
    notes.attach(notebookRoot)
  );
  ipcMain.handle("notes:refresh", async () => notes.refresh());
  ipcMain.handle("notes:select", async (_, notePath: string) =>
    notes.selectNote(notePath)
  );
  ipcMain.handle(
    "notes:save-navigation",
    async (_, state: NotesNavigationState) => notes.saveNavigation(state)
  );
  ipcMain.handle(
    "notes:save-content",
    async (_, notePath: string, content: string) =>
      notes.saveNote(notePath, content)
  );
  ipcMain.handle("notes:create-note", async (_, parentPath?: string) =>
    notes.createNote(parentPath)
  );
  ipcMain.handle("notes:create-folder", async (_, parentPath?: string) =>
    notes.createFolder(parentPath)
  );
  ipcMain.handle(
    "notes:rename",
    async (_, nodePath: string, nextName: string) =>
      notes.renameNode(nodePath, nextName)
  );
  ipcMain.handle("notes:delete", async (_, nodePath: string) =>
    notes.deleteNode(nodePath)
  );
  ipcMain.handle("custom-satellites:get-state", async () =>
    customSatellites.hydrate()
  );
  ipcMain.handle("custom-satellites:generate", async (_, description: string) =>
    customSatellites.generate(description)
  );
  ipcMain.handle(
    "custom-satellites:confirm",
    async (_, proposal: CustomSatelliteProposal) =>
      customSatellites.confirm(proposal)
  );
  ipcMain.handle(
    "custom-satellites:create-instance",
    async (
      _,
      input: {
        customTypeId: string;
        x?: number;
        y?: number;
        z?: number;
      }
    ) => customSatellites.createInstance(input)
  );
  ipcMain.handle(
    "custom-satellites:update-value",
    async (
      _,
      input: {
        instanceId: string;
        key: string;
        value: SatelliteValue;
      }
    ) => customSatellites.updateInstanceValue(input)
  );
  ipcMain.handle(
    "custom-satellites:update-frame",
    async (
      _,
      input: {
        instanceId: string;
        x: number;
        y: number;
        width: number;
        height: number;
        z: number;
      }
    ) => customSatellites.updateInstanceFrame(input)
  );
  ipcMain.handle(
    "custom-satellites:close-instance",
    async (_, instanceId: string) => customSatellites.closeInstance(instanceId)
  );
  ipcMain.handle(
    "maps:load-draft",
    async (_, projectId: string, rootPath: string, targetFolderPath?: string) =>
      maps.loadDraft({
        projectId,
        rootPath,
        ...(targetFolderPath ? { targetFolderPath } : {})
      })
  );
  ipcMain.handle(
    "maps:save-draft",
    async (
      _,
      projectId: string,
      rootPath: string,
      content: string,
      targetFolderPath?: string
    ) =>
      maps.saveDraft({
        content,
        projectId,
        rootPath,
        ...(targetFolderPath ? { targetFolderPath } : {})
      })
  );
  ipcMain.handle("auth:get-state", async () =>
    serializeAuthState(await authService.hydrate())
  );
  ipcMain.handle(
    "auth:set-api-key",
    async (_, providerId: string, apiKey: string) =>
      serializeAuthState(
        await authService.saveApiKey({
          apiKey,
          providerId
        })
      )
  );
  ipcMain.handle("auth:begin-oauth-login", async (_, providerId: string) =>
    serializeAuthState(await authService.beginOAuthLogin(providerId))
  );
  ipcMain.handle(
    "auth:submit-oauth-input",
    async (_, flowId: string, value: string) =>
      serializeAuthState(
        await authService.submitOAuthInput({
          flowId,
          value
        })
      )
  );
  ipcMain.handle("auth:logout", async (_, providerId: string) =>
    serializeAuthState(await authService.logout(providerId))
  );
  ipcMain.handle("threads:get-state", async (_, activeThreadId?: string) =>
    threadPanel.hydrate(activeThreadId ?? null)
  );
  ipcMain.handle(
    "workspace:hydrate",
    async (_, input?: AppWorkspaceHydrateInput) =>
      serializeWorkspaceState(await workspace.hydrate(input))
  );
  ipcMain.handle("workspace:execute", async (_, command: AppWorkspaceCommand) =>
    serializeWorkspaceState(await workspace.execute(command))
  );
  ipcMain.handle("threads:create-conversation", async () =>
    threadPanel.createConversationThread()
  );
  ipcMain.handle("threads:trash", async (_, threadId: string) =>
    threadPanel.trashThread(threadId)
  );
  ipcMain.handle("threads:rename", async (_, threadId: string, title: string) =>
    threadPanel.renameThread({ threadId, title })
  );
  ipcMain.handle("threads:restore", async (_, threadId: string) =>
    threadPanel.restoreThread(threadId)
  );
  ipcMain.handle("threads:empty-trash", async () => threadPanel.emptyTrash());
  ipcMain.handle(
    "threads:send-message",
    async (_, threadId: string, content: string) =>
      threadPanel.sendMessage({ content, threadId })
  );
  ipcMain.handle("runs:get-panel-state", async (_, projectId: string) =>
    serializeRunPanelState(await runPanel.hydrate(projectId))
  );
  ipcMain.handle("runs:create-thread", async (_, projectId: string) =>
    serializeRunPanelState(await runPanel.createThread(projectId))
  );
  ipcMain.handle(
    "runs:upgrade-chat-thread",
    async (_, threadId: string, projectId: string) =>
      serializeRunPanelState(
        await runPanel.upgradeChatThreadToProject({ projectId, threadId })
      )
  );
  ipcMain.handle(
    "runs:rename-thread",
    async (_, projectId: string, runThreadId: string, title: string) =>
      serializeRunPanelState(
        await runPanel.renameThread({
          projectId,
          threadId: runThreadId,
          title
        })
      )
  );
  ipcMain.handle(
    "runs:start",
    async (_, projectId: string, runThreadId: string, prompt: string) =>
      serializeRunPanelState(
        (
          await runPanel.startRun({
            projectId,
            prompt,
            threadId: runThreadId
          })
        ).state
      )
  );
  ipcMain.handle("runs:stop", async (_, projectId: string, runId: string) => {
    const state = await runPanel.stopRun({
      projectId,
      runId
    });
    if (!state) {
      throw new Error(`Run does not belong to a project panel: ${runId}`);
    }
    return serializeRunPanelState(state);
  });
}
