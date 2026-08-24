import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { GRADIENT, INK, ON_GRADIENT_MUTED, PAGE } from "./palette";
import { Pane, READABLE } from "./Race";

/**
 * The same race, stacked, for a feed that scrolls vertically.
 *
 * X autoplays muted in a column, so a 16:9 cut arrives about a third the height
 * of the posts around it and is scrolled past before the second counter moves.
 * Every launch video worth copying rendered closer to square than to widescreen.
 *
 * Side by side does not survive the narrower frame: two panes at 1080 wide leave
 * about 500 pixels each, and GitHub's list stops being readable as a list. Under
 * each other they keep their width, and the thing the shot is about — one pane
 * full while the other is still the page you left — reads better stacked anyway,
 * because the eye travels down rather than across.
 */

const RUNS_FOR_MS = 2600;
const HOLD_MS = 900;

export const RACE_TALL_DURATION_IN_FRAMES = Math.round(((RUNS_FOR_MS + HOLD_MS) / 1000) * 30);

export const RaceTall: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;

  const settle = interpolate(ms, [READABLE.theirs, READABLE.theirs + 320], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: PAGE,
        padding: "28px 28px 30px",
        justifyContent: "center",
        gap: 22,
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: 46,
          fontWeight: 620,
          letterSpacing: "-0.03em",
          lineHeight: 1.05,
          color: INK,
          textAlign: "center",
        }}
      >
        GitHub keeps showing you the page you just left.
      </h1>
      <div
        style={{
          background: GRADIENT,
          borderRadius: 26,
          padding: "22px 22px 24px",
          boxShadow: `0 ${34 + settle * 12}px ${100 + settle * 30}px -34px rgba(183,155,255,${0.45 + settle * 0.2})`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Pane title="GitHub" file="theirs.mp4" readableAt={READABLE.theirs} ms={ms} width="100%" videoWidth={916} />
          <Pane title="GitQuiet" file="ours.mp4" readableAt={READABLE.ours} ms={ms} width="100%" videoWidth={916} />
        </div>
        <p
          style={{
            margin: "16px 0 0",
            fontSize: 21,
            fontWeight: 500,
            color: ON_GRADIENT_MUTED,
            textAlign: "center",
          }}
        >
          The same pull request, the same press, after resting on the row a moment.
        </p>
      </div>
    </AbsoluteFill>
  );
};
