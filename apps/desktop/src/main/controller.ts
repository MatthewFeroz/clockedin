import { setInterval } from "node:timers";

import {
  GUIDED_RESET_SECONDS,
  type AppSettingMap,
  type AttemptEvent,
  desktopSnapshotSchema,
  type DesktopSnapshot,
  type FocusSession,
  type PunishmentState,
  type UpdateSettingInput
} from "@clockedin/shared";
import { ClockedinStorage } from "@clockedin/storage";

type SnapshotListener = (snapshot: DesktopSnapshot) => void;
const RESOLUTION_TICK_MS = 500;

export class DesktopController {
  private readonly listeners = new Set<SnapshotListener>();
  private activeSession: FocusSession | null = null;
  private punishment: PunishmentState | null = null;
  private latestAttempt: AttemptEvent | null = null;

  constructor(private readonly storage: ClockedinStorage) {
    const sessions = this.storage.getRecentSessions(1);
    const candidate = sessions[0] ?? null;
    if (candidate?.status === "active" && new Date(candidate.endsAt).getTime() > Date.now()) {
      this.activeSession = candidate;
    }
    this.latestAttempt = this.storage.getRecentAttempts(1)[0] ?? null;
    this.restorePunishmentIfNeeded();
    this.startResolutionTicker();
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
      latestAttempt: this.latestAttempt
    });
  }

  hasActiveSession() {
    return Boolean(this.getResolvedSession());
  }

  getBlockedTargets() {
    return this.storage.getBlockedTargets().filter((target) => target.enabled);
  }

  getBlockedWebsiteTargets() {
    return this.getBlockedTargets().filter((target) => target.kind === "website");
  }

  getBlockedAppTargets() {
    return this.getBlockedTargets().filter((target) => target.kind === "app");
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

  submitDistractionReason(attemptId: string, reason: string) {
    this.storage.updateAttemptReason(attemptId, reason);

    if (this.punishment?.attemptId === attemptId) {
      /* Record actual duration spent on the prompt */
      const actualSeconds = Math.ceil(
        (Date.now() - new Date(this.punishment.startedAt).getTime()) / 1000
      );
      this.storage.incrementGuidedReset(
        this.activeSession!.id,
        Math.max(actualSeconds, 1)
      );
      this.punishment = null;
    }

    /* Refresh latestAttempt so snapshot includes the reason */
    this.latestAttempt = this.storage.getRecentAttempts(1)[0] ?? null;
    this.emit();
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
    /* Punishment stays until user submits a reason (1-hour ceiling as safety valve) */
    const endsAt = new Date(startedAt.getTime() + 60 * 60 * 1000);
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
        primary: "Why did you get distracted?",
        secondary: "Type your reason and press Enter to refocus."
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

  private startResolutionTicker() {
    const timer = setInterval(() => {
      const hadSession = Boolean(this.activeSession);
      const hadPunishment = Boolean(this.punishment);
      const session = this.getResolvedSession();
      const punishment = this.getResolvedPunishment();

      if (hadSession !== Boolean(session) || hadPunishment !== Boolean(punishment)) {
        this.emit();
      }
    }, RESOLUTION_TICK_MS);

    timer.unref?.();
  }

  private emit() {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
