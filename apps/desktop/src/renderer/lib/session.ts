import type { DesktopSnapshot } from "@clockedin/shared";

export const getActiveSessionAttemptCount = (snapshot: DesktopSnapshot) => {
  const activeSessionId = snapshot.activeSession?.id;
  if (!activeSessionId) {
    return 0;
  }

  return snapshot.attempts.filter((attempt) => attempt.sessionId === activeSessionId).length;
};
