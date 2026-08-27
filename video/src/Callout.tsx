import { interpolate, useCurrentFrame } from "remotion";
import { CLAMP, EXPO } from "@/lib/remocn/scene-motion";
import { INK } from "@/palette";

/**
 * A small label that draws in when the voice names the thing it points at.
 * The chip sits at (x, y); when dx/dy are given, a hairline runs from the
 * chip's nearest edge to the target point at (x + dx, y + dy). Without them
 * the chip stands alone, for receipts that quote rather than point.
 *
 * Positions are composition pixels, computed against a Shot's known view, so
 * a callout must only appear while its scene's camera is holding still.
 */
export const Callout: React.FC<{
  text: string;
  x: number;
  y: number;
  dx?: number;
  dy?: number;
  at: number;
  /** Frame the callout starts leaving, for scenes that reuse the space. */
  until?: number;
}> = ({ text, x, y, dx, dy, at, until }) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [at, at + 10], [0, 1], {
    ...CLAMP,
    easing: EXPO,
  });
  const exit =
    until === undefined
      ? 1
      : interpolate(frame, [until, until + 8], [1, 0], CLAMP);
  const opacity = enter * exit;
  if (opacity === 0) return null;

  const pointer = dx !== undefined && dy !== undefined;
  const lineLength = pointer ? Math.hypot(dx, dy) : 0;
  const angle = pointer ? Math.atan2(dy, dx) : 0;

  return (
    <div style={{ position: "absolute", left: x, top: y, opacity }}>
      {pointer ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: lineLength * enter,
            height: 1.5,
            background: "rgba(244,242,239,0.55)",
            transform: `rotate(${angle}rad)`,
            transformOrigin: "0 50%",
          }}
        />
      ) : null}
      {pointer ? (
        <div
          style={{
            position: "absolute",
            left: dx - 3,
            top: dy - 3,
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: INK,
            opacity: enter,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          transform: "translate(-50%, -50%)",
          whiteSpace: "nowrap",
          padding: "9px 16px",
          borderRadius: 10,
          background: "rgba(18,18,18,0.92)",
          border: "1px solid rgba(255,255,255,0.16)",
          color: INK,
          fontSize: 21,
          fontWeight: 550,
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}
      >
        {text}
      </div>
    </div>
  );
};
