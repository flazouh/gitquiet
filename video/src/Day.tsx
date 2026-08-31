import { cloneElement, useEffect, useState } from "react";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import {
  AbsoluteFill,
  Audio,
  continueRender,
  delayRender,
  Freeze,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { SimulatedCursor } from "@/components/remocn/simulated-cursor";
import { SoftBlurIn } from "@/components/remocn/soft-blur-in";
import { CLAMP, fadeIn } from "@/lib/remocn/scene-motion";
import {
  GRADIENT,
  INK,
  MUTED,
  ON_GRADIENT,
  ON_GRADIENT_MUTED,
  PAGE,
} from "@/palette";
import { Callout } from "@/Callout";
import { Shot } from "@/Shot";
import { bedWash } from "@/Wash";

/**
 * The release video, cut four: a walkthrough.
 *
 * Direction is Alex's (gitquiet-notes, research/video-story.md): GitQuiet
 * exists because GitHub's interface is frustrating and slow, so open on that
 * problem in GitHub's own footage and numbers, then walk the product page by
 * page and show the value. No time budget.
 *
 * The voice leads and the picture is cut to its sentence timestamps, which is
 * why every beat length below is odd. The read is written from recorded demo
 * speech rather than from copy (research/voice-over-spoken.md), so it points
 * at things, volunteers the cold number rather than defending the warm one,
 * and stops rather than closing.
 *
 * Every callout is a journaled pain shown solved; the map with receipts is in
 * research/video-story.md.
 */

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif";

const WASH = 20;
const FADE = 10;

/** Frames the transition overlaps its neighbours; a cut overlaps nothing. */
const OVERLAP = { wash: WASH, fade: FADE, cut: 0 } as const;

type Out = keyof typeof OVERLAP;

/** Mounted only when the file exists, so the silent cut renders without audio. */
const OptionalAudio: React.FC<{ src: string; volume?: number }> = ({
  src,
  volume = 1,
}) => {
  const [exists, setExists] = useState(false);
  const [handle] = useState(() => delayRender(`probe ${src}`));
  useEffect(() => {
    fetch(staticFile(src), { method: "HEAD" })
      .then((response) => setExists(response.ok))
      .catch(() => setExists(false))
      .finally(() => continueRender(handle));
  }, [handle, src]);
  if (!exists) return null;
  return <Audio src={staticFile(src)} volume={volume} />;
};

const Dark: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: PAGE, fontFamily: FONT }}>
    {children}
  </AbsoluteFill>
);

const Bed: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: GRADIENT, fontFamily: FONT }}>
    {children}
  </AbsoluteFill>
);

const ProblemScene: React.FC = () => {
  const video = (
    <OffthreadVideo
      src={staticFile("theirs.mp4")}
      muted
      style={{ width: 1064, height: 558 }}
    />
  );
  return (
    <Dark>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 50,
          transform: "translateX(-50%)",
          width: 1064,
          height: 558,
          overflow: "hidden",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "0 30px 80px -30px rgba(0,0,0,0.8)",
          background: "#0d0d0d",
        }}
      >
        <Sequence durationInFrames={180}>{video}</Sequence>
        <Sequence from={180}>
          <Freeze frame={179}>{video}</Freeze>
        </Sequence>
      </div>
      <Callout
        text="Nothing here says it needs you"
        x={700}
        y={104}
        dx={-274}
        dy={52}
        at={110}
      />
      <Callout
        text="10+ seconds to reach the diff. Their changelog."
        x={385}
        y={660}
        at={300}
      />
      <Callout
        text="A 1 GB JavaScript heap. Their engineering blog."
        x={890}
        y={660}
        at={400}
      />
    </Dark>
  );
};

const TurnScene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Bed>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 236,
          textAlign: "center",
          fontSize: 28,
          fontWeight: 550,
          color: ON_GRADIENT_MUTED,
          opacity: fadeIn(frame, 4, 10),
        }}
      >
        Introducing
      </div>
      <AbsoluteFill style={{ transform: "translateY(-6px)" }}>
        <SoftBlurIn
          text="GitQuiet"
          fontSize={104}
          fontWeight={700}
          color={ON_GRADIENT}
        />
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 442,
          textAlign: "center",
          fontSize: 30,
          fontWeight: 500,
          color: ON_GRADIENT_MUTED,
          opacity: fadeIn(frame, 34, 12),
        }}
      >
        A faster, quieter GitHub.
      </div>
    </Bed>
  );
};

/** The group meanings are the README's own words. */
const GROUP_LABELS: { text: string; y: number; at: number }[] = [
  { text: "You can act on it now", y: 91, at: 84 },
  { text: "Someone else has to act", y: 387, at: 102 },
  { text: "A machine is still working", y: 525, at: 120 },
  { text: "Finished", y: 635, at: 138 },
];

