/**
 * The two cuts of the demo, each timed to its own voiceover render.
 *
 * Every timing here was read off a faster-whisper transcript of the actual
 * ElevenLabs audio, so overlays land on the word rather than near it.
 *
 *   long  — 86.4s, names all nine score terms individually
 *   short — 65.3s, groups the last four terms into one line
 *
 * Overlay copy (panels, term sources) is shared and lives in script.ts.
 */

import { FPS } from "./script";

export type Caption = { start: number; end: number; text: string };

export type Beat = { from: number; durationInFrames: number };

export type Variant = {
  id: string;
  durationInFrames: number;
  audioSrc: string;
  beats: Record<
    "hook" | "intake" | "cluster" | "terms" | "investment" | "optimizer" | "close",
    Beat
  >;
  captions: Caption[];
  /** Absolute second each score term is spoken. */
  termTimes: Record<string, number>;
};

const s = (seconds: number) => Math.round(seconds * FPS);
const beat = (from: number, to: number): Beat => ({
  from: s(from),
  durationInFrames: s(to - from),
});

/* ------------------------------------------------------------------ */
/* LONG — 86.4s                                                        */
/* ------------------------------------------------------------------ */

export const LONG: Variant = {
  id: "AwaazIQ-87s",
  durationInFrames: 2600,
  audioSrc: "vo-87.mp3",
  beats: {
    hook: beat(0.0, 5.36),
    intake: beat(5.36, 19.52),
    cluster: beat(19.52, 32.76),
    terms: beat(32.76, 73.72),
    investment: beat(73.72, 78.96),
    optimizer: beat(78.96, 83.96),
    close: beat(83.96, 86.36),
  },
  termTimes: {
    Demand: 35.08,
    Population: 40.16,
    "Infra-deficit": 45.0,
    Vulnerability: 50.8,
    Equity: 53.84,
    Strategic: 57.2,
    Urgency: 61.16,
    Feasibility: 66.56,
    Cost: 68.84,
  },
  captions: [
    { start: 0.0, end: 1.94, text: "Every complaint system routes tickets." },
    { start: 1.94, end: 3.88, text: "None answer the question that matters." },
    { start: 3.88, end: 5.36, text: "What should we build first?" },

    { start: 5.36, end: 8.22, text: "A citizen reports by voice or text in their own language," },
    { start: 8.22, end: 10.12, text: "so literacy isn't a barrier." },
    { start: 10.12, end: 13.6, text: "Whisper transcribes it, and every photo is checked before it counts." },
    { start: 13.6, end: 15.72, text: "Perceptual hashing catches reused images," },
    { start: 15.72, end: 19.52, text: "EXIF flags edits, and a VLLM model reads the actual damage." },

    { start: 19.52, end: 22.44, text: "Fifty people reporting one broken culvert becomes one problem," },
    { start: 22.44, end: 26.92, text: "not fifty tickets — DBSCAN clustering over multilingual sentence embeddings," },
    { start: 26.92, end: 28.48, text: "gated by haversine distance." },
    { start: 28.52, end: 31.04, text: "And it ranks twice: by category, and by village," },
    { start: 31.04, end: 32.76, text: "down to the exact asset." },

    { start: 32.76, end: 35.08, text: "Every rank breaks into nine visible terms." },
    { start: 35.08, end: 37.92, text: "Demand: how many distinct people reported, capped," },
    { start: 37.92, end: 40.16, text: "so a loud area can't out-shout a quiet one." },
    { start: 40.16, end: 42.6, text: "Population: how many people the problem affects," },
    { start: 42.6, end: 45.0, text: "log-scaled so cities don't always win." },
    { start: 45.0, end: 50.8, text: "Infra-deficit: how far below the published national standard that road, school or water supply actually is." },
    { start: 50.8, end: 53.84, text: "Vulnerability: how deprived the village already is." },
    { start: 53.84, end: 57.16, text: "Equity: ten points for places that can't report at all." },
    { start: 57.2, end: 61.16, text: "Strategic: four points when a government scheme rule is already crossed." },
    { start: 61.16, end: 64.2, text: "Urgency: fifteen points, emergencies only," },
    { start: 64.2, end: 66.56, text: "so a cracked or collapsing bridge skips the queue." },
    { start: 66.56, end: 68.84, text: "Feasibility: two points for reachability." },
    { start: 68.84, end: 70.56, text: "Cost: subtracted." },
    { start: 70.56, end: 73.72, text: "They sum exactly to the score, so an official can audit why." },

    { start: 73.72, end: 76.48, text: "We also check whether money is already sitting where people are complaining:" },
    { start: 76.48, end: 78.96, text: "funded but never delivered, or needed and never funded." },

    { start: 78.96, end: 82.0, text: "Then give it a real budget, and an exact zero-one knapsack" },
    { start: 82.0, end: 83.96, text: "solves which projects actually fit." },

    { start: 83.96, end: 86.36, text: "Every number traceable to a government record." },
  ],
};

