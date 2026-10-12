/**
 * Single source of truth for the demo video: every beat, its frame range,
 * the voiceover line spoken over it, and the on-screen source text.
 *
 * 30 fps. Change FPS here and every timing below rescales with it.
 * Frame = second * FPS.
 */

export const FPS = 30;
/**
 * 86.36s of voiceover + a short tail. Every timing below was read off a
 * faster-whisper transcript of the actual ElevenLabs render, not estimated,
 * so overlays land on the word rather than near it.
 */
export const DURATION_IN_FRAMES = 1965; // 65.5s

const s = (seconds: number) => Math.round(seconds * FPS);

export type Beat = {
  id: string;
  from: number;
  durationInFrames: number;
  /** What you say over this beat. Not rendered — it's here so the file stays the script. */
  vo: string;
  /** What you should be showing on screen while recording. */
  screen: string;
};

export const BEATS: Record<string, Beat> = {
  hook: {
    id: "hook",
    from: s(0.0),
    durationInFrames: s(6.04),
    vo: "Every complaint system routes tickets. None answer the question that matters — what should we build first?",
    screen: "Dashboard, ranked map, statewide view",
  },
  intake: {
    id: "intake",
    from: s(6.04),
    durationInFrames: s(13.88),
    vo: "A citizen reports by voice or text in their own language, so literacy isn't a barrier. Whisper transcribes it, and every photo is checked before it counts: perceptual hashing catches reused images, EXIF flags edits, and a VLLM model reads the actual damage. A faked photo shouldn't move public money.",
    screen: "report.html — speak a Hindi complaint, live camera photo, submit, receipt shows extracted fields",
  },
  cluster: {
    id: "cluster",
    from: s(19.92),
    durationInFrames: s(12.8),
    vo: "Fifty people reporting one broken culvert becomes one problem, not fifty tickets — DBSCAN clustering over multilingual sentence embeddings, gated by haversine distance. And it ranks twice: by category, and by village, down to the exact asset.",
    screen: "Clusters forming on map → click into village panel → click into asset panel",
  },
  terms: {
    id: "terms",
    from: s(32.72),
    durationInFrames: s(20.4),
    vo: "Every rank breaks into nine visible terms. [nine terms] They sum exactly to the score, so an official can audit why.",
    screen: "Click a score — the nine breakdown bars expand one at a time",
  },
  investment: {
    id: "investment",
    from: s(53.12),
    durationInFrames: s(5.36),
    vo: "We also check whether money is already sitting where people are complaining: funded but never delivered, or needed and never funded.",
    screen: "Click DEMAND vs INVESTMENT — show the mismatch buckets",
  },
  optimizer: {
    id: "optimizer",
    from: s(58.48),
    durationInFrames: s(4.6),
    vo: "Then give it a real budget, and an exact zero-one knapsack solves which projects actually fit.",
    screen: "Click BUDGET OPTIMIZER — enter a budget, projects get selected",
  },
  close: {
    id: "close",
    from: s(63.08),
    durationInFrames: s(2.2),
    vo: "Every number traceable to a government record.",
    screen: "Terminal with test suites passing",
  },
};

/** PANEL 1 — photo verification, shown during the intake beat. */
export const PHOTO_CHECKS = {
  header: "Photo verification",
  lines: [
    "Live camera capture only — GPS + time at shutter",
    "Perceptual-hash duplicate check across all stored photos",
    "EXIF editing-software detection",
    "Moiré + 5-frame burst = screen-replay detection",
    "YOLOv8 crack/pothole model — 81.8% accuracy, 88 held-out photos",
  ],
  footnote: "No check ever rejects a complaint. It flags for officer review.",
};

/**
 * PANEL 2 — the nine terms. Each appears as its bar animates in on screen.
 * `points` is the term's real ceiling in the 100-point formula.
 */
export type Term = {
  name: string;
  /** Absolute second this term is spoken, measured from the VO transcript. */
  at: number;
  source: string;
  points?: string;
};

export const TERMS: Term[] = [
  { name: "Demand",
    at: 34.72, source: "Unique citizen accounts (capped at 25)" },
  { name: "Population",
    at: 37.64, source: "Census 2011 — District Census Handbook" },
  {
    name: "Infra-deficit",
    at: 39.32,
    source:
      "Census 2011 amenities · PMGSY works · JJM tap coverage · UDISE+ 2024-25 · IPHS norms · RTE Act 2009",
  },
  {
    name: "Vulnerability",
    at: 41.68,
    source: "Census 2011 — power hours, drainage, internet (area-level only, never caste data)",
  },
  {
    name: "Equity",
    at: 43.56,
    source: "BharatNet / BBNL 2022 — gram panchayat fibre status",
    points: "+10",
  },
  {
    name: "Strategic",
    at: 46.44,
    source: "PMGSY population floor · IPHS sub-centre norm · RTE middle-school duty · JJM threshold",
    points: "+4",
  },
  {
    name: "Urgency",
    at: 47.2,
    source: "Vision damage model + citizen wording + SACHET NDMA (live) + CWC river levels (live)",
    points: "+15",
  },
  {
    name: "Feasibility",
    at: 48.0,
    source: "Census 2011 distance-to-town + all-weather road share",
    points: "+2",
  },
  {
    name: "Cost",
    at: 48.8,
    source: "Population-scaled — no per-project cost data available",
    points: "−3",
  },
];

/** PANEL 3 — investment cross-check. */
export const INVESTMENT = {
  header: "Cross-checked against real government spending",
  rows: [
    {
      label: "Roads",
      text: "PMGSY sanctioned works — 552 records, with sanction year, cost and execution status",
    },
    {
      label: "Schools",
      text: "UDISE+ 2024-25 — grant received vs grant actually spent, per school, this financial year",
    },
    {
      label: "Water",
      text: "Jal Jeevan Mission — 2,183 village schemes, cost + status",
    },
  ],
  footnote:
    "Also on file, evidence only, never moves a score: MGNREGA expenditure · PRIASoft 15th Finance Commission · JJM water-quality testing · eGramSwaraj GPDP · NDEM flood extents 2013 & 2021",
};

/** PANEL 4 — closing numbers. */
export const CLOSING_STATS = [
  { value: "1,042", label: "villages" },
  { value: "10,464", label: "named facilities" },
  { value: "8,063", label: "road segments" },
  { value: "118", label: "clusters" },
  { value: "819", label: "ranked assets" },
  { value: "476", label: "tests passing" },
];

export const HONESTY = {
  header: "Deliberately left empty rather than estimated",
  lines: [
    "MOSDAC rainfall — 0 rows (ISRO login required)",
    "GPDP village budget plans — 0 rows (CAPTCHA-protected)",
  ],
};

/** Persistent corner label. Visible on every beat that shows ranked output. */
export const SYNTHETIC_NOTE = "1,000 of 2,116 reports are synthetic demo data";
