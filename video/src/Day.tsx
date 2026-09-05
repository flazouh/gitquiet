import { cloneElement, useEffect, useState } from "react";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import {
  AbsoluteFill,
  Audio,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { SoftBlurIn } from "@/components/remocn/soft-blur-in";
import { fadeIn } from "@/lib/remocn/scene-motion";
import {
  GRADIENT,
  ON_GRADIENT,
  ON_GRADIENT_MUTED,
  PAGE,
} from "@/palette";
import { Callout } from "@/Callout";
import { Shot } from "@/Shot";
import { bedWash } from "@/Wash";

/**
 * The release video, cut five: the hook.
 *
 * Direction is Alex's: straight to the biggest pains and out, nothing on
 * settings or themes. Open on GitHub's own "Hide whitespace" box, the most
 * upvoted complaint on their board, then the three things this fixes that
 * the most people recognise: the box that forgets itself, the review thread
 * that vanishes on push, and the list that says what needs you.
 *
 * The voice leads and the picture is cut to its clip timestamps, which is
 * why every beat length below is odd. The read was written in a fresh
 * context from the verified pain list (gitquiet-notes,
 * research/voice-over-spoken.md); the picture claims only what each
 * screenshot shows.
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

/**
 * GitHub's own Files changed page, a real pull request, with the diff
 * settings open on the box the voice is talking about. The camera opens on
 * the whole page and lands on the popover as the box is named.
 */
const BoxScene: React.FC = () => (
  <Dark>
    <Shot
      src="github-whitespace.png"
      sourceWidth={2560}
      width={1064}
      height={580}
      top={40}
      enter={12}
      views={[
        { at: 60, x: 0, y: 0, w: 2560 },
        { at: 130, x: 1350, y: 330, w: 1100 },
      ]}
    />
    <Callout
      text="929 upvotes on GitHub's own board"
      x={430}
      y={660}
      dx={260}
      dy={-171}
      at={279}
    />
  </Dark>
);

const TurnScene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Bed>
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

/**
 * The same box on our side: one knob in the settings sheet, whose answer is
 * kept. The camera lands on the knob's row as the voice says it stays.
 */
const SettingScene: React.FC = () => (
  <Dark>
    <Shot
      src="settings.png"
      sourceWidth={2560}
      width={1064}
      height={580}
      top={40}
      enter={8}
      views={[
        { at: 0, x: 230, y: 346, w: 2048 },
        { at: 50, x: 560, y: 800, w: 1300 },
      ]}
    />
    <Callout
      text="Remembered across pull requests"
      x={600}
      y={660}
      dx={321}
      dy={-181}
      at={75}
    />
  </Dark>
);

const ThreadsScene: React.FC = () => (
  <Dark>
    <Shot
      src="pull-request.png"
      sourceWidth={2560}
      width={1064}
      height={580}
      top={40}
      views={[
        { at: 0, x: 0, y: 360, w: 1350 },
        { at: 560, x: 0, y: 378, w: 1330 },
      ]}
    />
    <Callout
      text="Unresolved threads, above the diff"
      x={740}
      y={140}
      dx={-300}
      dy={60}
      at={311}
    />
    <Callout text="Still there after a push" x={330} y={660} at={450} />
    <Callout text="Real text, so find in page works" x={900} y={660} at={485} />
  </Dark>
);

/** The group meanings are the README's own words. */
const GROUP_LABELS: { text: string; y: number; at: number }[] = [
  { text: "You can act on it now", y: 91, at: 272 },
  { text: "Someone else has to act", y: 387, at: 290 },
  { text: "A machine is still working", y: 525, at: 308 },
  { text: "Finished", y: 635, at: 326 },
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
        { at: 300, x: 0, y: 116, w: 2520 },
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
          opacity: fadeIn(frame, 280, 12),
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
          opacity: fadeIn(frame, 322, 12),
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
          opacity: fadeIn(frame, 393, 12),
        }}
      >
        gitquiet.com
      </div>
    </Bed>
  );
};

/**
 * The whole film, in order, cut to the voice's clip timestamps. `out` is how
 * a beat leaves: a wash between worlds, a fade within one, and a hard cut at
 * the end. A beat's frames are its own length plus its overlap, so the next
 * beat begins exactly where the voice's next clip is about to start.
 */
const BEATS: { scene: React.FC; frames: number; out: Out }[] = [
  { scene: BoxScene, frames: 378, out: "wash" },
  { scene: TurnScene, frames: 121, out: "wash" },
  { scene: SettingScene, frames: 143, out: "fade" },
  { scene: ThreadsScene, frames: 606, out: "fade" },
  { scene: ListScene, frames: 374, out: "wash" },
  { scene: CtaScene, frames: 586, out: "cut" },
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
