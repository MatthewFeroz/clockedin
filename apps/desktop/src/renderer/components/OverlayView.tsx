import type { DesktopSnapshot } from "@clockedin/shared";

import { useNow } from "../hooks/useNow";
import { BubbleField, OVERLAY_BUBBLES } from "./BubbleField";
import { WindowGrabBar } from "./WindowGrabBar";

type OverlayViewProps = {
  snapshot: DesktopSnapshot;
};

export const OverlayView = ({ snapshot }: OverlayViewProps) => {
  const now = useNow(200);
  const punishment = snapshot.punishment;
  const secondsRemaining = punishment
    ? Math.max(0, Math.ceil((new Date(punishment.endsAt).getTime() - now) / 1000))
    : 0;

  return (
    <main className="overlay-shell">
      <BubbleField bubbles={OVERLAY_BUBBLES} />
      <WindowGrabBar />

      <section className="overlay-card">
        <span className="eyebrow">Refocus Window</span>
        <div className="overlay-card__timer">
          <div className="breathing-ring breathing-ring--1" />
          <div className="breathing-ring breathing-ring--2" />
          <div className="breathing-ring breathing-ring--3" />
          <strong>{secondsRemaining}</strong>
        </div>
        <h1>{snapshot.attempts.length} distractions recorded</h1>
        <p>{punishment?.message.primary ?? "Take a deep breath."}</p>
        <p className="recorded-copy recorded-copy--overlay">
          {punishment?.message.secondary ?? "Refocus on what you intended to do."}
        </p>
        <div className="overlay-card__meta">
          <span>{snapshot.latestAttempt?.targetLabel ?? "Blocked distraction"}</span>
          <span>{snapshot.attempts.length} attempts this session</span>
        </div>
      </section>
    </main>
  );
};
