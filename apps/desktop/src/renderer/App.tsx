import { useEffect, useState } from "react";

import { BubbleField, AMBIENT_BUBBLES } from "./components/BubbleField";
import { HistoryPanel } from "./components/HistoryPanel";
import { OverlayView } from "./components/OverlayView";
import { SessionControls } from "./components/SessionControls";
import { StartScreen } from "./components/StartScreen";
import { WindowGrabBar } from "./components/WindowGrabBar";
import { useNow } from "./hooks/useNow";
import { useSnapshot } from "./hooks/useSnapshot";

type DashboardProps = {
  snapshot: NonNullable<ReturnType<typeof useSnapshot>["snapshot"]>;
};

const Dashboard = ({ snapshot }: DashboardProps) => {
  const now = useNow();

  return (
    <main className="app-shell">
      <BubbleField bubbles={AMBIENT_BUBBLES} />
      <WindowGrabBar />

      <SessionControls
        snapshot={snapshot}
        now={now}
        onEnd={() => void window.clockedin.endSession()}
      />

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
