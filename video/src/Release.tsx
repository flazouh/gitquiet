import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  getStaticFiles,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { GRADIENT, INK, MARK, ON_GRADIENT, ON_GRADIENT_MUTED, PAGE } from "./palette";
import { StaggeredFadeUp } from "./components/remocn/staggered-fade-up";
import { TrackingIn } from "./components/remocn/tracking-in";
import { SoftBlurIn } from "./components/remocn/soft-blur-in";
import { ScaleDownFade } from "./components/remocn/scale-down-fade";
import { Stage } from "./components/remocn/stage";
import { pushThrough } from "./components/remocn/push-through";
import { whipPan } from "./components/remocn/whip-pan";
import { zoomBlur } from "./components/remocn/zoom-blur";
import { focusPull } from "./components/remocn/focus-pull";

/**
 * The release video, composed as a product demo rather than one shot.
 *
 * Six beats from the remocn anatomy, and the two optional ones are folded into
 * the spine: the race is both the product reveal and the proof, so no separate
 * proof scene repeats its numbers. One accent for the whole video, the mark's
 * purple, spent on exactly three things: the landed 287, the punched heading,
 * and the CTA.
 *
 * Canvas is remocn's 1280x720 standard, which the catalog's components are laid
 * out for. Render at 1920x1080 with `--scale=1.5`.
 *
 * Audio mounts itself when the files exist and stays silent when they do not:
 * `public/music.mp3` and `public/vo.mp3` are looked up through getStaticFiles,
 * so the composition renders with or without them. scripts/make-audio.sh
 * produces both once ELEVENLABS_API_KEY is present.
 */

/** Beat lengths in frames. Transitions overlap the beats they join. */
const BEAT = {
  hook: 150,
  race: 196,
  positioning: 116,
  feature: 118,
  cta: 150,
} as const;
const T = { push: 40, focus: 46, whip: 26, zoom: 18 } as const;

export const RELEASE_DURATION_IN_FRAMES =
  BEAT.hook +
  BEAT.race +
  BEAT.positioning +
  BEAT.feature * 3 +
  BEAT.cta -
  (T.push + T.focus + T.whip * 3 + T.zoom);

/** When each side of the race had the pull request on screen, read off the frames. */
const READABLE = { theirs: 2050, ours: 287 } as const;

const Center: React.FC<{ children: React.ReactNode; gap?: number }> = ({ children, gap = 18 }) => (
  <AbsoluteFill
    style={{
      background: PAGE,
      justifyContent: "center",
      alignItems: "center",
      display: "flex",
      flexDirection: "column",
      gap,
    }}
  >
    {children}
  </AbsoluteFill>
);

const Hook: React.FC = () => (
  <Center>
    <div style={{ maxWidth: 900, textAlign: "center" }}>
      <StaggeredFadeUp
        text="GitHub keeps showing you the page you just left."
        fontSize={58}
        fontWeight={620}
        color={INK}
        staggerDelay={3}
      />
    </div>
  </Center>
);

/** One racing pane: the real recording, and a counter that freezes when it landed. */
const RacePane: React.FC<{ title: string; file: string; readableAt: number; accent?: boolean }> = ({
  title,
  file,
  readableAt,
  accent = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const landed = ms >= readableAt;
  const shown = Math.round(landed ? readableAt : ms);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "50%" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 22, fontWeight: 620, color: ON_GRADIENT, letterSpacing: "-0.02em" }}>
          {title}
        </span>
        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            fontSize: 26,
            fontWeight: 620,
            color: landed ? (accent ? MARK : ON_GRADIENT) : ON_GRADIENT_MUTED,
          }}
        >
          {shown}
          <span style={{ fontSize: 15, fontWeight: 500 }}> ms{landed ? " · readable" : ""}</span>
        </span>
      </div>
      <div style={{ borderRadius: 10, overflow: "hidden", background: "#0d1117" }}>
        <OffthreadVideo src={staticFile(file)} style={{ width: "100%", display: "block" }} muted />
      </div>
    </div>
  );
};

/**
 * The recordings start after the push-through has settled. Without the delay the
 * 287ms moment — the whole point of the shot — lands inside the transition blur.
 */
const Race: React.FC = () => (
  <AbsoluteFill style={{ background: PAGE, justifyContent: "center", padding: 36 }}>
    <Sequence from={T.push + 4} layout="none">
    <div style={{ background: GRADIENT, borderRadius: 20, padding: "22px 24px 20px" }}>
      <div style={{ display: "flex", gap: 20 }}>
        <RacePane title="GitHub" file="theirs.mp4" readableAt={READABLE.theirs} />
        <RacePane title="GitQuiet" file="ours.mp4" readableAt={READABLE.ours} accent />
      </div>
      <p
        style={{
          margin: "14px 0 0",
          fontSize: 17,
          fontWeight: 500,
          color: ON_GRADIENT_MUTED,
          textAlign: "center",
        }}
      >
        The same pull request, the same press, after resting on the row a moment.
      </p>
    </div>
    </Sequence>
  </AbsoluteFill>
);

