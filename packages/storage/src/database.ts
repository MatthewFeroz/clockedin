import Database from "better-sqlite3";

import {
  DEFAULT_BLOCKED_TARGETS,
  DEFAULT_SETTINGS,
  type AppSettingMap,
  type AttemptEvent,
  type BlockedTarget,
  type FocusSession,
  metricsSummarySchema,
  type MetricsSummary,
  type UpdateSettingInput
} from "@clockedin/shared";

const nowIso = () => new Date().toISOString();

const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

type DatabasePath = string;

export class ClockedinStorage {
  private readonly db: Database.Database;

  constructor(path: DatabasePath) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.initialize();
  }

  private initialize() {
    const insertBlockedTarget = this.db.prepare(`
      INSERT INTO blocked_targets (id, kind, label, enabled, match_json)
      VALUES (@id, @kind, @label, @enabled, @match_json)
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS blocked_targets (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        label TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        match_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS focus_sessions (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        ends_at TEXT NOT NULL,
        status TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        guided_reset_seconds_accumulated INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS attempt_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        source TEXT NOT NULL,
        target_id TEXT NOT NULL,
        target_label TEXT NOT NULL,
        detected_at TEXT NOT NULL,
        platform TEXT NOT NULL,
        context_json TEXT NOT NULL,
        reason TEXT
      );

      CREATE TABLE IF NOT EXISTS punishment_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        attempt_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ends_at TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      );
    `);

    const targetCount = this.db.prepare("SELECT COUNT(*) as count FROM blocked_targets").get() as {
      count: number;
    };

    if (targetCount.count === 0) {
      const insertMany = this.db.transaction((targets: BlockedTarget[]) => {
        for (const target of targets) {
          insertBlockedTarget.run({
            ...target,
            enabled: target.enabled ? 1 : 0,
            match_json: JSON.stringify(target.match)
          });
        }
      });

      insertMany(DEFAULT_BLOCKED_TARGETS);
    } else {
      const existingIds = new Set(
        (
          this.db.prepare("SELECT id FROM blocked_targets").all() as Array<{
            id: string;
          }>
        ).map((row) => row.id)
      );

      const missingDefaults = DEFAULT_BLOCKED_TARGETS.filter((target) => !existingIds.has(target.id));
      if (missingDefaults.length > 0) {
        const insertMany = this.db.transaction((targets: BlockedTarget[]) => {
          for (const target of targets) {
            insertBlockedTarget.run({
              ...target,
              enabled: target.enabled ? 1 : 0,
              match_json: JSON.stringify(target.match)
            });
          }
        });

        insertMany(missingDefaults);
      }
    }

    /* ── Migration: add reason column to attempt_events if missing ── */
    const columns = this.db
      .prepare("PRAGMA table_info(attempt_events)")
      .all() as Array<{ name: string }>;
    if (!columns.some((c) => c.name === "reason")) {
      this.db.exec("ALTER TABLE attempt_events ADD COLUMN reason TEXT");
    }

    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      this.db
        .prepare("INSERT OR IGNORE INTO settings (key, value_json) VALUES (?, ?)")
        .run(key, JSON.stringify(value));
    }
  }

  getBlockedTargets(): BlockedTarget[] {
    const rows = this.db
      .prepare("SELECT id, kind, label, enabled, match_json FROM blocked_targets ORDER BY kind, label")
      .all() as Array<{
      id: string;
      kind: BlockedTarget["kind"];
      label: string;
      enabled: number;
      match_json: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      label: row.label,
      enabled: Boolean(row.enabled),
      match: JSON.parse(row.match_json)
    }));
  }

  getSettings(): AppSettingMap {
    const rows = this.db.prepare("SELECT key, value_json FROM settings").all() as Array<{
      key: keyof AppSettingMap;
      value_json: string;
    }>;

    const merged: AppSettingMap = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      const value = JSON.parse(row.value_json);
      switch (row.key) {
        case "defaultSessionDurationMinutes":
          merged.defaultSessionDurationMinutes = value as number;
          break;
      }
    }

    return merged;
  }

  updateSetting(input: UpdateSettingInput): AppSettingMap {
    this.db
      .prepare("INSERT INTO settings (key, value_json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json")
      .run(input.key, JSON.stringify(input.value));

    return this.getSettings();
  }

  startSession(durationMinutes: number): FocusSession {
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);
    const session: FocusSession = {
      id: createId("session"),
      startedAt: startedAt.toISOString(),
      endsAt: endsAt.toISOString(),
      status: "active",
      durationSeconds: durationMinutes * 60,
      guidedResetSecondsAccumulated: 0
    };

    this.db
      .prepare(`
        INSERT INTO focus_sessions (
          id, started_at, ends_at, status, duration_seconds, guided_reset_seconds_accumulated
        ) VALUES (
          @id, @startedAt, @endsAt, @status, @durationSeconds, @guidedResetSecondsAccumulated
        )
      `)
      .run(session);

    return session;
  }

  finishSession(sessionId: string, status: FocusSession["status"]) {
    this.db
      .prepare("UPDATE focus_sessions SET status = ? WHERE id = ?")
      .run(status, sessionId);
  }

  incrementGuidedReset(sessionId: string, seconds: number) {
    this.db
      .prepare(
        "UPDATE focus_sessions SET guided_reset_seconds_accumulated = guided_reset_seconds_accumulated + ? WHERE id = ?"
      )
      .run(seconds, sessionId);
  }

  recordAttempt(event: Omit<AttemptEvent, "id" | "detectedAt">): AttemptEvent {
    const attempt: AttemptEvent = {
      ...event,
      id: createId("attempt"),
      detectedAt: nowIso()
    };

    this.db
      .prepare(`
        INSERT INTO attempt_events (
          id, session_id, source, target_id, target_label, detected_at, platform, context_json
        ) VALUES (
          @id, @sessionId, @source, @targetId, @targetLabel, @detectedAt, @platform, @context_json
        )
      `)
      .run({
        ...attempt,
        context_json: JSON.stringify(attempt.context)
      });

    return attempt;
  }

  updateAttemptReason(attemptId: string, reason: string) {
    this.db
      .prepare("UPDATE attempt_events SET reason = ? WHERE id = ?")
      .run(reason, attemptId);
  }

  recordPunishment(sessionId: string, attemptId: string, durationSeconds: number, startedAt: string, endsAt: string) {
    this.db
      .prepare(`
        INSERT INTO punishment_events (id, session_id, attempt_id, started_at, ends_at, duration_seconds)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(createId("punish"), sessionId, attemptId, startedAt, endsAt, durationSeconds);
  }

  getRecentAttempts(limit = 8): AttemptEvent[] {
    const rows = this.db
      .prepare(
        "SELECT id, session_id, source, target_id, target_label, detected_at, platform, context_json, reason FROM attempt_events ORDER BY detected_at DESC LIMIT ?"
      )
      .all(limit) as Array<{
      id: string;
      session_id: string;
      source: AttemptEvent["source"];
      target_id: string;
      target_label: string;
      detected_at: string;
      platform: AttemptEvent["platform"];
      context_json: string;
      reason: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      source: row.source,
      targetId: row.target_id,
      targetLabel: row.target_label,
      detectedAt: row.detected_at,
      platform: row.platform,
      reason: row.reason ?? undefined,
      context: JSON.parse(row.context_json)
    }));
  }

  getRecentSessions(limit = 10): FocusSession[] {
    const rows = this.db
      .prepare(
        "SELECT id, started_at, ends_at, status, duration_seconds, guided_reset_seconds_accumulated FROM focus_sessions ORDER BY started_at DESC LIMIT ?"
      )
      .all(limit) as Array<{
      id: string;
      started_at: string;
      ends_at: string;
      status: FocusSession["status"];
      duration_seconds: number;
      guided_reset_seconds_accumulated: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      startedAt: row.started_at,
      endsAt: row.ends_at,
      status: row.status,
      durationSeconds: row.duration_seconds,
      guidedResetSecondsAccumulated: row.guided_reset_seconds_accumulated
    }));
  }

  getMetrics(): MetricsSummary {
    const attemptCountRow = this.db.prepare("SELECT COUNT(*) as count FROM attempt_events").get() as {
      count: number;
    };
    const totalResetRow = this.db
      .prepare("SELECT COALESCE(SUM(guided_reset_seconds_accumulated), 0) as count FROM focus_sessions")
      .get() as { count: number };
    const completedSessionRow = this.db
      .prepare("SELECT COUNT(*) as count FROM focus_sessions WHERE status = 'completed'")
      .get() as { count: number };
    const sessionCountRow = this.db.prepare("SELECT COUNT(*) as count FROM focus_sessions").get() as {
      count: number;
    };
    const todayCount = this.db
      .prepare("SELECT COUNT(*) as count FROM attempt_events WHERE substr(detected_at, 1, 10) = date('now')")
      .get() as { count: number };
    const weekCount = this.db
      .prepare("SELECT COUNT(*) as count FROM attempt_events WHERE substr(detected_at, 1, 10) >= date('now', '-6 days')")
      .get() as { count: number };

    return metricsSummarySchema.parse({
      attemptsBlocked: attemptCountRow.count,
      totalResetSeconds: totalResetRow.count,
      sessionsCompleted: completedSessionRow.count,
      averageAttemptsPerSession: sessionCountRow.count === 0 ? 0 : attemptCountRow.count / sessionCountRow.count,
      todayAttempts: todayCount.count,
      weekAttempts: weekCount.count
    });
  }

  close() {
    this.db.close();
  }
}
