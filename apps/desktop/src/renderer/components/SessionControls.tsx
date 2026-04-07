import type { BlockedTarget, DesktopSnapshot } from "@clockedin/shared";

type SessionControlsProps = {
  snapshot: DesktopSnapshot;
  onEnd: () => void;
  onSimulateAttempt: (target: BlockedTarget) => void;
  error: string | null;
};

export const SessionControls = ({
  snapshot,
  onEnd,
  onSimulateAttempt,
  error
}: SessionControlsProps) => (
  <section className="panel panel--hero">
    <div className="panel__copy">
      <span className="eyebrow">Focus Session</span>
      <h1>You are clocked in.</h1>
      <p>
        This session is active. Record a distraction when it happens and let the popup help you refocus
        instead of sliding into another tab.
      </p>
      <button className="button button--ghost" onClick={onEnd}>
        End Session
      </button>
    </div>

    <div className="hero-card">
      <span className="eyebrow">Distraction Buttons</span>
      <h2 className="hero-card__title">Quick test actions</h2>
      <p className="hero-card__copy">
        Use these buttons to record a distraction while the app stays small and self-contained.
      </p>

      {error ? <p className="inline-error">{error}</p> : null}

      <div className="target-stack">
        {snapshot.blockedTargets.map((target) => (
          <button
            key={target.id}
            className="target-chip"
            type="button"
            onClick={() => onSimulateAttempt(target)}
          >
            <span>{target.label}</span>
            <small>{target.kind === "website" ? "Record website distraction" : "Record app distraction"}</small>
          </button>
        ))}
      </div>
    </div>
  </section>
);
