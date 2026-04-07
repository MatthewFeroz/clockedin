import { setInterval } from "node:timers";

import {
  GUIDED_RESET_SECONDS,
  type AppSettingMap,
  type AttemptEvent,
  type BlockedTarget,
  type ConnectionStatus,
  desktopSnapshotSchema,
  type DesktopSnapshot,
  type FocusSession,
  type PunishmentState,
  type RuntimeIncomingMessage,
  type RuntimeOutgoingMessage,
  type RuntimeClientSource,
  type UpdateSettingInput
} from "@clockedin/shared";
import { ClockedinStorage } from "@clockedin/storage";

type SnapshotListener = (snapshot: DesktopSnapshot) => void;

const HEARTBEAT_TIMEOUT_MS = 30_000;

const sourceToStatusKey = (source: RuntimeClientSource): "extension" | "helper" =>
  source === "extension-host" ? "extension" : "helper";

export class DesktopController {
  private readonly listeners = new Set<SnapshotListener>();
  private activeSession: FocusSession | null = null;
  private punishment: PunishmentState | null = null;
  private statuses: DesktopSnapshot["statuses"] = {
    extension: "disconnected",
    helper: "disconnected"
  };
  private latestAttempt: AttemptEvent | null = null;
  private readonly lastSeen: Record<"extension" | "helper", number | null> = {
    extension: null,
    helper: null
  };

  constructor(private readonly storage: ClockedinStorage) {
    const sessions = this.storage.getRecentSessions(1);
    const candidate = sessions[0] ?? null;
    if (candidate?.status === "active" && new Date(candidate.endsAt).getTime() > Date.now()) {
      this.activeSession = candidate;
    }
    this.latestAttempt = this.storage.getRecentAttempts(1)[0] ?? null;
    this.restorePunishmentIfNeeded();
    this.startHeartbeatMonitor();
  }

  subscribe(listener: SnapshotListener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): DesktopSnapshot {
    return desktopSnapshotSchema.parse({
      blockedTargets: this.storage.getBlockedTargets(),
      activeSession: this.getResolvedSession(),
      punishment: this.getResolvedPunishment(),
      attempts: this.storage.getRecentAttempts(),
      recentSessions: this.storage.getRecentSessions(),
      metrics: this.storage.getMetrics(),
      settings: this.storage.getSettings(),
      statuses: this.statuses,
      enforcementReady: this.isEnforcementReady(),
      latestAttempt: this.latestAttempt
    });
  }

  getRuntimeConfig(): RuntimeOutgoingMessage {
    return {
      type: "CONFIG_SYNC",
      payload: {
        blockedTargets: this.storage.getBlockedTargets(),
        sessionActive: Boolean(this.getResolvedSession()),
        sessionId: this.getResolvedSession()?.id ?? null
      }
    };
  }

  hasActiveSession() {
    return Boolean(this.getResolvedSession());
  }

  getBlockedWebsiteTargets() {
    return this.storage.getBlockedTargets().filter((target) => target.kind === "website" && target.enabled);
  }

  recordDetectedAttempt(input: Omit<AttemptEvent, "id" | "detectedAt" | "sessionId">) {
    return this.applyAttempt(input);
  }

  startSession(durationMinutes: number) {
    if (this.activeSession) {
      throw new Error("A focus session is already active.");
    }

    this.activeSession = this.storage.startSession(durationMinutes);
    this.emit();
    return this.activeSession;
  }

  endSession(status: FocusSession["status"] = "cancelled") {
    if (!this.activeSession) {
      return null;
    }

    this.storage.finishSession(this.activeSession.id, status);
    this.activeSession = null;
    this.punishment = null;
    this.emit();
    return true;
  }

  updateSetting(input: UpdateSettingInput): AppSettingMap {
    const settings = this.storage.updateSetting(input);
    this.emit();
    return settings;
  }

  simulateAttempt(target: BlockedTarget) {
    return this.applyAttempt({
      source: target.kind === "website" ? "extension" : "native-helper",
      targetId: target.id,
      targetLabel: target.label,
      platform: "macos",
      context:
        target.kind === "website"
          ? {
              url: `https://${target.match.domains?.[0] ?? "example.com"}`
            }
          : {
              appName: target.label
            }
    });
  }

  handleRuntimeMessage(message: RuntimeIncomingMessage) {
    this.markSourceSeen(message.source);

    if (message.type === "ATTEMPT_DETECTED") {
      return this.applyAttempt({
        source: message.source === "extension-host" ? "extension" : "native-helper",
        targetId: message.payload.targetId,
        targetLabel: message.payload.targetLabel,
        platform: message.payload.platform,
        context: message.payload.context
      });
    }

    this.emit();
    return null;
  }

  private applyAttempt(input: Omit<AttemptEvent, "id" | "detectedAt" | "sessionId">) {
    const session = this.getResolvedSession();
    if (!session) {
      return null;
    }

    const attempt = this.storage.recordAttempt({
      sessionId: session.id,
      ...input
    });

    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + GUIDED_RESET_SECONDS * 1000);
    this.storage.incrementGuidedReset(session.id, GUIDED_RESET_SECONDS);
    this.storage.recordPunishment(
      session.id,
      attempt.id,
      GUIDED_RESET_SECONDS,
      startedAt.toISOString(),
      endsAt.toISOString()
    );

    this.latestAttempt = attempt;
    this.punishment = {
      active: true,
      mode: "guided_refocus",
      durationSeconds: GUIDED_RESET_SECONDS,
      startedAt: startedAt.toISOString(),
      endsAt: endsAt.toISOString(),
      attemptId: attempt.id,
      message: {
        primary: "Take a deep breath.",
        secondary: "Refocus on what you intended to do."
      }
    };
    this.emit();
    return attempt;
  }

  private getResolvedSession() {
    if (!this.activeSession) {
      return null;
    }

    if (new Date(this.activeSession.endsAt).getTime() <= Date.now()) {
      this.storage.finishSession(this.activeSession.id, "completed");
      this.activeSession = null;
      this.punishment = null;
      return null;
    }

    return this.activeSession;
  }

  private getResolvedPunishment() {
    if (!this.punishment) {
      return null;
    }

    if (new Date(this.punishment.endsAt).getTime() <= Date.now()) {
      this.punishment = null;
      return null;
    }

    return this.punishment;
  }

  private restorePunishmentIfNeeded() {
    this.punishment = null;
  }

  private startHeartbeatMonitor() {
    setInterval(() => {
      let changed = false;
      for (const key of Object.keys(this.lastSeen) as Array<keyof typeof this.lastSeen>) {
        const lastSeen = this.lastSeen[key];
        const nextStatus: ConnectionStatus =
          lastSeen !== null && Date.now() - lastSeen < HEARTBEAT_TIMEOUT_MS ? "connected" : "disconnected";
        if (this.statuses[key] !== nextStatus) {
          this.statuses[key] = nextStatus;
          changed = true;
        }
      }

      const hadSession = Boolean(this.activeSession);
      const hadPunishment = Boolean(this.punishment);
      const session = this.getResolvedSession();
      const punishment = this.getResolvedPunishment();
      if (changed || hadSession !== Boolean(session) || hadPunishment !== Boolean(punishment)) {
        this.emit();
      }
    }, 1000);
  }

  private markSourceSeen(source: RuntimeClientSource) {
    const key = sourceToStatusKey(source);
    this.lastSeen[key] = Date.now();
    this.statuses[key] = "connected";
  }

  private isEnforcementReady() {
    return this.statuses.extension === "connected" && this.statuses.helper === "connected";
  }

  private emit() {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
