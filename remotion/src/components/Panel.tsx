import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, SHADOW, label } from "../theme";

type Props = {
  header: string;
  lines: string[];
  footnote?: string;
  /** Where the card sits. Keep it off the part of the UI you're demoing. */
  position?: "bottom-left" | "bottom-right" | "top-right";
  /**
   * Length of the Sequence this panel lives in, so it can fade out before the
   * hard cut. Required because useVideoConfig() inside a Sequence reports the
   * whole composition's duration, not the Sequence's.
   */
  sequenceDuration: number;
  width?: number;
};

export const Panel: React.FC<Props> = ({
  header,
  lines,
  footnote,
  position = "bottom-left",
  sequenceDuration,
  width = 620,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 18 });
  const exitStart = sequenceDuration - 14;
  const exit = interpolate(frame, [exitStart, exitStart + 14], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = enter * exit;
  const lift = interpolate(enter, [0, 1], [26, 0]);

  const anchor: React.CSSProperties =
    position === "bottom-left"
      ? { left: 72, bottom: 84 }
      : position === "bottom-right"
        ? { right: 72, bottom: 84 }
        : { right: 72, top: 96 };

  return (
    <div
      style={{
        position: "absolute",
        ...anchor,
        width,
        opacity,
        transform: `translateY(${lift}px)`,
        background: COLORS.card,
        borderRadius: 14,
        padding: "26px 30px 24px",
        boxShadow: SHADOW,
        borderTop: `3px solid ${COLORS.gold}`,
      }}
    >
      <div style={{ ...label(12), color: COLORS.gold, marginBottom: 16 }}>{header}</div>

      {lines.map((line, i) => {
        const lineIn = interpolate(frame, [8 + i * 4, 20 + i * 4], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={line}
            style={{
              opacity: lineIn,
              fontFamily: FONTS.sans,
              fontSize: 19,
              lineHeight: 1.5,
              color: COLORS.ink,
              marginBottom: 9,
              paddingLeft: 16,
              borderLeft: `2px solid ${COLORS.goldSoft}`,
            }}
          >
            {line}
          </div>
        );
      })}

      {footnote ? (
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: `1px solid ${COLORS.rule}`,
            fontFamily: FONTS.sans,
            fontSize: 16,
            fontStyle: "italic",
            color: COLORS.muted,
            lineHeight: 1.45,
          }}
        >
          {footnote}
        </div>
      ) : null}
    </div>
  );
};
