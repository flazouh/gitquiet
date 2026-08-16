import "./index.css";
import { Composition } from "remotion";
import { Comparison, DURATION_IN_FRAMES } from "./Comparison";
import { Race, RACE_DURATION_IN_FRAMES } from "./Race";

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
