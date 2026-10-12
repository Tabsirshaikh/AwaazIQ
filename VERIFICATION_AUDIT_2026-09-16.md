# AwaazIQ — Independent Verification Audit (2026-09-16)

This is a from-scratch verification pass: every claim below was checked against the
**actual running database, actual test output, or actual source code** — not copied
from `README.md`, `features.md`, or `PROJECT_COMPLETE_AUDIT.md`. Where this doc
disagrees with those, this one is the one that was just re-derived from ground truth.

Method: live SQLite queries against `backend/hackathon.db`, running all 5 test suites
directly, and five independent code-reading passes (P1 pipeline, P3 intelligence
engine, backend API + data loaders, Workstream C photo checks, frontend) each
checking specific documented claims line-by-line against the real files.

## 🔴 High severity — read this first

**`load_nwdp_groundwater.py` fabricates readings for stations with no real telemetry,
indistinguishable from genuine data.** When a station has no non-zero reading, the
loader writes a hardcoded `-5.0` for both `current_level_m` and `previous_level_m`,
`trend = "stable"`, and a live timestamp (`load_nwdp_groundwater.py:218-223`) —
instead of storing NULL or skipping the station. This directly contradicts the
file's own docstring claim of "REAL, CURRENT groundwater telemetry." Every
uncalibrated station in the table currently carries the identical fake -5.0m value,
and nothing downstream can tell it apart from a real reading. Only 9 rows in
`nwdp_groundwater` today, but the mechanism is a real integrity gap, not a one-off.
**Action needed**: either store NULL for these stations or add a `is_estimated` flag
so `intelligence/` and the frontend can distinguish real telemetry from filler.

## Ground truth: database row counts

All queried live against `backend/hackathon.db`. Everything matches the documented
numbers exactly except where noted.

| Table | Claimed | Actual | Status |
|---|---|---|---|
| `gazetteer` | 1,042 | 1,042 | ✅ |
| `public_facility` (schools+health) | 10,464 | 10,464 | ✅ |
| `school_condition` | 9,352 | 9,352 | ✅ |
| `government_project` (PMGSY works) | 552 | 552 | ✅ — this is a *different* table from `pmgsy_road_segment` (8,063 rows, line geometry from a separate loader); not a discrepancy, just two tables for two loaders |
| `demand_cluster` | 118 | 118 | ✅ |
| `asset` | 819 | 819 | ✅ |
| `village_priority` | 443 | 443 | ✅ |
| `jjm_village_scheme` | 2,183 | 2,183 | ✅ |
| `village_mgnrega_expenditure` | 119 | 119 | ✅ |
| `citizen_request` (is_synthetic=1) | 1,000 | 1,000 | ✅ |
| `village_budget_plan` (GPDP, CAPTCHA-blocked) | 0 | 0 | ✅ confirms the "not run" claim |
| `mosdac_rainfall` (blocked, no account) | 0 | 0 | ✅ confirms the "not run" claim |
| `citizen_request` total | 2,031 (README) | 2,116 | ⚠️ stale doc + see note below |

**Note on the 2,116 figure:** the README's 2,031 was already stale before I touched
anything (organic growth from 2,031 → 2,099 between README's last edit and this
audit). It grew further to 2,116 because two of the backend test suites I ran for
this audit write to the live DB, and my backup command failed silently (a `cd
backend` run from inside `backend/` errored, so the intended `cp` before running
tests never executed) — I caught this only after the fact. Net effect: ~17 extra
test-created rows and a few test citizen accounts. Additive only, no deletions, the
file is git-ignored and fully rebuildable from the loader scripts. Per your
instruction, left as-is.

## Ground truth: test suites (run directly, not copied from docs)

| Suite | Claimed | Actual |
|---|---|---|
| `intelligence.test_intelligence` | 291/291 | **291/291** ✅ |
| `pipeline/test_pipeline.py` | 46/46 | **46/46** ✅ |
| `backend/test_photo_checks.py` | 65/65 | **65/65** ✅ |
| `backend/test_assign_synthetic_assets.py` | 4 checks | **4/4** ✅ |
| `backend/test_citizen_report_endpoint.py` | 66/66 | **70/70** ⚠️ doc is stale — grew, almost certainly from the recent `/citizen/my-reports` fix (commit `298a1d9`) adding its own test block |

