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
  return join(app.getPath("userData"), "demo-folder-system");
}

export function resolvePersistenceDatabasePath(): string {
  return join(app.getPath("userData"), "gravity.sqlite");
}

export function resolvePiAuthStoragePath(): string {
  return join(app.getPath("userData"), "pi-auth.json");
}

export function resolveChatRuntimeWorkspacePath(threadId: string): string {
  return join(
    app.getPath("userData"),
    "chat-runtime-workspaces",
    encodeURIComponent(threadId)
  );
}
