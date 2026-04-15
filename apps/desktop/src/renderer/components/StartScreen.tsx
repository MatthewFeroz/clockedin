import type { ChangeEvent } from "react";

import { BubbleField, AMBIENT_BUBBLES } from "./BubbleField";
import { WindowGrabBar } from "./WindowGrabBar";

type StartScreenProps = {
  durationMinutes: number;
  onDurationChange: (value: number) => void;
  onClockIn: () => void;
  onViewInsights: () => void;
  error: string | null;
  completionMessage: string | null;
  onDismissCompletionMessage: () => void;
};

export const StartScreen = ({
  durationMinutes,
  onDurationChange,
  onClockIn,
  onViewInsights,
  error,
  completionMessage,
  onDismissCompletionMessage
}: StartScreenProps) => (
  <main className="start-shell">
    <BubbleField bubbles={AMBIENT_BUBBLES} />
    <WindowGrabBar />

    <section className="start-card">
      <span className="eyebrow">Clockedin</span>
      <h1>Clock in and focus.</h1>
      <p className="start-copy">
        Start a focus session, track distracting tabs and apps locally, and use the refocus popup
        when your attention slips.
      </p>

      <label className="field field--start">
        <span>Focus block length</span>
        <select
          value={durationMinutes}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => onDurationChange(Number(event.target.value))}
        >
          {[25, 30, 45, 60, 90, 120].map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} minutes
            </option>
          ))}
        </select>
      </label>

      <div className="start-actions">
        <button className="button button--primary button--clock-in" onClick={onClockIn}>
          Clock In
        </button>
        <button className="button button--ghost button--clock-in" onClick={onViewInsights}>
          Weekly Insights
        </button>
      </div>

      {error ? <p className="inline-error inline-error--center">{error}</p> : null}
    </section>

    {completionMessage ? (
      <div className="modal-backdrop" onClick={onDismissCompletionMessage}>
        <div className="modal modal--reward" onClick={(event) => event.stopPropagation()}>
          <span className="eyebrow">Session Complete</span>
          <h2>You finished your focus block.</h2>
          <p>{completionMessage}</p>
          <div className="modal__actions">
            <button
              className="button button--primary"
              onClick={onDismissCompletionMessage}
            >
              Start another session
            </button>
          </div>
        </div>
      </div>
    ) : null}
  </main>
);
