import { useEffect, useState } from "react";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import {
  AbsoluteFill,
  Audio,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { SimulatedCursor } from "@/components/remocn/simulated-cursor";
import { SoftBlurIn } from "@/components/remocn/soft-blur-in";
import { TrackingIn } from "@/components/remocn/tracking-in";
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
import { GroupHeader, ORANGE, PullRequestRow, SettleMove } from "@/Row";
import { Shot } from "@/Shot";
import { bedWash } from "@/Wash";

/**
 * The release video: one pull request's day.
 *
 * Built to the reference's grammar (gitquiet-notes, research/video-reference.md):
 * one example threaded through everything, light and dark worlds alternating,
 * colour-wash transitions in the brand's own bed, UI floating without chrome,
 * and the purple spent three times — the read-ahead, the 287, the lockups.
 *
 * The example is oven-sh/bun #18742, the pull request the screenshots and the
 * race recordings already carry. It sits in Needs You, you rest on its row, it
 * opens in 287ms, its threads sit above its diff, its CI failure opens on the
 * line that broke, and it settles without you.
 *
 * Where the reference cuts to photographic inserts, this cuts to the product's
 * own material at macro scale — a single row, big — because GitQuiet has no
 * trail to film and borrowed footage would read as borrowed.
 */

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif";

const HOOK = 78;
const LOCKUP = 92;
const LIST = 112;
const REST = 116;
const OPEN = 100;
const GROUPS = 100;
const THREADS = 100;
const CI = 92;
const SETTLED = 100;
const CTA = 124;

const WASH = 20;
const FADE = 10;

export const DAY_DURATION_IN_FRAMES =
  HOOK +
  LOCKUP +
  LIST +
  REST +
  OPEN +
  GROUPS +
  THREADS +
  CI +
  SETTLED +
  CTA -
  (5 * WASH + 3 * FADE);

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

/** One sentence in the band under the card. Every dark beat uses the same seat. */
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

const HookScene: React.FC = () => (
  <Dark>
    <TrackingIn
      text="Less to hold in your head."
      fontSize={62}
      fontWeight={650}
      color={INK}
      startTracking={0.32}
    />
  </Dark>
);

const LockupScene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Bed>
      <AbsoluteFill style={{ transform: "translateY(-42px)" }}>
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
          top: 428,
          textAlign: "center",
          fontSize: 30,
          fontWeight: 500,
          color: ON_GRADIENT_MUTED,
          opacity: fadeIn(frame, 26, 12),
        }}
      >
        The fastest and quietest way to work on GitHub.
      </div>
    </Bed>
  );
};

const ListScene: React.FC = () => (
  <Dark>
    <Shot
      src="workingset.png"
      sourceWidth={2560}
      width={1064}
      height={580}
      top={40}
      enter={14}
      views={[
        { at: 14, x: 0, y: 0, w: 2560 },
        { at: 104, x: 0, y: 204, w: 2560 },
      ]}
    />
    <Caption text="Everything you're in. One list." at={12} />
  </Dark>
);

const RestScene: React.FC = () => {
  const frame = useCurrentFrame();
  const hover = fadeIn(frame, 28, 6);
  const prefetch = interpolate(frame, [34, 46], [0, 1], {
    ...CLAMP,
    easing: EXPO,
  });
  const press = interpolate(frame, [104, 108, 112], [1, 0.985, 1], CLAMP);
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
          <PullRequestRow hover={hover} prefetch={prefetch} />
        </div>
      </div>
      <SimulatedCursor
        points={[
          { x: 1150, y: 664, hold: 0 },
          { x: 702, y: 392, hold: 56 },
          { x: 705, y: 394, hold: 18, click: true },
        ]}
        size={30}
      />
      <Caption text="Rest on a row. It reads ahead." at={30} />
    </Dark>
  );
};

const OpenScene: React.FC = () => {
  const frame = useCurrentFrame();
  /** The page arrives in nine frames — 287ms of real time, shown as itself. */
  const count = Math.round(
    interpolate(frame, [0, 9], [0, 287], CLAMP),
  );
  return (
    <Dark>
      <Shot
        src="pull-request.png"
        sourceWidth={2560}
        width={1064}
        height={540}
        top={36}
        enter={9}
        views={[
          { at: 0, x: 0, y: 0, w: 2560 },
          { at: 96, x: 60, y: 30, w: 2400 },
        ]}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 606,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "center",
          gap: 20,
        }}
      >
        <span
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: MARK,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {count}
          <span style={{ fontSize: 30, fontWeight: 600 }}> ms</span>
        </span>
        <span
          style={{
            fontSize: 25,
            color: INK,
            fontWeight: 500,
            opacity: fadeIn(frame, 10, 8),
          }}
        >
          to readable, after that rest on the row.
        </span>
        <span
          style={{
            fontSize: 25,
            color: MUTED,
            opacity: fadeIn(frame, 30, 10),
          }}
        >
          GitHub: 2132 ms.
        </span>
      </div>
    </Dark>
  );
};

