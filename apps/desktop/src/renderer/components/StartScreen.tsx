import type { ChangeEvent } from "react";

import { BubbleField, AMBIENT_BUBBLES } from "./BubbleField";
import { WindowGrabBar } from "./WindowGrabBar";

type StartScreenProps = {
  durationMinutes: number;
  onDurationChange: (value: number) => void;
  onClockIn: () => void;
  error: string | null;
};

export const StartScreen = ({
  durationMinutes,
  onDurationChange,
  onClockIn,
  error
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
          {[25, 45, 60, 90, 120].map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} minutes
            </option>
          ))}
        </select>
      </label>

      <button className="button button--primary button--clock-in" onClick={onClockIn}>
        Clock In
      </button>

      {error ? <p className="inline-error inline-error--center">{error}</p> : null}
    </section>
  </main>
);
