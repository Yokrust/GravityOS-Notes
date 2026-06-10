import { BrowserWindow, app } from "electron";

import { registerAppIpc } from "../ipc/register-app-ipc.js";
import {
  resolvePreloadEntry,
  resolveRendererEntry
} from "../infrastructure/app-paths.js";

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: resolvePreloadEntry()
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(resolveRendererEntry());
  }

  return window;
}

app.whenReady().then(() => {
  registerAppIpc();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
