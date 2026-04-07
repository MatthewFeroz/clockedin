import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { BrowserWindow } = require("electron") as typeof import("electron");
type ElectronBrowserWindow = import("electron").BrowserWindow;

const loadRoute = async (window: ElectronBrowserWindow, hash: string) => {
  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(`${process.env.ELECTRON_RENDERER_URL}#${hash}`);
    return;
  }

  await window.loadFile(path.join(__dirname, "../renderer/index.html"), {
    hash
  });
};

export const createMainWindow = async () => {
  const window = new BrowserWindow({
    width: 1180,
    height: 860,
    minWidth: 640,
    minHeight: 560,
    backgroundColor: "#fff4e8",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  await loadRoute(window, "/");
  return window;
};

export const createOverlayWindow = async () => {
  const window = new BrowserWindow({
    show: false,
    width: 440,
    height: 560,
    minWidth: 420,
    minHeight: 520,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#ffd6a8",
    focusable: true,
    movable: true,
    closable: false,
    maximizable: false,
    minimizable: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  window.setAlwaysOnTop(true, "floating");
  window.center();
  await loadRoute(window, "/overlay");
  return window;
};