/* ------------------------------------------------------------------ */
/* SHORT — 65.3s                                                       */
/* ------------------------------------------------------------------ */

export const SHORT: Variant = {
  id: "AwaazIQ-65s",
  durationInFrames: 1965,
  audioSrc: "vo-65.mp3",
  beats: {
    hook: beat(0.0, 6.04),
    intake: beat(6.04, 19.92),
    cluster: beat(19.92, 32.72),
    terms: beat(32.72, 53.12),
    investment: beat(53.12, 58.48),
    optimizer: beat(58.48, 63.08),
    close: beat(63.08, 65.28),
  },
  /**
   * This render says "Strategic, urgency, feasibility, and cost" as a single
   * line at 46.44. The last four are fanned out across it so each still gets
   * its own source label on screen.
   */
  termTimes: {
    Demand: 34.72,
    Population: 37.64,
    "Infra-deficit": 39.32,
    Vulnerability: 41.68,
    Equity: 43.56,
    Strategic: 46.44,
    Urgency: 47.2,
    Feasibility: 48.0,
    Cost: 48.8,
  },
  captions: [
    { start: 0.0, end: 2.16, text: "Every complaint system routes tickets." },
    { start: 2.16, end: 4.2, text: "None answer the question that matters." },
    { start: 4.2, end: 6.04, text: "What should we build first?" },

    { start: 6.04, end: 8.72, text: "A citizen reports by voice or text in their own language," },
    { start: 8.72, end: 10.8, text: "so literacy isn't a barrier." },
    { start: 10.8, end: 14.24, text: "Whisper transcribes it, and every photo is checked before it counts." },
    { start: 14.24, end: 16.2, text: "Perceptual hashing catches reused images," },
    { start: 16.2, end: 17.48, text: "EXIF flags edits," },
    { start: 17.48, end: 19.92, text: "and a VLLM model reads the actual damage." },

    { start: 19.92, end: 24.0, text: "Fifty people reporting one broken culvert becomes one problem, not fifty tickets." },
    { start: 24.0, end: 26.84, text: "DBSCAN clustering over multilingual sentence embeddings," },
    { start: 26.84, end: 28.32, text: "gated by haversine distance." },
    { start: 28.32, end: 30.96, text: "And it ranks twice: by category and by village," },
    { start: 30.96, end: 32.72, text: "down to the exact asset." },

    { start: 32.72, end: 34.72, text: "Every rank breaks into nine visible terms." },
    { start: 34.72, end: 37.64, text: "Demand — capped, so a loud area can't out-shout a quiet one." },
    { start: 37.64, end: 39.32, text: "Population — log-scaled." },
    { start: 39.32, end: 41.68, text: "How far below national standard the infrastructure is." },
    { start: 41.68, end: 43.56, text: "How vulnerable the village already is." },
    { start: 43.56, end: 46.44, text: "Equity — ten points for places that can't report at all." },
    { start: 46.44, end: 49.56, text: "Strategic, urgency, feasibility, and cost." },
    { start: 49.56, end: 53.12, text: "They sum exactly to the score, so an official can audit why." },

    { start: 53.12, end: 55.84, text: "We also check whether money is already sitting where people are complaining:" },
    { start: 55.84, end: 58.48, text: "funded but never delivered, or needed and never funded." },

    { start: 58.48, end: 61.48, text: "Then give it a real budget, and an exact zero-one knapsack" },
    { start: 61.48, end: 63.08, text: "solves which projects actually fit." },

    { start: 63.08, end: 65.28, text: "Every number traceable to a government record." },
  ],
};

/** Which second of each source clip a beat starts at. Shared — same footage. */
export const OFFSETS = {
  hook: 8, // Nashik map, village bubbles
  intake: 2, // phone: complaint form
  cluster: 20, // map → village panel
  terms: 24, // village panel, breakdown visible and stable
  investment: 63, // demanded-unfunded / funded-not-demanded tables
  optimizer: 89, // budget slider, allocated projects
};