const Positioning: React.FC = () => (
  <AbsoluteFill style={{ background: PAGE }}>
    <TrackingIn text="GitQuiet" fontSize={104} fontWeight={700} color={INK} startTracking={0.4} />
    <Sequence from={34} layout="none">
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "63%",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <SoftBlurIn
          text="The fastest and quietest way to work on GitHub."
          fontSize={28}
          fontWeight={500}
          color="#8b8b8b"
        />
      </div>
    </Sequence>
  </AbsoluteFill>
);

/**
 * One feature: the real screen as a photographed object, and one line under it.
 *
 * The camera work carries the beat: hold wide long enough to recognise the page,
 * punch into the one region the caption names, hold there. The screenshots are
 * the store photographs, on mocked pull requests in public repositories.
 */
const Feature: React.FC<{
  file: string;
  caption: string;
  punch: { x: number; y: number; zoom: number };
}> = ({ file, caption, punch }) => (
  <AbsoluteFill style={{ background: PAGE }}>
    <Stage
      contentSize={{ width: 2560, height: 1600 }}
      backdrop={PAGE}
      rotateX={6}
      rotateY={-8}
      scale={0.92}
      reflection={0.12}
      shake={0.08}
      seed={file}
      moves={[
        { at: 0, x: 0.5, y: 0.42, zoom: 1 },
        { at: 26, x: 0.5, y: 0.42, zoom: 1 },
        { at: 56, ...punch },
        { at: BEAT.feature, ...punch },
      ]}
    >
      <Img src={staticFile(file)} style={{ width: "100%", height: "100%" }} />
    </Stage>
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 34,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <SoftBlurIn text={caption} fontSize={30} fontWeight={600} color={INK} />
    </div>
  </AbsoluteFill>
);

const Cta: React.FC = () => (
  <AbsoluteFill style={{ background: PAGE }}>
    <ScaleDownFade text="Add to Chrome" fontSize={72} fontWeight={650} color={MARK} />
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 150,
        textAlign: "center",
        fontSize: 26,
        fontWeight: 500,
        color: INK,
        opacity: 0.75,
      }}
    >
      gitquiet.com
    </div>
  </AbsoluteFill>
);

/** Mounts a track only when the file is actually in public/, so no key, no crash. */
const OptionalAudio: React.FC<{ name: string; volume?: (f: number) => number }> = ({
  name,
  volume,
}) => {
  const exists = getStaticFiles().some((file) => file.name === name);
  if (!exists) return null;
  return <Audio src={staticFile(name)} volume={volume} />;
};

export const Release: React.FC = () => {
  const fadeOutFrom = RELEASE_DURATION_IN_FRAMES - 45;
  return (
    <AbsoluteFill style={{ background: PAGE }}>
      <OptionalAudio
        name="music.mp3"
        volume={(f) =>
          interpolate(f, [0, 30, fadeOutFrom, RELEASE_DURATION_IN_FRAMES], [0, 0.55, 0.55, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
      <OptionalAudio name="vo.mp3" />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={BEAT.hook}>
          <Hook />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          timing={linearTiming({ durationInFrames: T.push })}
          presentation={pushThrough()}
        />
        <TransitionSeries.Sequence durationInFrames={BEAT.race}>
          <Race />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          timing={linearTiming({ durationInFrames: T.focus })}
          presentation={focusPull()}
        />
        <TransitionSeries.Sequence durationInFrames={BEAT.positioning}>
          <Positioning />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          timing={linearTiming({ durationInFrames: T.whip })}
          presentation={whipPan()}
        />
        <TransitionSeries.Sequence durationInFrames={BEAT.feature}>
          <Feature
            file="workingset.png"
            caption="Everything you're in. One list."
            punch={{ x: 0.16, y: 0.24, zoom: 1.9 }}
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          timing={linearTiming({ durationInFrames: T.whip })}
          presentation={whipPan()}
        />
        <TransitionSeries.Sequence durationInFrames={BEAT.feature}>
          <Feature
            file="pull-request.png"
            caption="Everything unresolved, above the diff."
            punch={{ x: 0.14, y: 0.3, zoom: 1.8 }}
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          timing={linearTiming({ durationInFrames: T.whip })}
          presentation={whipPan()}
        />
        <TransitionSeries.Sequence durationInFrames={BEAT.feature}>
          <Feature
            file="run.png"
            caption="Opens on the line that broke."
            punch={{ x: 0.38, y: 0.22, zoom: 1.4 }}
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          timing={linearTiming({ durationInFrames: T.zoom })}
          presentation={zoomBlur()}
        />
        <TransitionSeries.Sequence durationInFrames={BEAT.cta}>
          <Cta />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
