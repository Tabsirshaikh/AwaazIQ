import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, SHADOW, label } from "../theme";


/**
 * The nine score terms, one at a time, timed to the breakdown bars
 * animating in on screen. Each term names itself first, then its source —
 * so the jury hears the name and reads where the number came from.
 */
type Timed = { name: string; source: string; points?: string; at: number };

export const TermList: React.FC<{ terms: Timed[]; beatStartSeconds: number }> = ({
  terms,
  beatStartSeconds,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Absolute time in the VO, since term.at is measured against the full track.
  const t = beatStartSeconds + frame / fps;

  // Nothing yet while the VO is still saying "breaks into nine visible terms".
  if (t < terms[0].at) return null;

  // The last term whose spoken moment has arrived.
  let index = 0;
  for (let i = 0; i < terms.length; i++) {
    if (t >= terms[i].at) index = i;
  }
  const term = terms[index];
  const localFrame = Math.round((t - term.at) * fps);

  const enter = spring({
    frame: localFrame,
    fps,
    config: { damping: 200 },
    durationInFrames: 14,
  });
  const slide = interpolate(enter, [0, 1], [30, 0]);

  return (
    <>
      {/* Progress ticks — how far through the nine we are */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 250,
          display: "flex",
          gap: 8,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {terms.map((t, i) => (
          <div
            key={t.name}
            style={{
              width: i === index ? 34 : 16,
              height: 4,
              borderRadius: 2,
              background: i <= index ? COLORS.gold : "rgba(255,255,255,0.45)",
              transition: "none",
            }}
          />
        ))}
        <div
          style={{
            ...label(11),
            color: COLORS.card,
            marginLeft: 12,
            textShadow: "0 1px 6px rgba(0,0,0,0.5)",
          }}
        >
          {index + 1} / {terms.length}
        </div>
      </div>

      {/* The active term */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 84,
          maxWidth: 1180,
          transform: "translateX(-50%)",
          background: COLORS.card,
          borderRadius: 14,
          padding: "24px 30px",
          boxShadow: SHADOW,
          borderTop: `4px solid ${COLORS.gold}`,
          opacity: enter,
          transform: `translateX(calc(-50% + ${slide}px))`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "center",
            gap: 16,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 34,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: COLORS.navy,
            }}
          >
            {term.name}
          </div>
          {term.points ? (
            <div
              style={{
                ...label(14),
                color: COLORS.card,
                background: COLORS.navy,
                padding: "5px 11px",
                borderRadius: 999,
              }}
            >
              {term.points} pts
            </div>
          ) : null}
        </div>

        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 21,
            lineHeight: 1.45,
            color: COLORS.muted,
            textAlign: "center",
          }}
        >
          {term.source}
        </div>
      </div>
    </>
  );
};