const ListScene: React.FC = () => (
  <Dark>
    <Shot
      src="workingset.png"
      sourceWidth={2560}
      width={1064}
      height={600}
      top={40}
      enter={12}
      views={[
        { at: 10, x: 0, y: 100, w: 2560 },
        { at: 280, x: 0, y: 116, w: 2520 },
      ]}
    />
    {GROUP_LABELS.map((label) => (
      <Callout
        key={label.text}
        text={label.text}
        x={520}
        y={label.y + 4}
        dx={-300}
        dy={-4}
        at={label.at}
      />
    ))}
    <SimulatedCursor
      points={[
        { x: 1180, y: 690, hold: 0 },
        { x: 470, y: 141, hold: 96 },
        { x: 472, y: 143, hold: 24, click: true },
      ]}
      size={28}
      speed={0.62}
    />
  </Dark>
);

/**
 * The pull request the press opened, as GitQuiet drew it: the still is the
 * last frame of the same recording the race clips come from.
 */
const PrOpenScene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Dark>
      <Shot
        src="pull-request.png"
        sourceWidth={2560}
        width={1064}
        height={580}
        top={40}
        enter={7}
        views={[
          { at: 0, x: 0, y: 0, w: 2560 },
          { at: 260, x: 0, y: 24, w: 2500 },
        ]}
      />
      {/* The address is the argument: nothing was migrated, nothing moved. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 648,
          display: "flex",
          justifyContent: "center",
          opacity: fadeIn(frame, 56, 10),
        }}
      >
        <span
          style={{
            fontSize: 26,
            fontWeight: 500,
            color: MUTED,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            padding: "10px 20px",
            borderRadius: 10,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          github.com<span style={{ color: INK }}>/oven-sh/bun/pull/18742</span>
        </span>
      </div>
    </Dark>
  );
};

const PageScene: React.FC = () => (
  <Dark>
    <Shot
      src="pull-request.png"
      sourceWidth={2560}
      width={1064}
      height={580}
      top={40}
      views={[
        { at: 0, x: 0, y: 24, w: 2500 },
        { at: 190, x: 0, y: 44, w: 2450 },
      ]}
    />
    <Callout text="Checks" x={430} y={112} dx={-215} dy={4} at={44} />
    <Callout text="Conversation" x={455} y={228} dx={-232} dy={-18} at={70} />
    <Callout text="Files, and their diffs" x={800} y={548} dx={-70} dy={-190} at={96} />
    <Callout text="3 of 7 seen" x={905} y={112} dx={112} dy={4} at={140} />
  </Dark>
);

const PrConvoScene: React.FC = () => (
  <Dark>
    <Shot
      src="pull-request.png"
      sourceWidth={2560}
      width={1064}
      height={580}
      top={40}
      views={[
        { at: 0, x: 0, y: 380, w: 1350 },
        { at: 246, x: 0, y: 398, w: 1330 },
      ]}
    />
    <Callout
      text="Unresolved threads above the diff, and find works"
      x={740}
      y={140}
      dx={-300}
      dy={60}
      at={22}
    />
  </Dark>
);

const VerdictScene: React.FC = () => (
  <Dark>
    <Shot
      src="pull-request.png"
      sourceWidth={2560}
      width={1064}
      height={580}
      top={40}
      views={[
        { at: 0, x: 0, y: 856, w: 1350 },
        { at: 120, x: 0, y: 868, w: 1326 },
      ]}
    />
    <Callout
      text="Your review, right there"
      x={620}
      y={560}
      dx={-320}
      dy={-40}
      at={12}
    />
  </Dark>
);

const WhitespaceScene: React.FC = () => (
  <Dark>
    <Shot
      src="pull-request.png"
      sourceWidth={2560}
      width={1064}
      height={580}
      top={40}
      views={[
        { at: 0, x: 1360, y: 380, w: 1180 },
        { at: 250, x: 1360, y: 400, w: 1160 },
      ]}
    />
    <Callout
      text="Whitespace-only changes, folded by default"
      x={640}
      y={648}
      at={40}
    />
  </Dark>
);

/**
 * The pull request wearing a colour pack, then another: Dracula, then Tokyo
 * Night, cross-faded at the midpoint. The code follows the pack, which is the
 * whole claim GitHub cannot make with light and dark.
 */
const ThemesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const swap = interpolate(frame, [128, 150], [0, 1], CLAMP);
  return (
    <Dark>
      <div style={{ opacity: 1 - swap }}>
        <Shot
          src="pr-dracula.png"
          sourceWidth={2560}
          width={1120}
          height={620}
          top={30}
          enter={8}
          views={[
            { at: 0, x: 0, y: 0, w: 2560 },
            { at: 250, x: 0, y: 30, w: 2500 },
          ]}
        />
      </div>
      {swap > 0 ? (
        <div style={{ opacity: swap }}>
          <Shot
            src="pr-tokyo.png"
            sourceWidth={2560}
            width={1120}
            height={620}
            top={30}
            views={[
              { at: 0, x: 0, y: 20, w: 2540 },
              { at: 250, x: 0, y: 50, w: 2480 },
            ]}
          />
        </div>
      ) : null}
      <Callout text="Thirty colour packs" x={640} y={660} at={24} />
    </Dark>
  );
};

