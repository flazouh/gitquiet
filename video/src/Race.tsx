import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { GRADIENT, INK, ON_GRADIENT, ON_GRADIENT_MUTED, PAGE } from "./palette";

/**
 * The two recordings, side by side, on the bed the landing page uses.
 *
 * Both files are real screencasts of the same pull request opened the same way,
 * with the pointer rested on the row first. Every frame in them is stamped
 * against the press the page itself recorded, so the two are on one clock rather
 * than lined up by eye. Recorded with `scripts/record-race.js`.
 *
 * Nothing here is animated except the counters. The panes are the recordings at
 * their own speed, which is the only thing the shot is claiming.
 */

/** When each side had the pull request on the screen, read off the frames. */
const READABLE = {
  theirs: 2050,
  ours: 287,
} as const;

/** The story is over once theirs lands, and the hold is for the reader, not the claim. */
const RUNS_FOR_MS = 2600;
const HOLD_MS = 900;

export const RACE_DURATION_IN_FRAMES = Math.round(((RUNS_FOR_MS + HOLD_MS) / 1000) * 30);

const Clock: React.FC<{ readableAt: number; ms: number }> = ({ readableAt, ms }) => {
  const landed = ms >= readableAt;
  const shown = landed ? readableAt : ms;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        fontVariantNumeric: "tabular-nums",
        color: landed ? ON_GRADIENT : ON_GRADIENT_MUTED,
      }}
    >
      <span style={{ fontSize: 46, fontWeight: 620, letterSpacing: "-0.02em" }}>
        {Math.round(shown)}
      </span>
      <span style={{ fontSize: 22, fontWeight: 500 }}>ms</span>
      {landed ? (
        <span style={{ fontSize: 20, fontWeight: 500, marginLeft: 6 }}>readable</span>
      ) : null}
    </div>
  );
};

const Pane: React.FC<{ title: string; file: string; readableAt: number; ms: number }> = ({
  title,
  file,
  readableAt,
  ms,
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "50%" }}>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
      <span style={{ fontSize: 30, fontWeight: 620, color: ON_GRADIENT, letterSpacing: "-0.02em" }}>
        {title}
      </span>
      <Clock readableAt={readableAt} ms={ms} />
    </div>
    <div
      style={{
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 24px 60px -24px rgba(20,10,40,0.55)",
        background: "#0d1117",
      }}
    >
      <OffthreadVideo src={staticFile(file)} style={{ width: "100%", display: "block" }} muted />
    </div>
  </div>
);

export const Race: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;

  // The bed lifts a little as the second one lands, which is the only motion in
  // the shot that is not the recordings themselves.
  const settle = interpolate(ms, [READABLE.theirs, READABLE.theirs + 320], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: PAGE,
        padding: "44px 56px 48px",
        justifyContent: "center",
        gap: 44,
      }}
    >
      {/*
        The headline sits in what would otherwise be a black band above the bed.
        The panes are wide and short, so a 16:9 frame has room over them whether
        it is used or not, and an empty third reads as a crop that went wrong.

        It states the thing the footage proves rather than describing the setup.
        The two launches worth copying both did that: the one that reached eight
        million opened on "Get paid to wait", not on what was about to be shown.
        "One press, on the same pull request" was housekeeping in the three
        seconds that decide whether the rest is watched.
      */}
      <h1
        style={{
          margin: 0,
          fontSize: 62,
          fontWeight: 620,
          letterSpacing: "-0.03em",
          lineHeight: 1.05,
          color: INK,
          textAlign: "center",
          maxWidth: 1500,
          alignSelf: "center",
        }}
      >
        GitHub keeps showing you the page you just left.
      </h1>
      <div
        style={{
          background: GRADIENT,
          borderRadius: 28,
          padding: "40px 44px 44px",
          boxShadow: `0 ${40 + settle * 12}px ${120 + settle * 30}px -40px rgba(183,155,255,${0.45 + settle * 0.2})`,
        }}
      >
        <div style={{ display: "flex", gap: 36, alignItems: "flex-start" }}>
          <Pane title="GitHub" file="theirs.mp4" readableAt={READABLE.theirs} ms={ms} />
          <Pane title="GitQuiet" file="ours.mp4" readableAt={READABLE.ours} ms={ms} />
        </div>
        <p
          style={{
            margin: "26px 0 0",
            fontSize: 22,
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
