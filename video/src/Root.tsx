import "./index.css";
import { Composition } from "remotion";
import { Comparison, DURATION_IN_FRAMES } from "./Comparison";
import { Race, RACE_DURATION_IN_FRAMES } from "./Race";
import { RaceTall, RACE_TALL_DURATION_IN_FRAMES } from "./RaceTall";
import { Courts, COURTS_DURATION_IN_FRAMES } from "./Courts";
import { Launch, LAUNCH_DURATION_IN_FRAMES } from "./Launch";
import { Day, DAY_DURATION_IN_FRAMES } from "./Day";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Race"
        component={Race}
        durationInFrames={RACE_DURATION_IN_FRAMES}
        fps={30}
        width={1920}
        height={1080}
      />
      {/* The release video: one pull request's day, to the reference's grammar.
          Composed at remocn's 1280x720 standard; render with --scale=1.5 for
          1920x1080. */}
      <Composition
        id="Release"
        component={Day}
        durationInFrames={DAY_DURATION_IN_FRAMES}
        fps={30}
        width={1280}
        height={720}
      />
      {/* The main post: the race and the Working Set as one piece, inside the length
          band the launch videos worth copying actually occupy. */}
      <Composition
        id="Launch"
        component={Launch}
        durationInFrames={LAUNCH_DURATION_IN_FRAMES}
        fps={30}
        width={1080}
        height={1350}
      />
      {/* The second post in the thread: the idea, once the race has bought the attention. */}
      <Composition
        id="Courts"
        component={Courts}
        durationInFrames={COURTS_DURATION_IN_FRAMES}
        fps={30}
        width={1080}
        height={1350}
      />
      {/* The cut X and any other vertical feed gets. */}
      <Composition
        id="RaceTall"
        component={RaceTall}
        durationInFrames={RACE_TALL_DURATION_IN_FRAMES}
        fps={30}
        width={1080}
        height={1350}
      />
      <Composition
        id="Comparison"
        component={Comparison}
        durationInFrames={DURATION_IN_FRAMES}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
