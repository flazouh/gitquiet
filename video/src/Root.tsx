import "./index.css";
import { Composition } from "remotion";
import { Comparison, DURATION_IN_FRAMES } from "./Comparison";
import { Race, RACE_DURATION_IN_FRAMES } from "./Race";
import { RaceTall, RACE_TALL_DURATION_IN_FRAMES } from "./RaceTall";

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
