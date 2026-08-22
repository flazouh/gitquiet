import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { CLAMP, EXPO } from "@/lib/remocn/scene-motion";

/**
 * A camera over a screenshot. The card stays put; the picture moves behind it,
 * between rectangles named in source pixels, so a beat can open on the whole
 * screen and land on the one region the sentence is about. Flat on purpose:
 * the screenshots are dense and any tilt costs legibility.
 */
export interface ShotView {
  /** Frame this view is reached on. */
  at: number;
  /** Left edge of the view, in source pixels. */
  x: number;
  /** Top edge of the view, in source pixels. */
  y: number;
  /** Width of the view, in source pixels. Height follows the card's aspect. */
  w: number;
}

export const Shot: React.FC<{
  src: string;
  /** Natural size of the image file, in pixels. */
  sourceWidth: number;
  width: number;
  height: number;
  top: number;
  views: ShotView[];
  /** 0..1 fade+settle on entry, frames. 0 disables. */
  enter?: number;
}> = ({ src, sourceWidth, width, height, top, views, enter = 0 }) => {
  const frame = useCurrentFrame();

  const between = (get: (v: ShotView) => number) => {
    if (frame <= views[0].at) return get(views[0]);
    const last = views[views.length - 1];
    if (frame >= last.at) return get(last);
    const next = views.findIndex((v) => frame <= v.at);
    const a = views[next - 1];
    const b = views[next];
    return interpolate(frame, [a.at, b.at], [get(a), get(b)], {
      ...CLAMP,
      easing: EXPO,
    });
  };

  const x = between((v) => v.x);
  const y = between((v) => v.y);
  const w = between((v) => v.w);
  const scale = width / w;

  const entry =
    enter > 0
      ? interpolate(frame, [0, enter], [0, 1], { ...CLAMP, easing: EXPO })
      : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top,
        width,
        height,
        transform: `translateX(-50%) scale(${0.975 + entry * 0.025})`,
        opacity: entry,
        overflow: "hidden",
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.09)",
        boxShadow: "0 30px 80px -30px rgba(0,0,0,0.8)",
        background: "#0d0d0d",
      }}
    >
      <Img
        src={staticFile(src)}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: sourceWidth * scale,
          transform: `translate(${-x * scale}px, ${-y * scale}px)`,
        }}
      />
    </div>
  );
};
