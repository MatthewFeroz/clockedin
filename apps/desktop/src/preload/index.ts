import { createRequire } from "node:module";

import type { DesktopSnapshot, StartSessionInput, UpdateSettingInput } from "@clockedin/shared";
import { IPC_CHANNELS } from "@clockedin/shared";

const require = createRequire(import.meta.url);
const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron");

const api = {
  getSnapshot: () => ipcRenderer.invoke("desktop:get-snapshot") as Promise<DesktopSnapshot>,
  startSession: (payload: StartSessionInput) => ipcRenderer.invoke("desktop:start-session", payload),
  endSession: () => ipcRenderer.invoke("desktop:end-session"),
  updateSetting: (payload: UpdateSettingInput) => ipcRenderer.invoke("desktop:update-setting", payload),
  submitDistractionReason: (attemptId: string, reason: string) =>
    ipcRenderer.invoke("desktop:submit-distraction-reason", { attemptId, reason }),
  onSnapshotUpdated: (callback: (snapshot: DesktopSnapshot) => void) => {
    const listener = (_event: unknown, snapshot: DesktopSnapshot) => callback(snapshot);
    ipcRenderer.on(IPC_CHANNELS.snapshotUpdated, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.snapshotUpdated, listener);
    };
  }
};

contextBridge.exposeInMainWorld("clockedin", api);