## P1 — NLP intake pipeline (`pipeline/`)

| Claim | Verdict | Evidence |
|---|---|---|
| Language codes `hi-Deva`/`mr-Deva`/`hi-Latn`/`mixed`/`en`, 8 other Indic scripts flagged `supported:false` at 0.15 confidence | ✅ Confirmed | `lang_id.py:33` (`SUPPORTED_LANGUAGES`), `lang_id.py:21-30` (8 scripts), `main.py:35-36` (`if not is_supported(language): return 0.15`) |
| `test_lang_id.py` — "42 test cases" | ⚠️ Overstated | 42 real `check()` calls exist and the process does exit(1) on failure, but it's a standalone script (no `assert`, not pytest-discoverable) — "test cases" implies more formal test infra than exists |
| ASR: restricted hi/mr/en detection, `vad_filter=True`, `condition_on_previous_text=False`, `task="transcribe"`, per-language `initial_prompt` | ✅ Confirmed | `asr.py:110,151-156` |
| `extract.py`: exactly 4 categories, most-keyword-hits wins (not first match) | ✅ Confirmed | `extract.py:5-68` (categories), `:117-119` (`if hits > best_hits`) |
| `location.py`: every trigger window scored, best one with a real place-token wins | ✅ Confirmed | `location.py:136-146` |
| "Location resolution went from 82.6% → 99%" | ❓ Unverifiable | No benchmark script or measurement artifact found anywhere in `pipeline/` to substantiate this specific figure — the code change itself is real, the number is unsubstantiated |
| `geocode.py` uses `rapidfuzz` | ✅ Confirmed | `geocode.py:1,47-51` |
| Confidence-decay rule, module-level tuning constants | ✅ Confirmed (loosely) | `main.py:66-68`; constants are inline literals inside function bodies, not top-level named constants — "module-level" is a loose characterization |

**Extra bugs found (not previously documented):**
- `asr.py:113-114` — if Whisper returns no per-language probabilities, silently defaults to Hindi at 0.0 confidence with no way for the caller to detect the fallback happened.
- `geocode.py:58-60` — a comment claims sub-threshold matches "return a low-confidence flag"; they actually just return `None`, identical to no-match-at-all. Callers can't distinguish "no candidate" from "weak candidate."
- `location.py:123` — a redundant/dead duplicate condition that happens to work only because Devanagari has no case, not by design.

## P3 — Priority-scoring engine (`intelligence/`)

