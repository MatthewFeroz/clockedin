import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import {
  IPC_CHANNELS,
  RUNTIME_HOST,
  RUNTIME_PORT,
  blockedTargetSchema,
  startSessionInputSchema,
  updateSettingInputSchema
} from "@clockedin/shared";
import { ClockedinStorage } from "@clockedin/storage";

import { BrowserWatcher } from "./browser-watcher";
import { DesktopController } from "./controller";
import { RuntimeServer } from "./runtime-server";
import { createMainWindow, createOverlayWindow } from "./windows";

const require = createRequire(import.meta.url);
const { BrowserWindow, app, ipcMain } = require("electron") as typeof import("electron");

const createEnvironment = async () => {
  const userDataPath = app.getPath("userData");
  mkdirSync(userDataPath, { recursive: true });

  const storage = new ClockedinStorage(path.join(userDataPath, "clockedin.db"));
  const controller = new DesktopController(storage);
  const browserWatcher = new BrowserWatcher(controller);
  const runtimeServer = new RuntimeServer(controller, RUNTIME_HOST, RUNTIME_PORT);
  await runtimeServer.start();
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
    return controller.startSession(input.durationMinutes);
  });
  ipcMain.handle("desktop:end-session", () => controller.endSession("cancelled"));
  ipcMain.handle("desktop:update-setting", (_event, payload) => {
    const input = updateSettingInputSchema.parse(payload);
    return controller.updateSetting(input);
  });
  ipcMain.handle("desktop:simulate-attempt", (_event, payload) => {
    const target = blockedTargetSchema.parse(payload);
    return controller.simulateAttempt(target);
  });
  ipcMain.handle("desktop:get-runtime-info", () => ({
    host: RUNTIME_HOST,
    port: RUNTIME_PORT
  }));

  app.on("before-quit", async () => {
    browserWatcher.stop();
    await runtimeServer.stop();
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
