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
  Series,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { SimulatedCursor } from "@/components/remocn/simulated-cursor";
import { SoftBlurIn } from "@/components/remocn/soft-blur-in";
import { CLAMP, EXPO, fadeIn } from "@/lib/remocn/scene-motion";
import {
  GRADIENT,
  INK,
  MARK,
  MUTED,
  ON_GRADIENT,
  ON_GRADIENT_MUTED,
  PAGE,
} from "@/palette";
import { Callout } from "@/Callout";
import { GroupHeader, ORANGE, PullRequestRow } from "@/Row";
import { Shot } from "@/Shot";
import { bedWash } from "@/Wash";

/**
 * The release video, cut four: a walkthrough.
 *
 * Direction is Alex's (gitquiet-notes, research/video-story.md): GitQuiet
 * exists because GitHub's interface is frustrating and slow, so open on that
 * problem in GitHub's own footage and numbers, then walk the product page by
 * page and show the value. No time budget; the voice leads and the picture is
 * cut to her sentence timestamps, which is why every beat length below is odd.
 *
 * Every callout is a journaled pain shown solved; the map with receipts is in
 * that same research note.
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

/** One sentence in the band under the card. */
const Caption: React.FC<{ text: string; at?: number }> = ({ text, at = 8 }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 648,
        textAlign: "center",
        fontSize: 27,
        fontWeight: 500,
        color: INK,
        opacity: fadeIn(frame, at, 10),
      }}
    >
      {text}
    </div>
  );
};

/**
 * GitHub, as recorded: the same pull request the rest of the video opens,
 * pressed on github.com and waited for. The receipts under it are GitHub's
 * own published measurements, quoted rather than pointed.
 */
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
        text="One pull request, four tabs"
        x={700}
        y={104}
        dx={-274}
        dy={52}
        at={138}
      />
      <Callout
        text="Tab switches: 10+ seconds. Their changelog."
        x={385}
        y={660}
        at={280}
      />
      <Callout
        text="A 1 GB JavaScript heap. Their engineering blog."
        x={890}
        y={660}
        at={310}
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
        So I built
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
          opacity: fadeIn(frame, 32, 12),
        }}
      >
        A faster, quieter GitHub.
      </div>
    </Bed>
  );
};

/** The group meanings are the README's own words. */
const GROUP_LABELS: { text: string; y: number; at: number }[] = [
  { text: "You can act on it now", y: 96, at: 213 },
  { text: "Someone else has to act", y: 392, at: 227 },
  { text: "A machine is still working", y: 501, at: 241 },
  { text: "Finished", y: 609, at: 255 },
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
      views={[{ at: 12, x: 0, y: 90, w: 2560 }]}
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
  </Dark>
);

/** The cursor's path: a leg is 24 frames, then the rest, then the press. */
const LEG = 24;
const REST_HOLD = 30;
const ARRIVE = LEG;
const CLICK = LEG + REST_HOLD + LEG;

const RestScene: React.FC = () => {
  const frame = useCurrentFrame();
  const hover = fadeIn(frame, ARRIVE + 2, 6);
  const prefetch = interpolate(frame, [ARRIVE + 6, ARRIVE + 20], [0, 1], {
    ...CLAMP,
    easing: EXPO,
  });
  const press = interpolate(
    frame,
    [CLICK, CLICK + 4, CLICK + 8],
    [1, 0.985, 1],
    CLAMP,
  );
  return (
    <Dark>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 288,
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <GroupHeader label="Needs You" count="1" color={ORANGE} />
        <div style={{ transform: `scale(${press})` }}>
          <PullRequestRow hover={hover} prefetch={prefetch} width={1120} />
        </div>
      </div>
      <SimulatedCursor
        points={[
          { x: 1150, y: 660, hold: 0 },
          { x: 700, y: 385, hold: REST_HOLD },
          { x: 703, y: 387, hold: 20, click: true },
        ]}
        size={30}
      />
    </Dark>
  );
};

/**
 * The pull request the press opened, as GitQuiet drew it: the still is the
 * last frame of the same recording the race clips come from.
 */
