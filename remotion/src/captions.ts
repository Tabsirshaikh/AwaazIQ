/**
 * Subtitle track for the 65s voiceover render.
 *
 * Timings come from transcribing the actual ElevenLabs audio with
 * faster-whisper, so each line changes on the word it's spoken.
 * The TEXT is the intended script, not the raw transcript — the render
 * slurs two terms ("harvesting distance" → haversine, "exit" → EXIF) and
 * Whisper misheard "audit why" as "cannot at why". VLLM is left as spoken:
 * that's the vision-LLM damage model (C6), not a mispronunciation.
 */

export type Caption = { start: number; end: number; text: string };

export const CAPTIONS: Caption[] = [
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
];
