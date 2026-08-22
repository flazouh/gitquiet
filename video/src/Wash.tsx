import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";
import type React from "react";
import { AbsoluteFill } from "remotion";

/**
 * The reference melts scenes into a colour wash rather than cutting; its wash
 * is orange, ours is the BED. A panel of the gradient sweeps left to right,
 * and the new scene is revealed exactly where the panel has passed: ahead of
 * it the old scene, behind it the new one, and nothing is ever blurred or
 * half-faded on screen. The stops mirror palette GRADIENT, with transparent
 * ends so the panel has soft edges.
 */
const PANEL =
  "linear-gradient(100deg, rgba(255,154,209,0) 0%, rgb(255,154,209) 14%, rgb(255,198,157) 34%, rgb(236,224,255) 52%, rgb(169,194,255) 70%, rgb(183,155,255) 84%, rgba(183,155,255,0) 100%)";

/** Panel geometry, in frame widths. */
const PANEL_WIDTH = 1.7;
const PANEL_LEFT = -0.35;
/** How much of the panel's tail is transparent; the reveal edge trails it. */
const TAIL = 0.14;

const WashPresentation: React.FC<
  TransitionPresentationComponentProps<Record<string, never>>
> = ({ children, presentationProgress, presentationDirection }) => {
  const p = presentationProgress;
  /** Each layer is isolated so a scene's own z-indexes cannot cross layers. */
  if (presentationDirection === "exiting") {
    return (
      <AbsoluteFill style={{ isolation: "isolate" }}>{children}</AbsoluteFill>
    );
  }

  /** The panel travels its own width past both edges, in translateX terms. */
  const travel = -1.05 + 2.1 * p;
  /** Where the panel's opaque tail ends, as a fraction of the frame width. */
  const revealEdge = PANEL_LEFT + (travel + TAIL) * PANEL_WIDTH;
  const reveal = Math.max(0, Math.min(1, revealEdge)) * 100;

  return (
    <AbsoluteFill style={{ isolation: "isolate" }}>
      <AbsoluteFill style={{ clipPath: `inset(0 ${100 - reveal}% 0 0)` }}>
        {children}
      </AbsoluteFill>
      {p < 1 ? (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          <div
            style={{
              position: "absolute",
              top: "-10%",
              height: "120%",
              width: `${PANEL_WIDTH * 100}%`,
              left: `${PANEL_LEFT * 100}%`,
              background: PANEL,
              transform: `translateX(${travel * 100}%)`,
            }}
          />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

export function bedWash(): TransitionPresentation<Record<string, never>> {
  return { component: WashPresentation, props: {} };
}
