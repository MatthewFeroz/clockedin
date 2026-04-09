import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

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

    expect(storage.getBlockedTargets()).toHaveLength(3);
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
});