const GROUP_PILLS = [
  { label: "Needs You", lead: true },
  { label: "Waiting", lead: false },
  { label: "Running", lead: false },
  { label: "Settled", lead: false },
];

const GroupsScene: React.FC = () => {
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
          fontSize: 30,
          fontWeight: 550,
          color: ON_GRADIENT_MUTED,
          opacity: fadeIn(frame, 4, 10),
        }}
      >
        One list. Four groups.
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 316,
          display: "flex",
          justifyContent: "center",
          gap: 22,
        }}
      >
        {GROUP_PILLS.map((pill, i) => {
          const at = 12 + i * 7;
          const opacity = fadeIn(frame, at, 9);
          const y = interpolate(frame, [at, at + 12], [16, 0], {
            ...CLAMP,
            easing: EXPO,
          });
          return (
            <div
              key={pill.label}
              style={{
                padding: "16px 30px",
                borderRadius: 999,
                fontSize: 29,
                fontWeight: pill.lead ? 650 : 550,
                background: pill.lead
                  ? "rgba(255,255,255,0.82)"
                  : "rgba(255,255,255,0.34)",
                color: pill.lead ? ON_GRADIENT : ON_GRADIENT_MUTED,
                opacity,
                transform: `translateY(${y}px)`,
              }}
            >
              {pill.label}
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 448,
          textAlign: "center",
          fontSize: 30,
          fontWeight: 550,
          color: ON_GRADIENT,
          opacity: fadeIn(frame, 48, 12),
        }}
      >
        Only the first asks anything of you.
      </div>
    </Bed>
  );
};

const ThreadsScene: React.FC = () => (
  <Dark>
    <Shot
      src="pull-request.png"
      sourceWidth={2560}
      width={1064}
      height={580}
      top={40}
      views={[
        { at: 8, x: 0, y: 0, w: 2560 },
        { at: 88, x: 0, y: 80, w: 1350 },
      ]}
    />
    <Caption text="Every unresolved thread, above the diff." at={30} />
  </Dark>
);

const CiScene: React.FC = () => (
  <Dark>
    <Shot
      src="run.png"
      sourceWidth={2560}
      width={1064}
      height={580}
      top={40}
      views={[
        { at: 6, x: 0, y: 0, w: 2560 },
        { at: 76, x: 0, y: 90, w: 1400 },
      ]}
    />
    <Caption text="CI failed. Opened on the line that broke." at={26} />
  </Dark>
);

const SettledScene: React.FC = () => (
  <Dark>
    <SettleMove moveAt={26} />
    <Caption text="The rest settles on its own." at={54} />
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
          opacity: fadeIn(frame, 34, 12),
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
          opacity: fadeIn(frame, 48, 12),
        }}
      >
        gitquiet.com
      </div>
    </Bed>
  );
};

const wash = () => (
  <TransitionSeries.Transition
    presentation={bedWash()}
    timing={linearTiming({ durationInFrames: WASH })}
  />
);

const quickFade = () => (
  <TransitionSeries.Transition
    presentation={fade()}
    timing={linearTiming({ durationInFrames: FADE })}
  />
);

export const Day: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: PAGE }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={HOOK}>
          <HookScene />
        </TransitionSeries.Sequence>
        {wash()}
        <TransitionSeries.Sequence durationInFrames={LOCKUP}>
          <LockupScene />
        </TransitionSeries.Sequence>
        {wash()}
        <TransitionSeries.Sequence durationInFrames={LIST}>
          <ListScene />
        </TransitionSeries.Sequence>
        {quickFade()}
        <TransitionSeries.Sequence durationInFrames={REST}>
          <RestScene />
        </TransitionSeries.Sequence>
        {/* A hard cut on the press: the arrival is the claim, and a transition
            would hide the one moment the video exists to show. */}
        <TransitionSeries.Sequence durationInFrames={OPEN}>
          <OpenScene />
        </TransitionSeries.Sequence>
        {wash()}
        <TransitionSeries.Sequence durationInFrames={GROUPS}>
          <GroupsScene />
        </TransitionSeries.Sequence>
        {wash()}
        <TransitionSeries.Sequence durationInFrames={THREADS}>
          <ThreadsScene />
        </TransitionSeries.Sequence>
        {quickFade()}
        <TransitionSeries.Sequence durationInFrames={CI}>
          <CiScene />
        </TransitionSeries.Sequence>
        {quickFade()}
        <TransitionSeries.Sequence durationInFrames={SETTLED}>
          <SettledScene />
        </TransitionSeries.Sequence>
        {wash()}
        <TransitionSeries.Sequence durationInFrames={CTA}>
          <CtaScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <OptionalAudio src="music.mp3" volume={0.4} />
      <OptionalAudio src="vo.mp3" />
    </AbsoluteFill>
  );
};
