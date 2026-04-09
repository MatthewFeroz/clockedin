import type { DesktopSnapshot } from "@clockedin/shared";

import { formatRelativeMinutes } from "../lib/time";

type HistoryPanelProps = {
  snapshot: DesktopSnapshot;
};

export const HistoryPanel = ({ snapshot }: HistoryPanelProps) => (
  <section className="history-grid">
    <article className="panel">
      <div className="panel__header">
        <div>
          <span className="eyebrow">Attempts</span>
          <h2>Recent distractions</h2>
        </div>
      </div>

      <div className="history-list">
        {snapshot.attempts.length === 0 ? (
          <p className="empty-state">No attempts recorded yet.</p>
        ) : (
          snapshot.attempts.map((attempt) => (
            <div key={attempt.id} className="history-row">
              <div>
                <strong>{attempt.targetLabel}</strong>
                <span>{attempt.context.url ?? attempt.context.windowTitle ?? attempt.context.appName ?? "Manual event"}</span>
              </div>
              <time>{new Date(attempt.detectedAt).toLocaleTimeString()}</time>
            </div>
          ))
        )}
      </div>
    </article>

    <article className="panel">
      <div className="panel__header">
        <div>
          <span className="eyebrow">Sessions</span>
          <h2>Recent history</h2>
        </div>
      </div>

      <div className="history-list">
        {snapshot.recentSessions.length === 0 ? (
          <p className="empty-state">No sessions saved yet.</p>
        ) : (
          snapshot.recentSessions.map((session) => (
            <div key={session.id} className="history-row">
              <div>
                <strong>{session.status}</strong>
                <span>{new Date(session.startedAt).toLocaleString()}</span>
              </div>
              <time>{formatRelativeMinutes(session.guidedResetSecondsAccumulated)}</time>
            </div>
          ))
        )}
      </div>
    </article>
  </section>
);
