import type { BlockedTarget, AppSettingMap } from "./schemas";

export const APP_ID = "clockedin";
export const APP_NAME = "Clockedin";
export const GUIDED_RESET_SECONDS = 15;
export const RUNTIME_HOST = "127.0.0.1";
export const RUNTIME_PORT = 48123;
export const IPC_CHANNELS = {
  snapshotUpdated: "clockedin:snapshot-updated"
} as const;

export const DEFAULT_BLOCKED_TARGETS: BlockedTarget[] = [
  {
    id: "website-twitter",
    kind: "website",
    label: "Twitter / X",
    enabled: true,
    match: {
      domains: ["twitter.com", "www.twitter.com", "x.com", "www.x.com"]
    }
  },
  {
    id: "website-youtube",
    kind: "website",
    label: "YouTube",
    enabled: true,
    match: {
      domains: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]
    }
  },
  {
    id: "website-linkedin",
    kind: "website",
    label: "LinkedIn",
    enabled: true,
    match: {
      domains: ["linkedin.com", "www.linkedin.com"]
    }
  }
];

export const DEFAULT_SETTINGS: AppSettingMap = {
  defaultSessionDurationMinutes: 60,
  requireFullEnforcement: false,
  soundEnabled: false
};
