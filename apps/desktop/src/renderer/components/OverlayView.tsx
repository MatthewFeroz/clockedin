import { useRef, useState, useEffect } from "react";

import type { DesktopSnapshot } from "@clockedin/shared";

import { getActiveSessionAttemptCount } from "../lib/session";
import { BubbleField, OVERLAY_BUBBLES } from "./BubbleField";
import { WindowGrabBar } from "./WindowGrabBar";

type OverlayViewProps = {
  snapshot: DesktopSnapshot;
};

export const OverlayView = ({ snapshot }: OverlayViewProps) => {
  const punishment = snapshot.punishment;
  const attemptCount = getActiveSessionAttemptCount(snapshot);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Auto-focus the input whenever a new punishment appears */
  useEffect(() => {
    if (punishment?.active) {
      setReason("");
      setSubmitting(false);
      /* Small delay so the window is fully focused before we grab the input */
      const timer = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(timer);
    }
  }, [punishment?.attemptId]);

  const handleSubmit = async () => {
    const trimmed = reason.trim();
    if (!trimmed || !punishment?.attemptId || submitting) return;

    setSubmitting(true);
    await window.clockedin.submitDistractionReason(
      punishment.attemptId,
      trimmed
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

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
          <strong>{attemptCount}</strong>
        </div>

        <h1>Why were you distracted?</h1>

        <div className="overlay-reason">
          <input
            ref={inputRef}
            type="text"
            className="overlay-reason__input"
            placeholder="Type your reason..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={submitting}
            autoFocus
          />
          <span className="overlay-reason__hint">Press Enter to refocus</span>
        </div>

        <div className="overlay-card__meta">
          <span>{snapshot.latestAttempt?.targetLabel ?? "Recent distraction"}</span>
          <span>{attemptCount} attempts this session</span>
        </div>
      </section>
    </main>
  );
};
