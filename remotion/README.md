# AwaazIQ demo video (Remotion)

Overlays the source-citation panels onto your screen recording, timed to the
voiceover script. Everything that is text — beats, timings, sources, the nine
terms — lives in `src/script.ts`, so that one file is both the script and the
edit. Change a timing there and the video follows.

## Recording the screen capture

Record at **1920×1080**, and hit these marks. Timings are what the overlays
expect; if you drift, adjust the seconds in `src/script.ts` rather than
re-recording.

| Time | What to show | What you say |
|---|---|---|
| 0:00–0:06 | Dashboard, statewide ranked map | "Every complaint system routes tickets. None answer the question that matters — what should we build first?" |
| 0:06–0:16 | `report.html` — speak a Hindi complaint, live camera photo, submit, receipt | "A citizen reports by voice or text in their own language, so literacy isn't a barrier. Every photo is checked for edits and reuse — a faked photo shouldn't move public money." |
| 0:16–0:26 | Clusters forming → village panel → asset panel | "Fifty people reporting one broken culvert becomes one problem, not fifty tickets. And it ranks twice — by category, and by village, down to the exact asset." |
| 0:26–1:05 | Click a score, let the nine breakdown bars expand one at a time | "Every rank breaks into nine visible terms." then name each: Demand, Population, Infra-deficit, Vulnerability, Equity, Strategic, Urgency, Feasibility, Cost. Close with "They sum exactly to the score, so an official can audit why." |
| 1:05–1:15 | DEMAND vs INVESTMENT — mismatch buckets | "We also check whether money is already sitting where people are complaining — funded but never delivered, or needed and never funded." |
| 1:15–1:22 | BUDGET OPTIMIZER — enter a budget, projects selected | "Then give it a real budget, and it tells you exactly which projects fit." |
| 1:22–1:27 | Terminal, test suites passing | "Every number traceable to a government record." |

**Pace the nine terms to the bars.** Each term gets ~4.3s on screen. Name the
term first, then its explanation — the overlay shows the same name and its data
source at the same moment.

## Rendering

```bash
cd remotion
npm install

# put your files here:
#   public/demo.mp4    the screen recording
#   public/vo.mp3      the voiceover (optional)

npm start                      # opens Remotion Studio to preview and scrub
npm run render                 # writes out/awaaziq-demo.mp4
```

## Voiceover

Generate **one clip per beat**, not one long file. Each clip is placed at its
own beat's start, so a clip that runs long can't push everything after it out
of sync — the failure mode that makes a single-file VO painful to fix.

Save them as `public/vo/1-hook.mp3` … `7-close.mp3` and uncomment the `vo` map
in `src/Root.tsx`.

**If the generated audio is too slow** (TTS tends to over-pause):

1. Write each beat as **one continuous paragraph**. Line breaks become long
   pauses — the nine terms are the worst offender, so separate them with
   colons rather than newlines.
2. Raise the speed slider in ElevenLabs voice settings to ~1.1.
3. Close any remaining gap with `voSpeed` in `defaultProps` — browsers preserve
   pitch, so 1.0–1.4 still sounds human. Needing more than ~1.4 means the
   script is too long; cut words instead of speeding up further.

To bake a speed change into the file itself instead:

```bash
ffmpeg -i vo.mp3 -filter:a "atempo=1.25" vo-fast.mp3
```

**If a beat's audio genuinely needs more room**, widen that beat in
`src/script.ts` rather than rushing the read — every overlay follows the beat.

## Adjusting to your actual recording

Recording never lands exactly on the marks. Open `src/script.ts` and edit the
`s(...)` values in `BEATS` — every overlay is positioned off those, so fixing a
beat's start time moves its panel with it. The nine terms redistribute
automatically across whatever duration the `terms` beat has.

If a panel covers part of the UI you're demoing, change its `position` prop in
`AwaazIQVideo.tsx` (`bottom-left` / `bottom-right` / `top-right`).

## A note on what's claimed

The `SyntheticBadge` stays on screen for every beat that shows ranked output,
and the closing card names the two tables deliberately left at zero rows. Both
are deliberate: a jury's first question about a ranked list is whether the data
is real, and answering before they ask is worth more than the seconds it costs.
Don't remove them to save space.