| Claim | Verdict | Evidence |
|---|---|---|
| `priority_score = sum(breakdown values)`, gap-score weights all 0.25 | ✅ Confirmed | `scoring.py:412`, `config.py:69-72` |
| Breakdown sums *exactly* to `priority_score` | ✅ Confirmed by construction | `scoring.py:412` defines priority as the sum — not just tested, structurally guaranteed |
| `URGENCY_POINTS=15.0`, `GAP_SCORE_MAX_POINTS=69.0`, max total = 100 | ✅ Confirmed, but via shadowed constants — see below | |
| DBSCAN gate radius = 8km | ✅ Confirmed | `config.py:32`, `clustering.py:74` |
| Equity term: 10-block hardcoded list | ✅ Confirmed, with nuance | `config.py:143-154` lists exactly 10 blocks, **but** it's only used as a fallback — when real BharatNet data exists, `realdata.real_reporting_capacity_deficit` is used instead (`scoring.py:357-365`) |
| `cost_penalty` purely population-scaled, no real cost data | ✅ Confirmed | `scoring.py:224-233` |
| `infra_deficit`/`vulnerability` are "proxies" | ⚠️ Partially stale | Real Census/IPHS/RTE-derived replacements (`realdata.py:390-471`) now cover most cases; the described proxy is only a fallback when no government record exists nearby |
| `real_reporting_capacity_deficit` "still the flat BharatNet-fibre-only proxy" | ⚠️ Discrepancy | It **is** BharatNet-fibre-only (that part's right), but it's not "flat" — it computes a proportional share of impaired-status villages (`realdata.py:479-505`), not a binary pass/fail |
| Emergency signal fusion: collapse=15.0, partial=10.0, crack=5.0 urgency points | ✅ Confirmed | `emergency.py:272,275`, `config.py:124-126` |
| Catchment radius by category (health 8km → water 3km) | ✅ Confirmed | `config.py:57-63` |
| `school_condition_evidence()` is dead code, never called from `recompute.py` | ✅ Confirmed | Only caller anywhere is `test_intelligence.py` |

**Real bug found:** `config.py` defines `URGENCY_POINTS` and `GAP_SCORE_MAX_POINTS`
**twice each** (`config.py:107-108`, `120-121`) — old values (3.0, 81.0) followed by
the current ones (15.0, 69.0). Python silently keeps the second, so the effective
numbers are right, but the dead first assignment is a live landmine for the next
person editing that file, and `WEIGHTS.md` mirrors the same duplication. Also: a
genuinely dead statement in `scoring.py:375-380` (legacy urgency calculation
computed then immediately overwritten), a duplicate import in `recompute.py:44-45`,
and a hazard-lookup that's computed twice back-to-back in `recompute.py:612-621`
(wasteful, not incorrect). `APPLY_CATEGORY_IMPORTANCE = False` by default
(`config.py:289`) — worth knowing the "equal 0.25 weights" claim only holds with
this off.

## Backend API + data loaders

**Endpoints** — 15 of the 16 documented endpoints confirmed exactly. One is
fictional: **`POST /what-if` does not exist anywhere in the code** — only a
docstring mention. The real equivalent is the undocumented `GET /budget-optimizer`
(`routes_intelligence.py:120`). Also undocumented but real: `GET
/clusters/{id}/reports`, `GET /citizen-reports`, `GET /auth/me`, `POST
/auth/logout`, `GET /citizen/my-reports`, `GET /gazetteer/states`, two `/test/*`
endpoints.

**PII redaction** — phone and name-prefix stripping confirmed, runs synchronously
before commit. The claimed "8/8 checks pass" doesn't correspond to anything in the
code — the actual PII test section runs 22 checks folded into the ~70-check
aggregate. There's also a third, undocumented regex (`SELF_NAME_RE`) that handles
self-stated names in English and Devanagari.

**Data loaders (the credibility-critical part)** — spot-checked 10 loaders'
actual HTTP/data-source code, not just their docstrings. **9 of 10 are clean**,
making real requests against real government endpoints (pmgsy.dord.gov.in,
ejalshakti.gov.in, mnregaweb2.dord.gov.in, egramswaraj.gov.in,
ffs.india-water.gov.in, sachet.ndma.gov.in, plus GitHub-hosted mirrors for UDISE
and NDEM flood data) and storing values traced directly to the response. **The 10th
is the groundwater loader flagged above under High Severity.**

**Docker/deployment** — both recent fixes (create_tables before uvicorn,
intelligence/ copied into the image) confirmed present in the current Dockerfile.

**Not yet audited** (flagged by the agent, not checked in this pass):
`load_bharatnet.py`, `load_demographic_data.py`, `load_gazetteer.py`,
`load_health_facilities.py`, `load_jjm_water.py`, `load_lgd_hierarchy.py`,
`load_village_amenities.py`, `load_mosdac_rainfall.py`, `load_pmgsy_geosadak.py`,
`load_udise_school_data.py`, `load_jjm_village_schemes.py`. Given the groundwater
finding, a follow-up pass on these specifically for the same
fabricate-a-plausible-default pattern would be worth doing.

## Workstream C — photo verification

C1 (capture provenance, 5km threshold), C2 (distinct-account corroboration), C3
(perceptual-hash duplicate detection), C5 (YOLOv8 crack/pothole classes), C6
(VLM + wording damage grading, env-gated with a lower-weight fallback), and C7
(moiré spectrum + 5-frame burst check) are all **confirmed exactly as documented**.

Two real discrepancies:
- **"Never below half [confidence]" is a *relative* floor, not absolute 0.5.**
  `confidence_adjustment()` computes `max(confidence * 0.5, new)` — a report that
  started at 0.3 confidence can be damped to 0.15, not stopped at 0.5. There's also
  a second, separate, undocumented floor (`AUTHENTICITY_FLOOR = 0.2`) on a different
  metric (authenticity, not confidence).
- **Field names in the docs don't literally exist in code.** `evidence["photo_defect"]`
  and `evidence["emergency_damage"]` are the README/features.md's names; the actual
  code stores `result["defects"]` / `result["damage"]`, persisted as
  `PhotoCheck.pothole_confidence`/`crack_confidence` and
  `PhotoCheck.damage_grade`/`confidence`/`structure`. Functionally identical, wrong
  literal names.

**Confirmed clean:** no code path anywhere rejects or drops a report based on a
photo check — the report is committed to the DB *before* `check_report_photos()`
even runs (`routes_citizen_report.py:651,658`), which structurally guarantees this
rather than just relying on care in the check logic. Model accuracy numbers (88
held-out photos, 81.8%/74.4%/86.5%/F1 0.80/ROC-AUC 0.92) are real and traceable —
independently counted 88 entries in `eval_manifest.json` (37 positive + 51
negative), matching `evaluation.json` exactly.

## Frontend

| Claim | Verdict |
|---|---|
| "Exactly 3 frontend pages" | ⚠️ Discrepancy — there are **4**: `index.html`, `report.html`, `photo-lab.html`, and `signin.html` (a real, linked login/register page, not a stray file) |
| Camera: `getUserMedia` + Image Capture API, GPS/timestamp captured at shutter press | ✅ Confirmed |
| `?api=` query param overrides base URL | ✅ Confirmed, implemented identically in 4 separate files |
| Secure-context requirement | ✅ Confirmed as an explicit JS guard (`window.isSecureContext`), not just descriptive prose about browser behavior |
| "panels.js renders the 9-part score breakdown" | ⚠️ Wrong file — the full breakdown renderer (`renderBreakdown()`) lives in **`app.js`**; `panels.js` only shows 3 of the 9 terms, in the A-vs-B compare overlay |
| `auth.js` → `/auth/register`, `/auth/login` | ✅ Confirmed |
| `capture_meta`/`burst_<i>` field-name contract (frontend send vs. backend parse) | ✅ Confirmed matching end-to-end, including index alignment through `form_index` — no repeat of the earlier lat/lon-style silent mismatch |

## Bottom line

Out of everything checked — 5 test suites, ~20 database-row-count claims, and
roughly 45 individual documented code-behavior claims across pipeline, scoring
engine, API, photo checks, and frontend — **the overwhelming majority hold up
exactly as documented.** The real issues found:

1. One data loader (groundwater) fabricates plausible-looking readings instead of
   marking missing data as missing — the one finding here that's a genuine
   integrity concern, not just a stale doc.
2. One documented API endpoint (`POST /what-if`) doesn't exist; the real feature
   moved to `GET /budget-optimizer` without the docs being updated.
3. A handful of stale counts/names (page count, test count, field names, file
   attribution) that are all cosmetic — the underlying functionality is correct,
   the docs just drifted.
4. A few small dead-code/shadowed-constant issues (`config.py`'s duplicate
   `URGENCY_POINTS`/`GAP_SCORE_MAX_POINTS`, a couple of redundant computations)
   that don't affect current behavior but are confusion risks for future edits.

None of this changes the project's core claims about what it does — the priority
score really is computed the way `WEIGHTS.md` says, the photo checks really do run
and really never reject a report, and 9 of 10 audited data sources really are real
government data, not synthetic filler dressed up as real.

---
*Generated 2026-09-16 by re-deriving every number and behavior from the live
database, live test runs, and direct source reads — not by summarizing
`README.md`/`features.md`/`PROJECT_COMPLETE_AUDIT.md`.*
