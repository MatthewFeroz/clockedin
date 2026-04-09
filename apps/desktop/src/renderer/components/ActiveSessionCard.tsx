import type { DesktopSnapshot } from "@clockedin/shared";

import { formatDuration, formatRelativeMinutes } from "../lib/time";

type ActiveSessionCardProps = {
  snapshot: DesktopSnapshot;
  now: number;
};

export const ActiveSessionCard = ({ snapshot, now }: ActiveSessionCardProps) => {
  if (!snapshot.activeSession) {
    return (
      <section className="panel panel--soft">
        <h2>No active session</h2>
        <p>Start a focus block to begin tracking distracting sites and apps.</p>
      </section>
    );
  }

  const secondsRemaining = Math.max(
    0,
    Math.ceil((new Date(snapshot.activeSession.endsAt).getTime() - now) / 1000)
  );

  return (
    <section className="panel panel--soft">
      <div className="panel__header">
        <div>
          <span className="eyebrow">Active Session</span>
          <h2>{formatDuration(secondsRemaining)} remaining</h2>
        </div>
        <div className="countdown-badge">{Math.ceil(secondsRemaining / 60)} min</div>
      </div>

      <p className="recorded-copy recorded-copy--panel">
        {snapshot.attempts.length} distractions recorded during this focus session.
      </p>

      <div className="mini-stats">
        <div>
          <span>Attempts tracked</span>
          <strong>{snapshot.attempts.length}</strong>
        </div>
        <div>
          <span>Latest distraction</span>
          <strong>{snapshot.latestAttempt?.targetLabel ?? "Nothing yet"}</strong>
        </div>
        <div>
          <span>Total reset time</span>
          <strong>{formatRelativeMinutes(snapshot.activeSession.guidedResetSecondsAccumulated)}</strong>
        </div>
      </div>
    </section>
  );
};
