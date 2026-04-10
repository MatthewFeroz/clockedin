import type { DesktopSnapshot, StartSessionInput, UpdateSettingInput } from "@clockedin/shared";

declare global {
  interface Window {
    clockedin: {
      getSnapshot(): Promise<DesktopSnapshot>;
      startSession(payload: StartSessionInput): Promise<unknown>;
      endSession(): Promise<unknown>;
      updateSetting(payload: UpdateSettingInput): Promise<unknown>;
      submitDistractionReason(attemptId: string, reason: string): Promise<void>;
      onSnapshotUpdated(callback: (snapshot: DesktopSnapshot) => void): () => void;
    };
  }
}

export {};
