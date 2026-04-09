import { useEffect, useState } from "react";

import { ActiveSessionCard } from "./components/ActiveSessionCard";
import { BubbleField, AMBIENT_BUBBLES } from "./components/BubbleField";
import { HistoryPanel } from "./components/HistoryPanel";
import { MetricCard } from "./components/MetricCard";
import { OverlayView } from "./components/OverlayView";
import { SessionControls } from "./components/SessionControls";
import { StartScreen } from "./components/StartScreen";
import { WindowGrabBar } from "./components/WindowGrabBar";
import { useNow } from "./hooks/useNow";
import { useSnapshot } from "./hooks/useSnapshot";
import { formatRelativeMinutes } from "./lib/time";

type DashboardProps = {
  snapshot: NonNullable<ReturnType<typeof useSnapshot>["snapshot"]>;
};

const Dashboard = ({ snapshot }: DashboardProps) => {
  const now = useNow();

  return (
    <main className="app-shell">
      <BubbleField bubbles={AMBIENT_BUBBLES} />
      <WindowGrabBar />

      <header className="top-bar">
        <div>
          <span className="eyebrow">Clockedin</span>
          <p>A small focus app with a timer, distraction tracker, and refocus popup.</p>
          <p className="recorded-copy">
            {snapshot.metrics.attemptsBlocked} distractions recorded{snapshot.activeSession ? " this session run." : "."}
          </p>
        </div>
      </header>

      <SessionControls snapshot={snapshot} onEnd={() => void window.clockedin.endSession()} />

      <section className="metrics-grid metrics-grid--compact">
        <MetricCard
          label="Attempts tracked"
          value={String(snapshot.metrics.attemptsBlocked)}
          hint={`${snapshot.metrics.todayAttempts} today`}
        />
        <MetricCard
          label="Reset time incurred"
          value={formatRelativeMinutes(snapshot.metrics.totalResetSeconds)}
          hint={`${snapshot.metrics.weekAttempts} attempts this week`}
        />
        <MetricCard
          label="Completed sessions"
          value={String(snapshot.metrics.sessionsCompleted)}
          hint={`${snapshot.metrics.averageAttemptsPerSession.toFixed(1)} avg attempts / session`}
        />
      </section>

      <ActiveSessionCard snapshot={snapshot} now={now} />
      <HistoryPanel snapshot={snapshot} />
    </main>
  );
};

export const App = () => {
  const { snapshot, error } = useSnapshot();
  const isOverlay = window.location.hash.includes("/overlay");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    if (snapshot) {
      setDurationMinutes(snapshot.settings.defaultSessionDurationMinutes);
    }
  }, [snapshot?.settings.defaultSessionDurationMinutes]);

  if (!snapshot) {
    return (
      <main className="loading-shell">
        <BubbleField bubbles={AMBIENT_BUBBLES} />
        <WindowGrabBar />
        <div className="loading-card">
          <span className="eyebrow">Clockedin</span>
          <h1>Loading your focus workspace…</h1>
          <p>{error ?? "Starting the desktop bridge and local workspace."}</p>
        </div>
      </main>
    );
  }

  if (isOverlay) {
    return <OverlayView snapshot={snapshot} />;
  }

  if (!snapshot.activeSession) {
    return (
      <StartScreen
        durationMinutes={durationMinutes}
        onDurationChange={setDurationMinutes}
        onClockIn={async () => {
          setStartError(null);
          try {
            await window.clockedin.startSession({
              durationMinutes
            });
            await window.clockedin.updateSetting({
              key: "defaultSessionDurationMinutes",
              value: durationMinutes
            });
          } catch (nextError) {
            setStartError(nextError instanceof Error ? nextError.message : "Could not clock in.");
          }
        }}
        error={startError}
      />
    );
  }

  return <Dashboard snapshot={snapshot} />;
};