const PrOpenScene: React.FC = () => {
  const frame = useCurrentFrame();
  const count = Math.round(interpolate(frame, [0, 9], [0, 287], CLAMP));
  const payoff = interpolate(frame, [116, 126], [1, 0], CLAMP);
  return (
    <Dark>
      <Shot
        src="pr-open.png"
        sourceWidth={1440}
        width={1064}
        height={558}
        top={44}
        enter={9}
        views={[
          { at: 150, x: 0, y: 0, w: 1440 },
          { at: 190, x: 0, y: 40, w: 1200 },
        ]}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 630,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "center",
          gap: 18,
          opacity: payoff,
        }}
      >
        <span
          style={{
            fontSize: 46,
            fontWeight: 700,
            color: MARK,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {count}
          <span style={{ fontSize: 27, fontWeight: 600 }}> ms</span>
        </span>
        <span
          style={{
            fontSize: 24,
            color: INK,
            fontWeight: 500,
            opacity: fadeIn(frame, 10, 8),
          }}
        >
          to readable, after that rest.
        </span>
        <span
          style={{ fontSize: 24, color: MUTED, opacity: fadeIn(frame, 26, 10) }}
        >
          GitHub: 2132 ms.
        </span>
      </div>
      <Callout
        text="The description is a card"
        x={400}
        y={430}
        dx={-190}
        dy={0}
        at={174}
      />
      <Callout
        text="Everything owed, one rail"
        x={400}
        y={96}
        dx={-200}
        dy={-10}
        at={188}
      />
      <Callout
        text="Files beside their diffs"
        x={715}
        y={520}
        dx={-190}
        dy={-245}
        at={311}
      />
    </Dark>
  );
};

const PrConvoScene: React.FC = () => (
  <Dark>
    <Shot
      src="pull-request.png"
      sourceWidth={2560}
      width={1064}
      height={580}
      top={40}
      views={[
        { at: 8, x: 0, y: 60, w: 1350 },
        { at: 232, x: 0, y: 60, w: 1350 },
        { at: 258, x: 0, y: 660, w: 1350 },
        { at: 345, x: 0, y: 660, w: 1350 },
        { at: 368, x: 0, y: 80, w: 1500 },
      ]}
    />
    <Callout
      text="Unresolved threads, above the diff"
      x={740}
      y={140}
      dx={-300}
      dy={60}
      at={20}
      until={238}
    />
    <Callout
      text="Verdict and merge, in one place"
      x={620}
      y={560}
      dx={-320}
      dy={-40}
      at={265}
      until={352}
    />
    <Callout
      text="It remembers what you have seen"
      x={830}
      y={220}
      dx={165}
      dy={-105}
      at={378}
    />
  </Dark>
);

const RunScene: React.FC = () => (
  <Dark>
    <Shot
      src="run.png"
      sourceWidth={2560}
      width={1064}
      height={580}
      top={40}
      views={[
        { at: 8, x: 0, y: 0, w: 2560 },
        { at: 36, x: 0, y: 120, w: 1500 },
      ]}
    />
    <Callout
      text="Opened on the line that broke"
      x={620}
      y={330}
      dx={-220}
      dy={-140}
      at={48}
    />
  </Dark>
);

const MONTAGE: { src: string; frames: number }[] = [
  { src: "issues.png", frames: 24 },
  { src: "commits.png", frames: 24 },
  { src: "actions.png", frames: 24 },
  { src: "notifications.png", frames: 133 },
];

const MontageScene: React.FC = () => (
  <Dark>
    <Series>
      {MONTAGE.map((page) => (
        <Series.Sequence key={page.src} durationInFrames={page.frames}>
          <Shot
            src={page.src}
            sourceWidth={2560}
            width={1064}
            height={580}
            top={40}
            enter={5}
            views={[{ at: 5, x: 0, y: 0, w: 2560 }]}
          />
        </Series.Sequence>
      ))}
    </Series>
    <Caption text="Every page. The same four groups." at={120} />
  </Dark>
);

const PrivacyScene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Bed>
      <AbsoluteFill style={{ transform: "translateY(-30px)" }}>
        <SoftBlurIn
          text="No account. No server."
          fontSize={64}
          fontWeight={700}
          color={ON_GRADIENT}
        />
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 430,
          textAlign: "center",
          fontSize: 28,
          fontWeight: 500,
          color: ON_GRADIENT_MUTED,
          opacity: fadeIn(frame, 90, 12),
        }}
      >
        Your own GitHub session. Your code stays in your browser.
      </div>
    </Bed>
  );
};

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
          opacity: fadeIn(frame, 40, 12),
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
          Free on Chrome
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
          opacity: fadeIn(frame, 70, 12),
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
  { scene: ProblemScene, frames: 465, out: "wash" },
  { scene: TurnScene, frames: 148, out: "wash" },
  { scene: ListScene, frames: 502, out: "fade" },
  { scene: RestScene, frames: 110, out: "cut" },
  { scene: PrOpenScene, frames: 380, out: "fade" },
  { scene: PrConvoScene, frames: 425, out: "fade" },
  { scene: RunScene, frames: 128, out: "fade" },
  { scene: MontageScene, frames: 205, out: "wash" },
  { scene: PrivacyScene, frames: 250, out: "wash" },
  { scene: CtaScene, frames: 180, out: "cut" },
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
