import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import { ClockedinStorage } from "./database";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("ClockedinStorage", () => {
  it("seeds defaults and records attempts", () => {
    const dir = mkdtempSync(join(tmpdir(), "clockedin-storage-"));
    tempDirs.push(dir);
    const storage = new ClockedinStorage(join(dir, "clockedin.db"));

    const session = storage.startSession(60);
    const attempt = storage.recordAttempt({
      sessionId: session.id,
      source: "native-helper",
      targetId: "website-youtube",
      targetLabel: "YouTube",
      platform: "macos",
      context: {
        url: "https://youtube.com"
      }
    });

    storage.incrementGuidedReset(session.id, 15);
    storage.recordPunishment(session.id, attempt.id, 15, session.startedAt, session.endsAt);

    expect(storage.getBlockedTargets()).toHaveLength(5);
    expect(storage.getRecentAttempts(1)[0]?.targetId).toBe("website-youtube");
    expect(storage.getMetrics().attemptsBlocked).toBe(1);
    expect(storage.getMetrics().totalResetSeconds).toBe(15);

    storage.close();
  });

  it("does not double count reset time across multiple attempts in one session", () => {
    const dir = mkdtempSync(join(tmpdir(), "clockedin-storage-"));
    tempDirs.push(dir);
    const storage = new ClockedinStorage(join(dir, "clockedin.db"));

    const session = storage.startSession(60);

    for (let index = 0; index < 2; index += 1) {
      const attempt = storage.recordAttempt({
        sessionId: session.id,
        source: "native-helper",
        targetId: "website-youtube",
        targetLabel: "YouTube",
        platform: "macos",
        context: {
          url: `https://youtube.com/watch?v=${index}`
        }
      });
      storage.incrementGuidedReset(session.id, 15);
      storage.recordPunishment(session.id, attempt.id, 15, session.startedAt, session.endsAt);
    }

    expect(storage.getMetrics().attemptsBlocked).toBe(2);
    expect(storage.getMetrics().totalResetSeconds).toBe(30);

    storage.close();
  });

  it("backfills newly added default blockers into existing databases", () => {
    const dir = mkdtempSync(join(tmpdir(), "clockedin-storage-"));
    tempDirs.push(dir);
    const dbPath = join(dir, "clockedin.db");
    const db = new Database(dbPath);

    db.exec(`
      CREATE TABLE blocked_targets (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        label TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        match_json TEXT NOT NULL
      );

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      );
    `);

    db.prepare(`
      INSERT INTO blocked_targets (id, kind, label, enabled, match_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      "website-youtube",
      "website",
      "YouTube",
      1,
      JSON.stringify({
        domains: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]
      })
    );
    db.close();

    const storage = new ClockedinStorage(dbPath);
    const targetIds = storage.getBlockedTargets().map((target) => target.id);

    expect(targetIds).toEqual([
      "website-hacker-news",
      "website-linkedin",
      "website-reddit",
      "website-twitter",
      "website-youtube"
    ]);

    storage.close();
  });

  it("builds a weekly insights roundup from recent sessions and attempts", () => {
    const dir = mkdtempSync(join(tmpdir(), "clockedin-storage-"));
    tempDirs.push(dir);
    const dbPath = join(dir, "clockedin.db");

    let storage = new ClockedinStorage(dbPath);
    const sessionOne = storage.startSession(60);
    storage.recordAttempt({
      sessionId: sessionOne.id,
      source: "native-helper",
      targetId: "website-youtube",
      targetLabel: "YouTube",
      platform: "windows",
      context: {
        url: "https://youtube.com/watch?v=weekly"
      }
    });
    storage.incrementGuidedReset(sessionOne.id, 30);
    storage.finishSession(sessionOne.id, "completed");

    const sessionTwo = storage.startSession(30);
    storage.finishSession(sessionTwo.id, "cancelled");
    storage.close();

    const db = new Database(dbPath);
    const now = new Date();
    const twoDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 9, 0, 0);
    const oneDayAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 14, 30, 0);

    db.prepare("UPDATE focus_sessions SET started_at = ?, ends_at = ? WHERE id = ?").run(
      twoDaysAgo.toISOString(),
      new Date(twoDaysAgo.getTime() + 60 * 60 * 1000).toISOString(),
      sessionOne.id
    );
    db.prepare("UPDATE focus_sessions SET started_at = ?, ends_at = ? WHERE id = ?").run(
      oneDayAgo.toISOString(),
      new Date(oneDayAgo.getTime() + 30 * 60 * 1000).toISOString(),
      sessionTwo.id
    );
    db.prepare("UPDATE attempt_events SET detected_at = ? WHERE session_id = ?").run(
      new Date(twoDaysAgo.getTime() + 10 * 60 * 1000).toISOString(),
      sessionOne.id
    );
    db.close();

    storage = new ClockedinStorage(dbPath);
    const insights = storage.getWeeklyInsights();

    expect(insights.totalSessions).toBe(2);
    expect(insights.totalAttempts).toBe(1);
    expect(insights.completedSessions).toBe(1);
    expect(insights.sessions).toHaveLength(2);
    expect(insights.topDistractions[0]?.targetId).toBe("website-youtube");
    expect(insights.daily.some((day) => day.attempts === 1)).toBe(true);

    storage.close();
  });
});
