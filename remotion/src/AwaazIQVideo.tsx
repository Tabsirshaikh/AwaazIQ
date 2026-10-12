import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile } from "remotion";
import { COLORS } from "./theme";
import { FPS, INVESTMENT, PHOTO_CHECKS, TERMS } from "./script";
import type { Variant } from "./variants";
import { OFFSETS } from "./variants";
import { Panel } from "./components/Panel";
import { TermList } from "./components/TermList";
import { ClosingCard } from "./components/ClosingCard";
import { Caption, Hook, SyntheticBadge } from "./components/Chrome";
import { Subtitles } from "./components/Subtitles";

export type Props = {
  variant: Variant;
  officialsSrc: string;
  phoneSrc: string;
};

const Desktop: React.FC<{ src: string; startAt: number }> = ({ src, startAt }) => (
  <OffthreadVideo src={staticFile(src)} startFrom={Math.round(startAt * FPS)} muted />
);

/** Portrait phone capture, centred with its own blurred fill — no stretching. */
const Phone: React.FC<{ src: string; startAt: number }> = ({ src, startAt }) => {
  const from = Math.round(startAt * FPS);
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.navy }}>
      <AbsoluteFill style={{ filter: "blur(38px) brightness(0.45)", transform: "scale(1.4)" }}>
        <OffthreadVideo src={staticFile(src)} startFrom={from} muted />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            height: 1010,
            aspectRatio: "1080 / 2400",
            overflow: "hidden",
            borderRadius: 26,
            boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
          }}
        >
          <OffthreadVideo
            src={staticFile(src)}
            startFrom={from}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const AwaazIQVideo: React.FC<Props> = ({ variant, officialsSrc, phoneSrc }) => {
  const B = variant.beats;

  // Attach this variant's spoken timings to the shared term copy.
  const timedTerms = TERMS.map((t) => ({ ...t, at: variant.termTimes[t.name] }));

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.cream }}>
      <Audio src={staticFile(variant.audioSrc)} />

      <Sequence from={B.hook.from} durationInFrames={B.hook.durationInFrames}>
        <Desktop src={officialsSrc} startAt={OFFSETS.hook} />
        <Hook line="Every complaint system routes tickets. None answer the question that matters — what should we build first?" />
      </Sequence>

      <Sequence from={B.intake.from} durationInFrames={B.intake.durationInFrames}>
        <Phone src={phoneSrc} startAt={OFFSETS.intake} />
        <Caption text="Citizen intake — voice or text, any language" />
        <Panel
          header={PHOTO_CHECKS.header}
          lines={PHOTO_CHECKS.lines}
          footnote={PHOTO_CHECKS.footnote}
          position="bottom-right"
          sequenceDuration={B.intake.durationInFrames}
          width={660}
        />
      </Sequence>

      <Sequence from={B.cluster.from} durationInFrames={B.cluster.durationInFrames}>
        <Desktop src={officialsSrc} startAt={OFFSETS.cluster} />
        <Caption text="Clustering — one problem, not fifty tickets" />
        <SyntheticBadge />
      </Sequence>

      <Sequence from={B.terms.from} durationInFrames={B.terms.durationInFrames}>
        <Desktop src={officialsSrc} startAt={OFFSETS.terms} />
        <Caption text="Priority score — nine terms, summing exactly to the total" />
        <TermList terms={timedTerms} beatStartSeconds={B.terms.from / FPS} />
        <SyntheticBadge />
      </Sequence>

      <Sequence from={B.investment.from} durationInFrames={B.investment.durationInFrames}>
        <Desktop src={officialsSrc} startAt={OFFSETS.investment} />
        <Caption text="Demand vs investment" />
        <Panel
          header={INVESTMENT.header}
          lines={INVESTMENT.rows.map((r) => `${r.label} — ${r.text}`)}
          position="bottom-left"
          sequenceDuration={B.investment.durationInFrames}
          width={880}
        />
        <SyntheticBadge />
      </Sequence>

      <Sequence from={B.optimizer.from} durationInFrames={B.optimizer.durationInFrames}>
        <Desktop src={officialsSrc} startAt={OFFSETS.optimizer} />
        <Caption text="Budget optimizer — exact 0/1 knapsack over real undelivered cost" />
        <SyntheticBadge />
      </Sequence>

      <Sequence from={B.close.from} durationInFrames={B.close.durationInFrames}>
        <ClosingCard />
      </Sequence>

      <Subtitles captions={variant.captions} />
    </AbsoluteFill>
  );
};
