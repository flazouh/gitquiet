import { interpolate, useCurrentFrame } from "remotion";
import { CLAMP, EXPO } from "@/lib/remocn/scene-motion";
import { INK, MARK, MUTED } from "@/palette";

/**
 * The list, rebuilt at macro scale: one real row from the recordings, big
 * enough to read from across the room. The reference cuts to film between its
 * UI beats; this is our film — the product's own material, blown up, instead
 * of stock footage it does not have.
 *
 * The pull request is the one the whole video follows: oven-sh/bun #18742,
 * the same numbers the screenshots and the race recordings carry.
 */

/** Primer dark tokens, which the product itself uses. */
const GREEN = "#3fb950";
const RED = "#f85149";
const ORANGE = "#d29922";
const PURPLE = "#a371f7";

const PullRequestIcon: React.FC<{ size: number; color: string }> = ({
  size,
  color,
}) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color}>
    <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
  </svg>
);

const CheckIcon: React.FC<{ size: number; color: string }> = ({
  size,
  color,
}) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color}>
    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
  </svg>
);

export const GroupHeader: React.FC<{
  label: string;
  count?: string;
  color: string;
  check?: boolean;
  opacity?: number;
}> = ({ label, count, color, check = false, opacity = 1 }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "0 6px",
      opacity,
    }}
  >
    {check ? <CheckIcon size={22} color={color} /> : null}
    <span style={{ fontSize: 26, fontWeight: 650, color }}>{label}</span>
    {count ? (
      <span style={{ fontSize: 24, color: MUTED, fontWeight: 500 }}>
        {count}
      </span>
    ) : null}
  </div>
);

export { GREEN, ORANGE, PURPLE, RED };

/**
 * `hover` lifts the row the way the product does when the pointer rests on it;
 * `prefetch` is 0..1 and fills the hairline under the row — the read-ahead,
 * shown as itself. `approved` swaps the review state for the settled beat.
 */
export const PullRequestRow: React.FC<{
  hover?: number;
  prefetch?: number;
  approved?: boolean;
  width?: number;
}> = ({ hover = 0, prefetch = 0, approved = false, width = 980 }) => {
  const titleSize = approved ? 24 : 25;
  return (
    <div
      style={{
        position: "relative",
        width,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "22px 26px",
        borderRadius: 14,
        background: `rgba(255,255,255,${0.015 + hover * 0.045})`,
        border: `1px solid rgba(255,255,255,${0.05 + hover * 0.06})`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "#2d4a6b",
          color: "#cbe0f5",
          fontSize: 17,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        J
      </div>
      <PullRequestIcon size={26} color={GREEN} />
      <span style={{ fontSize: 24, color: MUTED, flexShrink: 0 }}>#18742</span>
      <span
        style={{
          fontSize: titleSize,
          fontWeight: 600,
          color: INK,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          flex: 1,
        }}
      >
        Decode streamed chunks with one decoder
      </span>
      <span
        style={{
          fontSize: 21,
          color: MUTED,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          flexShrink: 0,
        }}
      >
        bun
      </span>
      {approved ? (
        <span style={{ fontSize: 22, color: GREEN, flexShrink: 0 }}>
          Approved
        </span>
      ) : null}
      <span style={{ fontSize: 22, flexShrink: 0 }}>
        <span style={{ color: GREEN }}>+62</span>{" "}
        <span style={{ color: RED }}>−12</span>
      </span>
      <span style={{ fontSize: 21, color: MUTED, flexShrink: 0 }}>2h ago</span>
      {prefetch > 0 ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            height: 3,
            width: `${prefetch * 100}%`,
            background: MARK,
            borderRadius: 2,
          }}
        />
      ) : null}
    </div>
  );
};

/**
 * The settled beat: the same row, travelling from under one header to under
 * the other. In the product a settled pull request is not a badge on the row —
 * it is the row arriving in the last group, so that is what is shown.
 */
export const SettleMove: React.FC<{ moveAt: number }> = ({ moveAt }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [moveAt, moveAt + 34], [0, 1], {
    ...CLAMP,
    easing: EXPO,
  });
  const approved = t > 0.5;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
      }}
    >
      <div style={{ width: 1120, display: "flex", flexDirection: "column" }}>
        <div style={{ position: "relative", zIndex: 1, background: "#121212" }}>
          <GroupHeader
            label="Needs You"
            count={t > 0.5 ? undefined : "1"}
            color={ORANGE}
            opacity={1 - t * 0.45}
          />
        </div>
        <div style={{ height: 18 }} />
        <div style={{ height: 108, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              top: 0,
              width: "100%",
              transform: `translateY(${t * 186}px)`,
            }}
          >
            <PullRequestRow approved={approved} width={1120} />
          </div>
        </div>
        <div style={{ height: 26 }} />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            background: "#121212",
            paddingBottom: 14,
          }}
        >
          <GroupHeader
            label="Settled"
            count={t > 0.5 ? "1" : undefined}
            color={PURPLE}
            check
            opacity={0.55 + t * 0.45}
          />
        </div>
        <div style={{ height: 108 }} />
      </div>
    </div>
  );
};
