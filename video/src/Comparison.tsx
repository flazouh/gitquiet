import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,

  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Backdrop } from "@/Backdrop";
import { MEASURED } from "@/measurements";
import { INK, ON_GRADIENT, ON_GRADIENT_MUTED } from "@/palette";

/**
 * The same pull request opened twice, side by side, in real time.
 *
 * Real time is the argument. A cut between two finished screens asks to be
 * believed; two clocks running at once lets the viewer watch the right-hand side
 * finish while the left is still loading. So nothing is eased for effect — each
 * panel cuts at the millisecond it was measured at.
 *
 * The hover is shown before the click because the hover is where the difference is
 * made. GitHub spends it fetching a tooltip; this spends it fetching the pull
 * request. Without that beat the video looks like a claim about being fast, when it
 * is really a claim about doing the work earlier.
 */

/** Long enough to see the pointer arrive, rest, and for the hover labels to be read. */
const PRE_ROLL_MS = 1600;
const TAIL_MS = 1900;

/**
 * Where the pointer presses, as a fraction of the panel.
 *
 * Read off the live pages with `getBoundingClientRect` in the session that took the
 * screenshots: GitHub's list reorders as pull requests are opened, so a position
 * measured an hour later points at a different row.
 */
const ROW = { x: 0.2064, y: 0.5079 };
const FILES_TAB = { x: 0.4366, y: 0.2534 };
const OFF_SCREEN = { x: 0.62, y: 0.95 };

type Shot = { readonly at: number; readonly src: string };
type Waypoint = { readonly at: number; readonly x: number; readonly y: number };

const ms = (frame: number, fps: number) => (frame / fps) * 1000;

/**
 * A panel's stills, cut in at the times they were measured at.
 *
 * Two frames of crossfade rather than a hard cut: a hard cut between stills reads
 * as a glitch at 30fps, and two frames is under the time it takes to register one.
 */
