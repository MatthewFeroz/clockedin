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
const { BrowserWindow, Menu, Tray, app, ipcMain, nativeImage } =
  require("electron") as typeof import("electron");

type ElectronBrowserWindow = import("electron").BrowserWindow;
type ElectronTray = import("electron").Tray;

let mainWindow: ElectronBrowserWindow | null = null;
let tray: ElectronTray | null = null;
let isQuitting = false;

/**
 * Build a tiny 16×16 lavender circle icon for the system tray.
 * Uses raw BGRA bitmap data so no external image file is needed.
 */
const createTrayImage = () => {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  const radius = size / 2 - 1;
  const center = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dist = Math.sqrt((x - center) ** 2 + (y - center) ** 2);
      if (dist <= radius) {
        buf[idx] = 184; // B
        buf[idx + 1] = 90; // G
        buf[idx + 2] = 124; // R
        buf[idx + 3] = 255; // A
      }
    }
  }

  return nativeImage.createFromBitmap(buf, { width: size, height: size });
};

const createEnvironment = async () => {
  const userDataPath = app.getPath("userData");
  mkdirSync(userDataPath, { recursive: true });

  const storage = new ClockedinStorage(path.join(userDataPath, "clockedin.db"));
  const controller = new DesktopController(storage);
  const browserWatcher = new BrowserWatcher(controller);
  browserWatcher.start();

  mainWindow = await createMainWindow();
  const overlayWindow = await createOverlayWindow();

  /* ── Minimize to system tray instead of closing ── */
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  if (!tray) {
    tray = new Tray(createTrayImage());
    tray.setToolTip("Clockedin");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: "Show Clockedin",
          click: () => {
            mainWindow?.show();
            mainWindow?.focus();
          }
        },
        { type: "separator" },
        {
          label: "Quit",
          click: () => {
            isQuitting = true;
            app.quit();
          }
        }
      ])
    );

    tray.on("double-click", () => {
      mainWindow?.show();
      mainWindow?.focus();
    });
  }

  const broadcast = () => {
    const snapshot = controller.getSnapshot();
    mainWindow?.webContents.send(IPC_CHANNELS.snapshotUpdated, snapshot);
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

  app.on("before-quit", () => {
    isQuitting = true;
    browserWatcher.stop();
    storage.close();
  });
};

app.whenReady().then(async () => {
  await createEnvironment();

  app.on("activate", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    } else if (BrowserWindow.getAllWindows().length === 0) {
      createEnvironment();
    }
  });
});

app.on("window-all-closed", () => {
  /* On non-macOS, hiding the window doesn't emit this event, but if it
     does fire (e.g. overlay is the last window), only quit when intended. */
  if (process.platform !== "darwin" && isQuitting) {
    app.quit();
  }
});
