import type { CSSProperties } from "react";

type BubbleConfig = {
  /** Diameter in px */
  size: number;
  /** CSS position values — spread onto the element style */
  pos: CSSProperties;
  /** Colour tint (maps to `.bubble--<tint>`) */
  tint: "lavender" | "mint" | "rose" | "sky";
  /** Animation cycle duration in seconds */
  dur: number;
  /** Negative delay seeds the animation mid-cycle */
  delay: number;
  /** When true the bubble is large, blurred, and sits behind everything */
  bg?: boolean;
};

/* ──────────────────────────────────────────
   Ambient bubble arrangement — dashboard & start screen
   12 bubbles at varying depths, sizes, and tints
   ────────────────────────────────────────── */
export const AMBIENT_BUBBLES: BubbleConfig[] = [
  { size: 320, pos: { top: "2%", left: "-5%" }, tint: "lavender", dur: 22, delay: 0 },
  { size: 240, pos: { top: "10%", right: "3%" }, tint: "mint", dur: 26, delay: -5 },
  { size: 180, pos: { bottom: "28%", left: "4%" }, tint: "rose", dur: 19, delay: -8 },
  { size: 130, pos: { top: "42%", right: "10%" }, tint: "sky", dur: 24, delay: -12 },
  { size: 90, pos: { bottom: "8%", left: "22%" }, tint: "lavender", dur: 17, delay: -3 },
  { size: 200, pos: { bottom: "3%", right: "-3%" }, tint: "mint", dur: 25, delay: -14 },
  { size: 70, pos: { top: "22%", left: "38%" }, tint: "rose", dur: 15, delay: -6 },
  { size: 400, pos: { top: "45%", left: "25%" }, tint: "sky", dur: 30, delay: -9, bg: true },
  { size: 50, pos: { top: "55%", right: "28%" }, tint: "lavender", dur: 13, delay: -1 },
  { size: 160, pos: { top: "68%", left: "55%" }, tint: "mint", dur: 21, delay: -10 },
  { size: 280, pos: { top: "-5%", left: "40%" }, tint: "lavender", dur: 28, delay: -7, bg: true },
  { size: 110, pos: { bottom: "20%", right: "18%" }, tint: "rose", dur: 18, delay: -4 },
];

/* ──────────────────────────────────────────
   Overlay bubble arrangement — calmer, fewer, centred
   ────────────────────────────────────────── */
export const OVERLAY_BUBBLES: BubbleConfig[] = [
  { size: 260, pos: { top: "5%", left: "-8%" }, tint: "lavender", dur: 20, delay: 0 },
  { size: 200, pos: { top: "8%", right: "-4%" }, tint: "mint", dur: 24, delay: -4 },
  { size: 140, pos: { bottom: "15%", left: "8%" }, tint: "rose", dur: 16, delay: -7 },
  { size: 100, pos: { bottom: "10%", right: "10%" }, tint: "sky", dur: 22, delay: -11 },
  { size: 350, pos: { top: "30%", left: "20%" }, tint: "lavender", dur: 28, delay: -6, bg: true },
  { size: 60, pos: { top: "20%", left: "60%" }, tint: "mint", dur: 14, delay: -2 },
  { size: 80, pos: { bottom: "30%", right: "25%" }, tint: "rose", dur: 18, delay: -9 },
];

type BubbleFieldProps = {
  bubbles: BubbleConfig[];
};

export const BubbleField = ({ bubbles }: BubbleFieldProps) => (
  <div className="bubble-field">
    {bubbles.map((b, i) => (
      <div
        key={i}
        className={`bubble bubble--${b.tint}${b.bg ? " bubble--bg" : ""}`}
        style={
          {
            width: b.size,
            height: b.size,
            ...b.pos,
            "--b-dur": `${b.dur}s`,
            "--b-delay": `${b.delay}s`,
          } as CSSProperties
        }
      />
    ))}
  </div>
);
