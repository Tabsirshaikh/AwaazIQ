# ComplainBox — P1 + P2 Progress

Status against `Build-Plan-4-Person-Team.pdf`, covering **P1 (AI/NLP Intake Pipeline)** and
**P2 (Data & Backend Infrastructure)** only — P3 (Intelligence Engine) and P4 (Frontend/Demo)
are out of this scope and untouched (`intelligence/` and `frontend/` don't exist yet).

Legend: ✅ done and verified &nbsp; ⚠️ partial / blocked on something outside this scope &nbsp; ❌ not started

## Current state at a glance

| | |
|---|---|
| Database | SQLite at `backend/hackathon.db` (WAL mode) |
| `gazetteer` | **1,031** real villages/towns — 747 Kolhapur, 284 Nashik (OpenStreetMap) |
| ↳ with real Census population | **948** (91%) |
| `citizen_request` | **1,013** — 1,000 synthetic + 13 real test submissions |
| `citizen_request_raw` | 12 (un-redacted originals, PII-bearing) |
| `demand_cluster` / `priority_score` | 0 / 0 — P3 hasn't started, endpoints return empty cleanly |
| Test coverage | 40/40 pipeline · 8/8 endpoint · 5 module suites all green |

## How to run

```bash
# 1. Backend API (from repo root)
cd backend
.venv\Scripts\activate
uvicorn main:app --reload --port 8000

# 2. Internal dev console — open in a browser
frontend-test/index.html
```

Data-loading scripts (already run; re-run only to rebuild the database):

```bash
cd backend
python create_tables.py           # create the 5 tables
python load_gazetteer.py          # 1,031 villages from OpenStreetMap
python load_demographic_data.py   # real Census 2011 population onto those villages
python seed_synthetic_data.py     # 1,000 synthetic citizen reports
```

Tests:

```bash
# from the repo root — 40 end-to-end cases against the real gazetteer
python -m pipeline.test_pipeline

# from pipeline/ — individual module suites
cd pipeline
python test_language_detector.py    # 14 cases
python test_text_normalizer.py      # 8 cases
python test_extract.py
python test_location.py
python test_geocode.py
python test_speech_to_text.py       # prints instructions if sample_audio/ is empty

# from backend/ — needs the server running
cd ../backend
python test_citizen_report_endpoint.py   # 8 checks
```

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Health check → `{"status": "ok"}` |
| POST | `/citizen-report` | Ingest a report — JSON `{"text": "..."}` **or** multipart audio upload |
| GET | `/clusters` | All clusters, sorted by priority score desc |
| GET | `/clusters/{id}` | One cluster + parsed score breakdown (404 if missing) |
| GET | `/map-data` | GeoJSON FeatureCollection of all located reports |
| GET | `/citizen-reports` | Paginated report list (`?limit=`, `?offset=`) |
| POST | `/what-if` | **Stub** — echoes payload, returns unchanged ranking, `"stub": true` |
| POST | `/test/detect-language` | Dev console — language detection |
| POST | `/test/transcribe` | Dev console — audio upload → transcription |

## P1 — AI/NLP Intake Pipeline

| Step | Plan asks for | Status | Notes |
|---|---|---|---|
| 0. Environment | `faster-whisper`, `sentence-transformers`, `spacy`, `regex`, `geopy`, `fastapi` | ⚠️ | `faster-whisper`/`fastapi` installed and used. `sentence-transformers`/`spacy`/`geopy` intentionally not installed — nothing needs them until P3's embeddings/clustering work starts. |
| 1. Language ID | `detect_language() -> hi / en / <3rd lang> / mixed`, tested on 10 sentences | ✅ | `pipeline/language_detector.py`. Returns `hi` / `en` / **`mr`** / `mixed` — Marathi fulfills "third language matching the district's majority language" for Kolhapur/Nashik. 14/14 tests pass. |
| 2. Speech-to-text | Wire `faster-whisper`, confirm on real recorded clips | ⚠️ **still blocked** | `pipeline/speech_to_text.py` — VAD filtering, no-repeat-loop guard, domain-vocabulary prompt. Verified with a synthetic tone file (proves the code path doesn't crash). **Nobody has recorded real voice through this yet** — needs a human with a microphone. |
| 3. Text normalization | Strip fillers, normalize transliteration variants | ✅ | `pipeline/text_normalizer.py` — 12 fillers (English + Hindi + Devanagari), 12 transliteration mappings, punctuation collapsing. 8/8 tests pass. |
| 4. Issue + severity extraction | Keyword dictionaries per category, per language | ✅ | `pipeline/extract.py` — 6 categories, 51 issue keywords, 15 severity keywords. Word-boundary matching (Devanagari-safe), generic English plural handling. |
| 5. Location extraction | Trigger-word list + window extraction | ✅ | `pipeline/location.py` — 24 triggers across English/Hindi/Marathi, handles attached punctuation. |
| 6. Geocoding | Fuzzy-match against gazetteer via `rapidfuzz` | ✅ | `pipeline/geocode.py` — matches against the real 1,031-row gazetteer. |
| 7. Assemble & test | `process_report()`, 20 test cases (3 languages, code-mixed, 3 ambiguous locations) | ✅ | `pipeline/test_pipeline.py` has **40** cases spanning Hindi/English/Marathi, code-mixed input, and 3 deliberately unresolvable locations. Runs against the real gazetteer, not an empty stub. |
| 8. Hand off to P2 | Importable by P2, passing 20 test cases | ✅ | `process_report()` is live-wired into `POST /citizen-report`, verified end-to-end. |
| 9. Hardening | +20 more test cases, tune dictionaries, confidence-decay rule | ✅ | Confidence-decay in `pipeline/main.py`: when more than one extraction step reports low confidence, a multiplicative penalty applies on top of the plain average. All tuning knobs are module-level named constants, per the plan's "visible and changeable, never hardcoded silently inside a function" rule. Expanding the suite surfaced and fixed 4 real keyword gaps (`garbage`, `power`, plural `pothole`/`potholes`, an inflected Marathi form of "school"). |

**P1 deliverable**: met, with one exception — real recorded voice input is still outstanding.

## P2 — Data & Backend Infrastructure

| Step | Plan asks for | Status | Notes |
|---|---|---|---|
| 0. Environment | Postgres 15 + PostGIS + pgvector | ⚠️ **deliberate deviation** | Moved to SQLite (PostGIS wasn't installable in reasonable time here). Plain `latitude`/`longitude` floats instead of `GEOMETRY`. Postgres fully removed from the project. WAL mode enabled so external tools (DB Browser for SQLite) can read live while the API writes. |
| 1. Schema | `citizen_request`, `gazetteer`, `demand_cluster`, `priority_score` | ✅ (+1 extra) | All four in `backend/models.py`, SQLite-adapted. Plus `citizen_request_raw` per Step 5's own requirement. |
| 2. Load gazetteer | Village/ward/block names + lat/lon for the 2 districts | ✅ | `backend/load_gazetteer.py` — 1,031 real villages/towns from OpenStreetMap via Overpass API. Re-runnable without duplicating rows. |
| 3. Load demographic + infrastructure data | Census population + PMGSY road data, joined to gazetteer | ✅ (population) / ❌ (PMGSY, explicitly skipped) | `backend/load_demographic_data.py` — **run for real**: Census 2011 village population matched onto **937 of 1,031** rows (91%). PMGSY skipped per the plan's own risk table ("Census over PMGSY if PMGSY's format is messy — partial real data beats a blocked pipeline"). |
| 4. Ingestion API | `POST /citizen-report`, calls `process_report()`, inserts, returns record with `id` | ✅ | `backend/routes_citizen_report.py`. Handles JSON text and multipart audio. Verified live end-to-end. |
| 5. PII redaction | Strip phone numbers + name-prefixes, keep original in `citizen_request_raw` | ✅ | Same file. Regex pass (10-digit Indian mobile, `Mr./Mrs./Shri/...` + capitalized word). 8/8 automated checks pass. |
| 6. Read API for P4 | `GET /clusters`, `GET /clusters/{id}`, `GET /map-data` | ✅ (+1 extra) | `backend/routes_dashboard.py`. Also `GET /citizen-reports` (paginated). Tested against both empty and populated tables. |
| 7. What-if endpoint | `POST /what-if`, stub now, wire to P3 later | ✅ (as a stub, exactly as instructed) | Returns the current unmodified ranking + echoed payload + `"stub": true`, so P4 can build against the real response shape. Swap in P3's `recompute_with_budget()` once it exists. |
| 8. Synthetic seed data | 800–1,500 synthetic rows, realistic geographic distribution based on real population | ✅ | `backend/seed_synthetic_data.py` — **1,000 rows**, `is_synthetic=true`. Village selection weighted by real Census population, not uniform random. Each row's text runs through the *real* `process_report()` pipeline rather than hand-assigned fields, so category/language/location are genuinely derived. 99.8% resolved to a real village, 0 uncategorized. |
| 9. Deploy | Containerize, deploy to Railway/Render, reachable externally | ⚠️ **containerized, not deployed** | `backend/Dockerfile`, `.dockerignore`, root `docker-compose.yml` written — **not verified**, Docker isn't installed here. These only package the existing SQLite app for hosting; they do **not** change the database. Deployment needs a Railway/Render account login. See `backend/DEPLOY.md` for steps and a warning about SQLite on ephemeral free-tier storage. |

**P2 deliverable**: met except deployment. Real data loaded, ingestion works end-to-end, 1,000 synthetic reports seeded — but the API only runs locally.

## Workflow hardening pass

A dedicated optimization pass over the existing code — no new features, no schema or dependency changes. Verified by capturing baseline outputs across **1,021 real texts** from the database before refactoring, then confirming **0 behavioral differences** afterward.

**Two real bugs fixed**

- `POST /citizen-report` returned **500 Internal Server Error** on a malformed JSON body, an empty body, or a JSON scalar — `await request.json()` threw straight out of the handler. All now return proper **400s** with useful messages. Also guarded the multipart path, where a non-file form field named `file` would have hit `.filename` on a string and 500'd.
- The gazetteer was **reloaded from the database on every single ingestion request** (~1,000 rows per request). Now cached across requests, invalidated by row count — one cheap `COUNT(*)` instead of a full table load. Caveat documented inline: in-place edits that don't change row count won't invalidate (safe today, since geocoding never reads `population`).

**Performance** — regexes were being rebuilt per call. `normalize_text` compiled and ran a separate pattern per filler/variant (24 passes over every string); `extract.py` did ~55 individual searches per report. Both now build one compiled alternation pattern at import:

| function (×2000 calls) | before | after |
|---|---|---|
| `normalize_text` | 0.291s | **0.021s** (14×) |
| `extract_severity` | 0.142s | **0.006s** (24×) |
| `extract_issue_category` | 0.093s | **0.039s** (2.4×) |

**One accuracy improvement** — `extract_issue_category` returned the *first* category with any keyword hit, in plain dict order. So `"sadak ke paas hospital hai lekin doctor nahi, clinic bhi band hai"` returned **road** (one hit) purely because road is declared before health (three hits). It now picks the category with the most hits, with declaration order still breaking ties — so genuinely ambiguous reports behave exactly as before. That case now correctly returns **health**.

## Interface Contract deviations (read before P3/P4 integrate)

- **`location_resolved` keys**: doc shows `"lat"` / `"lon"`; implementation uses **`"latitude"` / `"longitude"`** (matches `citizen_request`'s own column names).
- **`language_detected` values**: doc shows `"hi-Deva"`-style codes; implementation returns **`"hi"` / `"en"` / `"mr"` / `"mixed"`**.

## What's left that genuinely needs a human

1. **Record real voice clips and run them through `speech_to_text.py`** (P1 Step 2). Only a synthetic tone has been tested — someone needs to actually speak into a mic and confirm the transcription is usable.
2. **Deploy to Railway or Render** (P2 Step 9). Config is ready but needs someone's account, plus a `docker build` to confirm it works — not verifiable from here.
3. **PMGSY road data** — explicitly skipped per the plan's own guidance; pick up later if there's time.

Everything else in P1 and P2's checklists is done and verified against the real database.
