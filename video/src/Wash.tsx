import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";
import type React from "react";
import { AbsoluteFill } from "remotion";

/**
 * The reference melts scenes into a colour wash rather than cutting; its wash is
 * orange, ours is the BED. A panel of the gradient sweeps across the frame and
 * the scenes trade places underneath it at the midpoint, so neither scene is
 * ever blurred or half-faded on screen: each one is either fully there or
 * covered. That is deliberate — the last cut hid its best moments inside
 * transition blur.
 */
const PANEL =
  "linear-gradient(100deg, rgba(255,154,209,0) 0%, rgb(255,154,209) 14%, rgb(255,198,157) 34%, rgb(236,224,255) 52%, rgb(169,194,255) 70%, rgb(183,155,255) 84%, rgba(183,155,255,0) 100%)";

const WashPresentation: React.FC<
  TransitionPresentationComponentProps<Record<string, never>>
> = ({ children, presentationProgress, presentationDirection }) => {
  const entering = presentationDirection === "entering";
  const p = presentationProgress;
  const visible = entering ? p >= 0.5 : p < 0.5;

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: visible ? 1 : 0 }}>
        {children}
      </AbsoluteFill>
      {entering && p > 0 && p < 1 ? (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          <div
            style={{
              position: "absolute",
              top: "-10%",
              height: "120%",
              width: "170%",
              left: "-35%",
              background: PANEL,
              transform: `translateX(${-105 + p * 210}%)`,
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
