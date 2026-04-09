import { createRequire } from "node:module";
import path from "node:path";

import {
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  loadWindowState,
  saveWindowState,
  type WindowState
} from "./window-state";

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
  const saved = loadWindowState();

  const window = new BrowserWindow({
    width: saved?.width ?? DEFAULT_WIDTH,
    height: saved?.height ?? DEFAULT_HEIGHT,
    ...(saved ? { x: saved.x, y: saved.y } : {}),
    center: !saved,
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

  if (saved?.maximized) {
    window.maximize();
  }

  /* ── Persist window position & size ── */
  let lastNormalBounds: Omit<WindowState, "maximized"> =
    saved ?? { x: 0, y: 0, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };

  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const persistState = () => {
    if (window.isDestroyed()) return;

    const maximized = window.isMaximized();
    if (!maximized) {
      lastNormalBounds = window.getBounds();
    }

    // Debounce writes — dragging / resizing fires many events
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveWindowState({ ...lastNormalBounds, maximized });
    }, 400);
  };

  window.on("resize", persistState);
  window.on("move", persistState);
  window.on("close", () => {
    // Flush immediately on close so the state is never lost
    if (saveTimer) clearTimeout(saveTimer);
    if (!window.isDestroyed()) {
      const maximized = window.isMaximized();
      if (!maximized) lastNormalBounds = window.getBounds();
      saveWindowState({ ...lastNormalBounds, maximized });
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
