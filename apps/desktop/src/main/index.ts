import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import {
  IPC_CHANNELS,
  startSessionInputSchema,
  updateSettingInputSchema
} from "@clockedin/shared";
import { ClockedinStorage } from "@clockedin/storage";

import { BrowserWatcher } from "./browser-watcher";
import { DesktopController } from "./controller";
import { createMainWindow, createOverlayWindow } from "./windows";

const require = createRequire(import.meta.url);
const { BrowserWindow, app, ipcMain } = require("electron") as typeof import("electron");

const createEnvironment = async () => {
  const userDataPath = app.getPath("userData");
  mkdirSync(userDataPath, { recursive: true });

  const storage = new ClockedinStorage(path.join(userDataPath, "clockedin.db"));
  const controller = new DesktopController(storage);
  const browserWatcher = new BrowserWatcher(controller);
  browserWatcher.start();

  const mainWindow = await createMainWindow();
  const overlayWindow = await createOverlayWindow();

  const broadcast = () => {
    const snapshot = controller.getSnapshot();
    mainWindow.webContents.send(IPC_CHANNELS.snapshotUpdated, snapshot);
    overlayWindow.webContents.send(IPC_CHANNELS.snapshotUpdated, snapshot);

    if (snapshot.punishment?.active) {
      overlayWindow.show();
      overlayWindow.focus();
    } else {
      overlayWindow.hide();
    }
  };

  controller.subscribe(() => {
    broadcast();
  });

  ipcMain.handle("desktop:get-snapshot", () => controller.getSnapshot());
  ipcMain.handle("desktop:start-session", (_event, payload) => {
    const input = startSessionInputSchema.parse(payload);
    const session = controller.startSession(input.durationMinutes);
    browserWatcher.triggerCheck();
    return session;
  });
  ipcMain.handle("desktop:end-session", () => controller.endSession("cancelled"));
  ipcMain.handle("desktop:update-setting", (_event, payload) => {
    const input = updateSettingInputSchema.parse(payload);
    return controller.updateSetting(input);
  });

  app.on("before-quit", async () => {
    browserWatcher.stop();
    storage.close();
  });
};

app.whenReady().then(async () => {
  await createEnvironment();

  app.on("activate", async () => {
    if (app.isReady() && BrowserWindow.getAllWindows().length === 0) {
      await createEnvironment();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
