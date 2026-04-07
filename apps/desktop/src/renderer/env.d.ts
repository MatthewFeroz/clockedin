import type { BlockedTarget, DesktopSnapshot, StartSessionInput, UpdateSettingInput } from "@clockedin/shared";

declare global {
  interface Window {
    clockedin: {
      getSnapshot(): Promise<DesktopSnapshot>;
      startSession(payload: StartSessionInput): Promise<unknown>;
      endSession(): Promise<unknown>;
      updateSetting(payload: UpdateSettingInput): Promise<unknown>;
      simulateAttempt(target: BlockedTarget): Promise<unknown>;
      getRuntimeInfo(): Promise<{ host: string; port: number }>;
      onSnapshotUpdated(callback: (snapshot: DesktopSnapshot) => void): () => void;
    };
  }
}

export {};
