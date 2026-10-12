import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, label } from "../theme";
import { CLOSING_STATS, HONESTY, SYNTHETIC_NOTE } from "../script";

/**
 * Full-frame close. The honesty block is the point of this card —
 * two tables deliberately left at zero is the line most teams can't say.
 */
export const ClosingCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const wash = interpolate(frame, [0, 6], [0, 0.98], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: COLORS.cream,
        opacity: wash,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 140px",
      }}
    >
      <div style={{ ...label(14), color: COLORS.gold, marginBottom: 34 }}>What's loaded</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "34px 76px", marginBottom: 54 }}>
        {CLOSING_STATS.map((stat, i) => {
          const pop = spring({
            frame: frame - 2 - i * 1,
            fps,
            config: { damping: 200 },
            durationInFrames: 16,
          });
          return (
            <div key={stat.label} style={{ opacity: pop, transform: `translateY(${(1 - pop) * 14}px)` }}>
              <div
                style={{
                  fontFamily: FONTS.serif,
                  fontSize: 58,
                  lineHeight: 1,
                  color: COLORS.navy,
                }}
              >
                {stat.value}
              </div>
              <div style={{ ...label(12), color: COLORS.muted, marginTop: 8 }}>{stat.label}</div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          opacity: interpolate(frame, [14, 24], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          borderTop: `1px solid ${COLORS.rule}`,
          paddingTop: 26,
          maxWidth: 1080,
        }}
      >
        <div style={{ ...label(12), color: COLORS.navy, marginBottom: 12 }}>{HONESTY.header}</div>
        {HONESTY.lines.map((line) => (
          <div
            key={line}
            style={{
              fontFamily: FONTS.sans,
              fontSize: 20,
              color: COLORS.muted,
              lineHeight: 1.6,
            }}
          >
            {line}
          </div>
        ))}
        <div
          style={{
            marginTop: 16,
            fontFamily: FONTS.sans,
            fontSize: 18,
            fontStyle: "italic",
            color: COLORS.muted,
          }}
        >
          {SYNTHETIC_NOTE}.
        </div>
      </div>
    </div>
  );
};
