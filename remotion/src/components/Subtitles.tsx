import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Caption } from "../variants";
import { COLORS, FONTS } from "../theme";

/**
 * Burned-in subtitles, timed to the actual voiceover render.
 *
 * Sits above the source panels (which live at bottom-left / bottom-right)
 * by centring on a reserved strip, so the two never collide.
 */
export const Subtitles: React.FC<{ captions: Caption[]; bottom?: number }> = ({
  captions,
  bottom = 470,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const active = captions.find((c) => t >= c.start && t < c.end);
  if (!active) return null;

  // Short fade so lines swap softly instead of snapping.
  const fadeIn = interpolate(t, [active.start, active.start + 0.12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(t, [active.end - 0.12, active.end], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          opacity,
          maxWidth: 1280,
          textAlign: "center",
          fontFamily: FONTS.sans,
          fontSize: 34,
          lineHeight: 1.35,
          fontWeight: 500,
          color: COLORS.card,
          background: "rgba(16, 24, 42, 0.82)",
          padding: "14px 30px",
          borderRadius: 10,
          textShadow: "0 2px 10px rgba(0,0,0,0.45)",
        }}
      >
        {active.text}
      </div>
    </div>
  );
};