const SplitScene: React.FC = () => (
  <Dark>
    <Shot
      src="pr-split.png"
      sourceWidth={2560}
      width={1120}
      height={620}
      top={30}
      enter={8}
      views={[
        { at: 0, x: 0, y: 0, w: 2560 },
        { at: 120, x: 1360, y: 420, w: 1200 },
        { at: 270, x: 1360, y: 440, w: 1180 },
      ]}
    />
    <Callout
      text="Side by side, remembered, no reload"
      x={640}
      y={648}
      at={150}
    />
  </Dark>
);

const TreeScene: React.FC = () => (
  <Dark>
    <Shot
      src="pull-request.png"
      sourceWidth={2560}
      width={1064}
      height={580}
      top={40}
      views={[
        { at: 0, x: 660, y: 340, w: 920 },
        { at: 240, x: 660, y: 360, w: 900 },
      ]}
    />
    <Callout
      text="The tree stays, at any width"
      x={640}
      y={648}
      at={30}
    />
  </Dark>
);

const ReviewScene: React.FC = () => (
  <Dark>
    <Shot
      src="pull-request.png"
      sourceWidth={2560}
      width={1064}
      height={580}
      top={40}
      views={[
        { at: 0, x: 830, y: 200, w: 1720 },
        { at: 420, x: 830, y: 220, w: 1700 },
      ]}
    />
    <Callout
      text="Review mode: j / k, x marks read"
      x={640}
      y={624}
      at={60}
    />
    <Callout
      text="It remembers what you have seen"
      x={640}
      y={672}
      at={240}
    />
  </Dark>
);

const CtaScene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Bed>
      <AbsoluteFill style={{ transform: "translateY(-64px)" }}>
        <SoftBlurIn
          text="GitQuiet"
          fontSize={96}
          fontWeight={700}
          color={ON_GRADIENT}
        />
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 418,
          display: "flex",
          justifyContent: "center",
          opacity: fadeIn(frame, 150, 12),
        }}
      >
        <div
          style={{
            padding: "16px 34px",
            borderRadius: 12,
            background: ON_GRADIENT,
            color: "#ffffff",
            fontSize: 27,
            fontWeight: 600,
          }}
        >
          Free and open source
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 506,
          textAlign: "center",
          fontSize: 25,
          fontWeight: 500,
          color: ON_GRADIENT_MUTED,
          opacity: fadeIn(frame, 262, 12),
        }}
      >
        Chrome · Firefox · Safari
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 548,
          textAlign: "center",
          fontSize: 25,
          fontWeight: 500,
          color: ON_GRADIENT,
          opacity: fadeIn(frame, 300, 12),
        }}
      >
        gitquiet.com
      </div>
    </Bed>
  );
};

/**
 * The whole film, in order, cut to the voice's sentence timestamps. `out` is
 * how a beat leaves: a wash between worlds, a fade within one, and hard cuts
 * on the press (the arrival is the claim) and at the end.
 */
const BEATS: { scene: React.FC; frames: number; out: Out }[] = [
  { scene: ProblemScene, frames: 546, out: "wash" },
  { scene: TurnScene, frames: 150, out: "wash" },
  { scene: ListScene, frames: 366, out: "cut" },
  { scene: PrOpenScene, frames: 309, out: "fade" },
  { scene: PageScene, frames: 253, out: "fade" },
  { scene: PrConvoScene, frames: 353, out: "fade" },
  { scene: WhitespaceScene, frames: 283, out: "fade" },
  { scene: ThemesScene, frames: 259, out: "fade" },
  { scene: SplitScene, frames: 277, out: "fade" },
  { scene: TreeScene, frames: 251, out: "fade" },
  { scene: ReviewScene, frames: 433, out: "fade" },
  { scene: VerdictScene, frames: 199, out: "wash" },
  { scene: CtaScene, frames: 421, out: "cut" },
];

export const DAY_DURATION_IN_FRAMES = BEATS.reduce(
  (total, beat, i) =>
    total + beat.frames - (i < BEATS.length - 1 ? OVERLAP[beat.out] : 0),
  0,
);

const transitions: Record<Exclude<Out, "cut">, () => React.ReactElement> = {
  wash: () => (
    <TransitionSeries.Transition
      presentation={bedWash()}
      timing={linearTiming({ durationInFrames: WASH })}
    />
  ),
  fade: () => (
    <TransitionSeries.Transition
      presentation={fade()}
      timing={linearTiming({ durationInFrames: FADE })}
    />
  ),
};

export const Day: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: PAGE }}>
      <TransitionSeries>
        {BEATS.flatMap(({ scene: Scene, frames, out }, i) => [
          <TransitionSeries.Sequence
            key={`beat-${i}`}
            durationInFrames={frames}
          >
            <Scene />
          </TransitionSeries.Sequence>,
          ...(out !== "cut" && i < BEATS.length - 1
            ? [cloneElement(transitions[out](), { key: `out-${i}` })]
            : []),
        ])}
      </TransitionSeries>
      <OptionalAudio src="music.mp3" volume={0.32} />
      <OptionalAudio src="vo.mp3" />
    </AbsoluteFill>
  );
};
