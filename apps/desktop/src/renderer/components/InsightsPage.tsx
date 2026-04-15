import type { DesktopSnapshot, SessionRoundup, WeeklyDailyInsight } from "@clockedin/shared";

import { BubbleField, AMBIENT_BUBBLES } from "./BubbleField";
import { MetricCard } from "./MetricCard";
import { WindowGrabBar } from "./WindowGrabBar";
import { formatHoursAndMinutes, formatRelativeMinutes } from "../lib/time";

type InsightsPageProps = {
  snapshot: DesktopSnapshot;
  onBack: () => void;
};

const formatRange = (startIso: string, endIso: string) => {
  const start = new Date(startIso);
  const end = new Date(endIso);

  return `${start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  })} - ${end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  })}`;
};

const formatSessionDate = (session: SessionRoundup) =>
  new Date(session.startedAt).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });

const getBestFocusDay = (daily: WeeklyDailyInsight[]) =>
  daily
    .filter((day) => day.focusScore !== null)
    .sort((left, right) => (right.focusScore ?? 0) - (left.focusScore ?? 0))[0] ?? null;

const getStatusTone = (status: SessionRoundup["status"]) => {
  switch (status) {
    case "completed":
      return "session-pill session-pill--completed";
    case "cancelled":
      return "session-pill session-pill--cancelled";
    default:
      return "session-pill session-pill--active";
  }
};

export const InsightsPage = ({ snapshot, onBack }: InsightsPageProps) => {
  const { weeklyInsights } = snapshot;
  const attemptMax = Math.max(...weeklyInsights.daily.map((day) => day.attempts), 1);
  const focusMax = Math.max(...weeklyInsights.daily.map((day) => day.focusSeconds), 1);
  const bestFocusDay = getBestFocusDay(weeklyInsights.daily);
  const scoreLabel =
    weeklyInsights.averageFocusScore === null ? "No score yet" : `${weeklyInsights.averageFocusScore}%`;

  return (
    <main className="insights-shell">
      <BubbleField bubbles={AMBIENT_BUBBLES} />
      <WindowGrabBar />

      <section className="insights-layout">
        <div className="top-bar insights-top-bar">
          <div className="insights-copy">
            <span className="eyebrow">Weekly Insights</span>
            <h1 className="insights-title">A clearer read on your focus habits.</h1>
            <p>
              Review distraction pressure, weekly session roundups, and how steady your focus has
              been over the last seven days.
            </p>
            <p className="recorded-copy">
              Window: {formatRange(weeklyInsights.rangeStart, weeklyInsights.rangeEnd)}
            </p>
          </div>

          <div className="insights-actions">
            {snapshot.activeSession ? (
              <div className="status-pill status-pill--connected">
                <span className="status-pill__dot" />
                Active session live
              </div>
            ) : null}

            <button className="button button--ghost" onClick={onBack}>
              {snapshot.activeSession ? "Back to Session" : "Back"}
            </button>
          </div>
        </div>

        <section className="metrics-grid">
          <MetricCard
            label="Average Focus Score"
            value={scoreLabel}
            hint={
              bestFocusDay
                ? `${bestFocusDay.label} was strongest at ${bestFocusDay.focusScore}%`
                : "Complete a session to start generating scores"
            }
          />
          <MetricCard
            label="Distractions This Week"
            value={`${weeklyInsights.totalAttempts}`}
            hint={`${Math.round(weeklyInsights.totalAttempts / 7)} average per day`}
          />
          <MetricCard
            label="Focus Time Scheduled"
            value={formatHoursAndMinutes(weeklyInsights.totalFocusSeconds)}
            hint={`${weeklyInsights.completedSessions}/${weeklyInsights.totalSessions} sessions completed`}
          />
          <MetricCard
            label="Focus Streak"
            value={`${weeklyInsights.streakDays} day${weeklyInsights.streakDays === 1 ? "" : "s"}`}
            hint="Consecutive days with at least one focus block"
          />
        </section>

        <section className="insights-grid">
          <article className="panel insights-panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">Trend</span>
                <h2>Distractions over time</h2>
              </div>
              <p className="insights-panel__meta">Attempts blocked by day</p>
            </div>

            <div className="bar-chart">
              {weeklyInsights.daily.map((day) => (
                <div key={day.date} className="bar-chart__item">
                  <span className="bar-chart__value">{day.attempts}</span>
                  <div className="bar-chart__track">
                    <span
                      className="bar-chart__fill"
                      style={{
                        height: `${Math.max((day.attempts / attemptMax) * 100, day.attempts > 0 ? 10 : 0)}%`
                      }}
                    />
                  </div>
                  <strong>{day.label}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="panel insights-panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">Trend</span>
                <h2>Focus pace</h2>
              </div>
              <p className="insights-panel__meta">Daily score and planned focus time</p>
            </div>

            <div className="score-strip">
              {weeklyInsights.daily.map((day) => (
                <div key={day.date} className="score-strip__item">
                  <span>{day.label}</span>
                  <strong>{day.focusScore === null ? "--" : `${day.focusScore}%`}</strong>
                  <div className="score-strip__meter">
                    <span
                      style={{
                        height: `${day.focusScore ?? 0}%`
                      }}
                    />
                  </div>
                  <small>
                    {day.focusSeconds === 0
                      ? "No session"
                      : `${formatHoursAndMinutes(day.focusSeconds)} planned`}
                  </small>
                  <div className="score-strip__focus-track">
                    <span
                      style={{
                        width: `${(day.focusSeconds / focusMax) * 100}%`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="panel insights-panel">
            <div className="panel__header">
              <div>
                <span className="eyebrow">Breakdown</span>
                <h2>Most common distractions</h2>
              </div>
            </div>

            <div className="history-list">
              {weeklyInsights.topDistractions.length === 0 ? (
                <p className="empty-state">No distractions logged this week.</p>
              ) : (
                weeklyInsights.topDistractions.map((target) => (
                  <div key={target.targetId} className="history-row insights-row">
                    <div>
                      <span>Last seen {new Date(target.lastDetectedAt).toLocaleString()}</span>
                      <strong>{target.targetLabel}</strong>
                    </div>
                    <time>{target.attempts} hit{target.attempts === 1 ? "" : "s"}</time>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="panel insights-panel insights-panel--wide">
            <div className="panel__header">
              <div>
                <span className="eyebrow">Roundup</span>
                <h2>This week&apos;s sessions</h2>
              </div>
              <p className="insights-panel__meta">Each block with attempts, reset time, and score</p>
            </div>

            <div className="history-list">
              {weeklyInsights.sessions.length === 0 ? (
                <p className="empty-state">Start a focus block to populate the weekly roundup.</p>
              ) : (
                weeklyInsights.sessions.map((session) => (
                  <div key={session.sessionId} className="session-roundup">
                    <div className="session-roundup__main">
                      <span>{formatSessionDate(session)}</span>
                      <strong>{formatHoursAndMinutes(session.durationSeconds)} focus block</strong>
                    </div>

                    <div className="session-roundup__stats">
                      <span className={getStatusTone(session.status)}>{session.status}</span>
                      <span>{session.attempts} distraction{session.attempts === 1 ? "" : "s"}</span>
                      <span>{formatRelativeMinutes(session.resetSeconds)} reset time</span>
                      <span>{session.focusScore}% score</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
};
