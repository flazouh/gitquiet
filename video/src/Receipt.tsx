import { interpolate, useCurrentFrame } from "remotion";
import { CLAMP, EXPO } from "@/lib/remocn/scene-motion";
import { INK, MARK, MUTED } from "@/palette";

/**
 * A request somebody made to GitHub, with the number of people who made it.
 *
 * Distinct from `Callout`, which points at a region of the screenshot. This
 * points at nothing: it is a quote from their own community board, sitting in
 * the band under the card, and the count is the whole argument. Every number
 * used here is read off the live discussion the day of the cut and recorded in
 * gitquiet-notes, `research/receipts-chapter.md`.
 */
export const Receipt: React.FC<{
  count: string;
  ask: string;
  /** What GitHub's own answer is, where they have one worth naming. */
  theirs?: string;
  at: number;
}> = ({ count, ask, theirs, at }) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [at, at + 12], [0, 1], {
    ...CLAMP,
    easing: EXPO,
  });
  const rise = interpolate(frame, [at, at + 14], [14, 0], {
    ...CLAMP,
    easing: EXPO,
  });
  if (enter === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 606,
        display: "flex",
        justifyContent: "center",
        opacity: enter,
        transform: `translateY(${rise}px)`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          padding: "14px 26px",
          borderRadius: 14,
          background: "rgba(255,255,255,0.045)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        <span
          style={{
            fontSize: 40,
            fontWeight: 700,
            color: MARK,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {count}
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 24, fontWeight: 550, color: INK }}>
            {ask}
          </span>
          <span style={{ fontSize: 19, color: MUTED }}>
            {theirs ?? "asked for on GitHub's own board, still open"}
          </span>
        </span>
      </div>
    </div>
  );
};