const Stills: React.FC<{ shots: readonly Shot[]; startAt: number }> = ({ shots, startAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <>
      {shots.map((shot, index) => {
        const start = ((startAt + shot.at) / 1000) * fps;
        const opacity =
          index === 0
            ? 1
            : interpolate(frame, [start, start + 2], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
        return (
          <Img
            key={shot.src}
            src={staticFile(shot.src)}
            style={{ position: "absolute", inset: 0, width: "100%", opacity }}
          />
        );
      })}
    </>
  );
};

/**
 * The pointer, and every press it makes.
 *
 * Timed in video milliseconds rather than from the press, because it has to exist
 * before the press to be read as one. The travel to GitHub's "Files changed" tab
 * starts about 160ms early rather than the measured 75ms, because two frames of
 * movement reads as a teleport; the press still lands on its measured millisecond,
 * which is the only part carrying a claim.
 */
const Pointer: React.FC<{ path: readonly Waypoint[]; clicks: readonly number[] }> = ({
  path,
  clicks,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const now = ms(frame, fps);

  const times = path.map((point) => point.at);
  const options = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.33, 1, 0.68, 1),
  } as const;
  const x = interpolate(now, times, path.map((point) => point.x), options);
  const y = interpolate(now, times, path.map((point) => point.y), options);
  const pressed = clicks.some((at) => now >= at && now < at + 120);

  return (
    <>
      {clicks.map((at) => {
        const age = now - at;
        if (age < 0 || age > 520) return null;
        const size = interpolate(age, [0, 520], [10, 96], {
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        const fade = interpolate(age, [0, 520], [0.9, 0], { extrapolateRight: "clamp" });
        return (
          <div
            key={at}
            style={{
              position: "absolute",
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2,
              borderRadius: "50%",
              border: "3px solid #ffffff",
              opacity: fade,
            }}
          />
        );
      })}
      <svg
        viewBox="0 0 24 24"
        width={30}
        height={30}
        style={{
          position: "absolute",
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          transform: `scale(${pressed ? 0.82 : 1})`,
          transformOrigin: "4px 3px",
          filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.7))",
        }}
      >
        <path
          d="M5 2.5 L5 19 L9.2 15.2 L12 21.5 L14.6 20.3 L11.8 14.2 L17.5 14 Z"
          fill="#ffffff"
          stroke="#0d1117"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
};

/** What each side does with the hover, said plainly while the hover is happening. */
const HoverNote: React.FC<{ text: string; from: number; until: number }> = ({
  text,
  from,
  until,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const now = ms(frame, fps);
  const opacity = interpolate(now, [from, from + 220, until, until + 260], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: 22,
        transform: "translateX(-50%)",
        opacity,
        padding: "8px 18px",
        borderRadius: 999,
        background: "rgba(12,10,18,0.86)",
        color: "#f4f2ef",
        fontSize: 21,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};

/** Counts from the press and stops on the diff, so the panels end on different numbers. */
const Clock: React.FC<{ stopAt: number; startAt: number }> = ({ stopAt, startAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elapsed = Math.min(Math.max(ms(frame, fps) - startAt, 0), stopAt);

  return (
    <span
      style={{
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 40,
        fontVariantNumeric: "tabular-nums",
        fontWeight: 600,
        color: ON_GRADIENT,
      }}
    >
      {(elapsed / 1000).toFixed(2)}s
    </span>
  );
};

/** Each press the reader has to make, counted as it is made. */
const Presses: React.FC<{
  presses: readonly { at: number; label: string }[];
  startAt: number;
}> = ({ presses, startAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ display: "flex", gap: 10, height: 40 }}>
      {presses.map((press) => {
        const start = ((startAt + press.at) / 1000) * fps;
        const enter = spring({ frame: frame - start, fps, config: { damping: 14, mass: 0.4 } });
        return (
          <span
            key={press.label}
            style={{
              transform: `scale(${0.7 + enter * 0.3})`,
              opacity: enter,
              padding: "5px 15px",
              borderRadius: 999,
              background: "rgba(27,23,37,0.9)",
              color: "#f4f2ef",
              fontSize: 21,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            {press.label}
          </span>
        );
      })}
    </div>
  );
};

const Panel: React.FC<{
  title: string;
  note: string;
  hover: string;
  shots: readonly Shot[];
  presses: readonly { at: number; label: string }[];
  path: readonly Waypoint[];
  clicks: readonly number[];
  stopAt: number;
}> = ({ title, note, hover, shots, presses, path, clicks, stopAt }) => {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <span
          style={{ fontSize: 34, fontWeight: 650, color: ON_GRADIENT, letterSpacing: "-0.02em" }}
        >
          {title}
        </span>
        <span style={{ fontSize: 21, color: ON_GRADIENT_MUTED }}>{note}</span>
        <span style={{ marginLeft: "auto" }}>
          <Clock stopAt={stopAt} startAt={PRE_ROLL_MS} />
        </span>
      </div>

      <div
        style={{
          position: "relative",
          aspectRatio: "1512 / 949",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 24px 60px -24px rgba(20,10,40,0.55)",
        }}
      >
        <Stills shots={shots} startAt={PRE_ROLL_MS} />
        <Pointer path={path} clicks={clicks} />
        <HoverNote text={hover} from={620} until={PRE_ROLL_MS - 120} />
      </div>

      <Presses presses={presses} startAt={PRE_ROLL_MS} />
    </div>
  );
};

export const DURATION_IN_FRAMES = Math.round(
  ((PRE_ROLL_MS + MEASURED.github.diff + TAIL_MS) / 1000) * 30,
);

export const Comparison: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const landed = ((PRE_ROLL_MS + MEASURED.github.diff) / 1000) * fps;
  const closing = interpolate(frame, [landed + 10, landed + 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Backdrop>
        <div style={{ display: "flex", gap: 40 }}>
          <Panel
            title="GitHub"
            note="conversation, then Files changed"
            hover="hover → fetches a tooltip"
            stopAt={MEASURED.github.diff}
            shots={[
              { at: 0, src: "list.png" },
              { at: MEASURED.github.page, src: "github-pr.png" },
              { at: MEASURED.github.diff, src: "github-diff.png" },
            ]}
            presses={[
              { at: 0, label: "click" },
              { at: MEASURED.github.secondPress, label: "click" },
            ]}
            path={[
              { at: 0, ...OFF_SCREEN },
              { at: 600, ...ROW },
              { at: PRE_ROLL_MS + MEASURED.github.secondPress - 160, ...ROW },
              { at: PRE_ROLL_MS + MEASURED.github.secondPress, ...FILES_TAB },
            ]}
            clicks={[PRE_ROLL_MS, PRE_ROLL_MS + MEASURED.github.secondPress]}
          />
          <Panel
            title="gitquiet"
            note="one screen"
            hover="hover → fetches the pull request"
            stopAt={MEASURED.ours.diff}
            shots={[
              { at: 0, src: "list.png" },
              { at: MEASURED.ours.diff, src: "ours.png" },
            ]}
            presses={[{ at: 0, label: "click" }]}
            path={[
              { at: 0, ...OFF_SCREEN },
              { at: 600, ...ROW },
            ]}
            clicks={[PRE_ROLL_MS]}
          />
        </div>
      </Backdrop>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 22,
          textAlign: "center",
          fontSize: 25,
          color: INK,
          opacity: 0.9,
        }}
      >
        {closing > 0.5
          ? "Same pull request. They spend your hover on a tooltip."
          : "Median of four pull requests on microsoft/vscode, after resting on the row."}
      </div>
    </AbsoluteFill>
  );
};
