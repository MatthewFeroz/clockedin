import { createRequire } from "node:module";

import type {
  BlockedTarget,
  DesktopSnapshot,
  StartSessionInput,
  UpdateSettingInput
} from "@clockedin/shared";
import { IPC_CHANNELS } from "@clockedin/shared";

const require = createRequire(import.meta.url);
const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron");

const api = {
  getSnapshot: () => ipcRenderer.invoke("desktop:get-snapshot") as Promise<DesktopSnapshot>,
  startSession: (payload: StartSessionInput) => ipcRenderer.invoke("desktop:start-session", payload),
  endSession: () => ipcRenderer.invoke("desktop:end-session"),
  updateSetting: (payload: UpdateSettingInput) => ipcRenderer.invoke("desktop:update-setting", payload),
  simulateAttempt: (target: BlockedTarget) => ipcRenderer.invoke("desktop:simulate-attempt", target),
  getRuntimeInfo: () =>
    ipcRenderer.invoke("desktop:get-runtime-info") as Promise<{ host: string; port: number }>,
  onSnapshotUpdated: (callback: (snapshot: DesktopSnapshot) => void) => {
    const listener = (_event: unknown, snapshot: DesktopSnapshot) => callback(snapshot);
    ipcRenderer.on(IPC_CHANNELS.snapshotUpdated, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.snapshotUpdated, listener);
    };
  }
};

contextBridge.exposeInMainWorld("clockedin", api);
