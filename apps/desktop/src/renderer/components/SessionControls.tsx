import { useState } from "react";
import type { DesktopSnapshot } from "@clockedin/shared";

import { formatDuration, formatRelativeMinutes } from "../lib/time";

type SessionControlsProps = {
  snapshot: DesktopSnapshot;
  now: number;
  onEnd: () => void;
};

export const SessionControls = ({ snapshot, now, onEnd }: SessionControlsProps) => {
  const [confirming, setConfirming] = useState(false);

  const session = snapshot.activeSession;
  const secondsRemaining = session
    ? Math.max(0, Math.ceil((new Date(session.endsAt).getTime() - now) / 1000))
    : 0;

  return (
    <>
      <section className="hero-center">
        <span className="eyebrow">Focus Session</span>
        <h1 className="hero-center__title">You are clocked in.</h1>

        <div className="hero-center__timer">
          <strong>{formatDuration(secondsRemaining)}</strong>
          <span>remaining</span>
        </div>

        <p className="hero-center__stats">
          {snapshot.attempts.length} distraction{snapshot.attempts.length !== 1 ? "s" : ""}
          {session
            ? ` \u00b7 ${formatRelativeMinutes(session.guidedResetSecondsAccumulated)} reset time`
            : ""}
        </p>

        <button className="button button--ghost" onClick={() => setConfirming(true)}>
          End Session
        </button>
      </section>

      {confirming && (
        <div className="modal-backdrop" onClick={() => setConfirming(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Are you sure you want to end this session?</h2>
            <p>Your progress will be saved.</p>
            <div className="modal__actions">
              <button className="button button--ghost" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button
                className="button button--primary"
                onClick={() => {
                  setConfirming(false);
                  onEnd();
                }}
              >
                Yes, end session
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
