import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONTS, label } from "../theme";
import { SYNTHETIC_NOTE } from "../script";

/** Opening line. Sets the problem before any UI is explained. */
export const Hook: React.FC<{ line: string }> = ({ line }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 14, 150, 170], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lift = interpolate(frame, [0, 20], [16, 0], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `rgba(27, 42, 74, ${0.82 * opacity})`,
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${lift}px)`,
          maxWidth: 1180,
          textAlign: "center",
          padding: "0 60px",
        }}
      >
        <div style={{ ...label(13), color: COLORS.goldSoft, marginBottom: 26 }}>
          AwaazIQ — from citizen voice to intelligent action
        </div>
        <div
          style={{
            fontFamily: FONTS.serif,
            fontSize: 52,
            lineHeight: 1.28,
            color: COLORS.cream,
          }}
        >
          {line}
        </div>
      </div>
    </div>
  );
};

/**
 * Stays up on every beat showing ranked output. A jury's first question about
 * any ranked list is "is this real data" — answering it before they ask costs
 * nothing and buys the rest of the video.
 */
export const SyntheticBadge: React.FC = () => (
  <div
    style={{
      position: "absolute",
      right: 40,
      bottom: 30,
      ...label(11),
      color: COLORS.card,
      background: "rgba(27, 42, 74, 0.78)",
      padding: "8px 14px",
      borderRadius: 6,
      letterSpacing: "0.1em",
    }}
  >
    {SYNTHETIC_NOTE}
  </div>
);

/** Small caption naming what the viewer is looking at. */
export const Caption: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        left: 72,
        top: 96,
        opacity,
        ...label(13),
        color: COLORS.card,
        background: "rgba(27, 42, 74, 0.86)",
        padding: "11px 18px",
        borderRadius: 8,
      }}
    >
      {text}
    </div>
  );
};
