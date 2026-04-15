import { useEffect, useRef, useState } from "react";

import { BubbleField, AMBIENT_BUBBLES } from "./components/BubbleField";
import { HistoryPanel } from "./components/HistoryPanel";
import { InsightsPage } from "./components/InsightsPage";
import { OverlayView } from "./components/OverlayView";
import { SessionControls } from "./components/SessionControls";
import { StartScreen } from "./components/StartScreen";
import { WindowGrabBar } from "./components/WindowGrabBar";
import { useNow } from "./hooks/useNow";
import { useSnapshot } from "./hooks/useSnapshot";

type Route = "home" | "insights" | "overlay";

const getRoute = (): Route => {
  const hash = window.location.hash;

  if (hash.includes("/overlay")) {
    return "overlay";
  }

  if (hash.includes("/insights")) {
    return "insights";
  }

  return "home";
};

type DashboardProps = {
  snapshot: NonNullable<ReturnType<typeof useSnapshot>["snapshot"]>;
  onViewInsights: () => void;
};

const Dashboard = ({ snapshot, onViewInsights }: DashboardProps) => {
  const now = useNow();

  return (
    <main className="app-shell">
      <BubbleField bubbles={AMBIENT_BUBBLES} />
      <WindowGrabBar />

      <SessionControls
        snapshot={snapshot}
        now={now}
        onViewInsights={onViewInsights}
        onEnd={() => void window.clockedin.endSession()}
      />

      <HistoryPanel snapshot={snapshot} />
    </main>
  );
};

export const App = () => {
  const { snapshot, error } = useSnapshot();
  const [route, setRoute] = useState<Route>(() => getRoute());
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [startError, setStartError] = useState<string | null>(null);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const previousActiveSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const onHashChange = () => {
      setRoute(getRoute());
    };

    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  useEffect(() => {
    if (snapshot) {
      setDurationMinutes(snapshot.settings.defaultSessionDurationMinutes);
    }
  }, [snapshot?.settings.defaultSessionDurationMinutes]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    const previousActiveSessionId = previousActiveSessionIdRef.current;
    const currentActiveSessionId = snapshot.activeSession?.id ?? null;

    if (previousActiveSessionId && !currentActiveSessionId) {
      const mostRecentSession = snapshot.recentSessions[0];
      if (
        mostRecentSession?.id === previousActiveSessionId &&
        mostRecentSession.status === "completed"
      ) {
        setCompletionMessage(
          "Hey, you did a great job focusing on this session. Let me know if you'd like to start another one."
        );
      }
    }

    previousActiveSessionIdRef.current = currentActiveSessionId;
  }, [snapshot]);

  const openInsights = () => {
    window.location.hash = "/insights";
  };

  const openHome = () => {
    window.location.hash = "";
  };

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

  if (route === "overlay") {
    return <OverlayView snapshot={snapshot} />;
  }

  if (route === "insights") {
    return <InsightsPage snapshot={snapshot} onBack={openHome} />;
  }

  if (!snapshot.activeSession) {
    return (
      <StartScreen
        durationMinutes={durationMinutes}
        onDurationChange={setDurationMinutes}
        onViewInsights={openInsights}
        onClockIn={async () => {
          setStartError(null);
          setCompletionMessage(null);
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
        completionMessage={completionMessage}
        onDismissCompletionMessage={() => setCompletionMessage(null)}
      />
    );
  }

  return <Dashboard snapshot={snapshot} onViewInsights={openInsights} />;
};
