import React from "react";
import { Composition } from "remotion";
import { AwaazIQVideo } from "./AwaazIQVideo";
import { FPS } from "./script";
import { LONG, SHORT } from "./variants";

/** Two cuts of the same edit, each locked to its own voiceover render. */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {[LONG, SHORT].map((variant) => (
        <Composition
          key={variant.id}
          id={variant.id}
          component={AwaazIQVideo}
          durationInFrames={variant.durationInFrames}
          fps={FPS}
          width={1920}
          height={1080}
          defaultProps={{
            variant,
            officialsSrc: "officials.mkv",
            phoneSrc: "phone.mp4",
          }}
        />
      ))}
    </>
  );
};
