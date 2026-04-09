import type { DesktopSnapshot } from "@clockedin/shared";

type SessionControlsProps = {
  snapshot: DesktopSnapshot;
  onEnd: () => void;
};

export const SessionControls = ({ onEnd }: SessionControlsProps) => (
  <section className="panel panel--hero">
    <div className="panel__copy">
      <span className="eyebrow">Focus Session</span>
      <h1>You are clocked in.</h1>
      <p>
        This session is active. Clockedin will track distracting apps and browser tabs while you work
        and use the popup to help you refocus.
      </p>
      <button className="button button--ghost" onClick={onEnd}>
        End Session
      </button>
    </div>
  </section>
);
