import { join } from "node:path";

import { app } from "electron";

export function resolveRendererEntry(): string {
  return join(app.getAppPath(), "dist", "index.html");
}

export function resolvePreloadEntry(): string {
  return join(app.getAppPath(), "dist-electron", "preload", "index.cjs");
}

export function resolveDemoTemplatePath(): string {
  return join(app.getAppPath(), "demo-template");
}

export function resolveDemoProjectPath(): string {
  return join(resolveGravityUserDataPath(), "demo-folder-system");
}

export function resolvePersistenceDatabasePath(): string {
  return join(resolveGravityUserDataPath(), "gravity.sqlite");
}

export function resolvePiAuthStoragePath(): string {
  return join(resolveGravityUserDataPath(), "pi-auth.json");
}

export function resolveChatRuntimeWorkspacePath(threadId: string): string {
  return join(
    resolveGravityUserDataPath(),
    "chat-runtime-workspaces",
    encodeURIComponent(threadId)
  );
}

function resolveGravityUserDataPath(): string {
  return process.env.GRAVITY_USER_DATA_PATH ?? app.getPath("userData");
}
