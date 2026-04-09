import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { app, screen } = require("electron") as typeof import("electron");

export type WindowState = {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
};

/** Sensible default for a focus-timer app: compact but not cramped. */
export const DEFAULT_WIDTH = 900;
export const DEFAULT_HEIGHT = 660;

const statePath = () => path.join(app.getPath("userData"), "window-state.json");

/**
 * Load the last saved window position / size.
 * Returns null if the file doesn't exist, is corrupt, or if the saved
 * position would land off-screen (e.g. external monitor unplugged).
 */
export const loadWindowState = (): WindowState | null => {
  try {
    const raw = readFileSync(statePath(), "utf-8");
    const state = JSON.parse(raw) as WindowState;

    // Make sure the window would still be visible on at least one display
    const displays = screen.getAllDisplays();
    const visible = displays.some((display) => {
      const { x, y, width, height } = display.bounds;
      return (
        state.x >= x - 100 &&
        state.y >= y - 100 &&
        state.x < x + width &&
        state.y < y + height
      );
    });

    return visible ? state : null;
  } catch {
    return null;
  }
};

/** Persist window bounds to disk. Failures are silently ignored. */
export const saveWindowState = (state: WindowState): void => {
  try {
    writeFileSync(statePath(), JSON.stringify(state));
  } catch {
    // Not critical — worst case the user gets defaults next launch.
  }
};
