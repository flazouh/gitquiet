import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { GRADIENT, INK, ON_GRADIENT_MUTED, PAGE } from "./palette";

/**
 * The second video in the thread: the idea, once the first one has bought
 * the attention with the speed.
 *
 * Zoom is the only edit, which is the grammar the launch videos worth copying
 * used. terminal-browser's 550k-view cut punches in for the detail and pulls
 * back for the context and does nothing else, and it works because the product
 * is visible. This one is the same: the four Courts are already on the screen,
 * so the shot's job is to walk the eye to them rather than to animate them in.
 *
 * The still is `site/public/shots/working-set@2x.png`, the same photograph the
 * store listing uses, on mocked pull requests in public repositories. A real
 * Working Set is the reader's own inbox and cannot be published.
 */

const SECONDS = 15;
export const COURTS_DURATION_IN_FRAMES = SECONDS * 30;

/**
 * Where the punch lands, as a transform origin on the still.
 *
 * The Courts stack down the left of the list, so the origin sits high and left
 * rather than centred, and the pull back returns to the middle.
 */
const PUNCH = { x: 6, y: 30, scale: 1.7 } as const;

export const Courts: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;

  // Hold wide, punch in, hold, pull back. The holds are what make it readable;
  // a zoom that never rests is a zoom nobody reads.
  const closeness = interpolate(seconds, [3.2, 5.4, 10.4, 12.6], [0, 1, 1, 0], {
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

  return (
    <AbsoluteFill
      style={{ background: PAGE, padding: "28px 28px 30px", justifyContent: "center", gap: 24 }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: 50,
          fontWeight: 620,
          letterSpacing: "-0.03em",
          lineHeight: 1.06,
          color: INK,
          textAlign: "center",
        }}
      >
        Needs You. Waiting. Running. Settled.
      </h1>
      <div
        style={{
          background: GRADIENT,
          borderRadius: 26,
          padding: "24px 24px 26px",
          boxShadow: "0 34px 100px -34px rgba(183,155,255,0.5)",
        }}
      >
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
              // Cover already crops the right of a 1.6 still into a 1.19 window.
              transform: `scale(${scale})`,
              transformOrigin: `${originX}% ${originY}%`,
              display: "block",
            }}
          />
        </div>
        <p
          style={{
            margin: "18px 0 0",
            fontSize: 22,
            fontWeight: 500,
            color: ON_GRADIENT_MUTED,
            textAlign: "center",
          }}
        >
          Every pull request you are in, from every repository, on one screen.
        </p>
      </div>
    </AbsoluteFill>
  );
};
