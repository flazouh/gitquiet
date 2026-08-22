import { AbsoluteFill, Img, Series, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { GRADIENT, INK, ON_GRADIENT_MUTED, PAGE } from "./palette";
import { Pane, READABLE } from "./Race";

/**
 * The whole main post, in one piece.
 *
 * The race and the Working Set shipped as two clips of 3.6s and 15s. The 3.6s
 * one was the main post, and it is a third the length of the shortest launch
 * video measured: the six worth copying ran 17 to 48 seconds, and the one that
 * reached eight million views ran 23. A clip that short loops before it is read
 * and arrives as a GIF.
 *
 * So they are one video. The race buys the attention, the Working Set spends
 * it, and the whole thing lands inside the band the references actually occupy.
 */

const RACE_MS = 4200;
const SET_MS = 13800;
const FPS = 30;

export const LAUNCH_DURATION_IN_FRAMES = Math.round(((RACE_MS + SET_MS) / 1000) * FPS);

const Heading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
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
    {children}
  </h1>
);

const Bed: React.FC<{ children: React.ReactNode; lift?: number }> = ({ children, lift = 0 }) => (
  <div
    style={{
      background: GRADIENT,
      borderRadius: 26,
      padding: "22px 22px 24px",
      boxShadow: `0 ${34 + lift * 12}px ${100 + lift * 30}px -34px rgba(183,155,255,${0.45 + lift * 0.2})`,
    }}
  >
    {children}
  </div>
);

const Caption: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p
    style={{
      margin: "16px 0 0",
      fontSize: 21,
      fontWeight: 500,
      color: ON_GRADIENT_MUTED,
      textAlign: "center",
    }}
  >
    {children}
  </p>
);

const Frame: React.FC<{ heading: React.ReactNode; children: React.ReactNode }> = ({
  heading,
  children,
}) => (
  <AbsoluteFill
    style={{ background: PAGE, padding: "28px 28px 30px", justifyContent: "center", gap: 22 }}
  >
    <Heading>{heading}</Heading>
    {children}
  </AbsoluteFill>
);

const RaceAct: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const lift = interpolate(ms, [READABLE.theirs, READABLE.theirs + 320], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Frame heading="GitHub keeps showing you the page you just left.">
      <Bed lift={lift}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Pane title="GitHub" file="theirs.mp4" readableAt={READABLE.theirs} ms={ms} width="100%" videoWidth={916} />
          <Pane title="GitQuiet" file="ours.mp4" readableAt={READABLE.ours} ms={ms} width="100%" videoWidth={916} />
        </div>
        <Caption>The same pull request, the same press, after resting on the row a moment.</Caption>
      </Bed>
    </Frame>
  );
};

/** Zoom is the only edit, which is the grammar the launch videos worth copying used. */
const PUNCH = { x: 6, y: 30, scale: 1.7 } as const;

const SetAct: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;

  const closeness = interpolate(seconds, [2.4, 4.6, 9.6, 11.8], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(closeness, [0, 1], [1, PUNCH.scale]);
  /*
   * The origin does not move with the scale.
   *
   * Animating both cut the Court names off the left edge for about a second in
   * the middle of the zoom: "Needs You" arrived as "s You". At scale 1 the
   * origin has no visible effect, so holding it costs nothing and the left edge
   * stays put the whole way in.
   */
  const originX = PUNCH.x;
  const originY = PUNCH.y;
  const arrive = interpolate(seconds, [0, 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: arrive }}>
      <Frame heading="Less to hold in your head.">
        <Bed>
          <div
            style={{
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 24px 60px -24px rgba(20,10,40,0.55)",
              background: "#0d1117",
              aspectRatio: "976 / 820",
            }}
          >
            <Img
              src={staticFile("workingset.png")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "left top",
                transform: `scale(${scale})`,
                transformOrigin: `${originX}% ${originY}%`,
                display: "block",
              }}
            />
          </div>
          <Caption>Needs You. Waiting. Running. Settled.</Caption>
        </Bed>
      </Frame>
    </AbsoluteFill>
  );
};

export const Launch: React.FC = () => (
  <Series>
    <Series.Sequence durationInFrames={Math.round((RACE_MS / 1000) * FPS)}>
      <RaceAct />
    </Series.Sequence>
    <Series.Sequence durationInFrames={Math.round((SET_MS / 1000) * FPS)}>
      <SetAct />
    </Series.Sequence>
  </Series>
);
