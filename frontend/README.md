# Frontend — AwaazIQ dashboard

Policymaker-facing dashboard. Step 1 of P4: the zoomable demand map.

## Run it

Two servers. The API first, from `backend/`:

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Then serve this folder over HTTP — **not** by double-clicking `index.html`,
because browsers block `fetch` on `file://` URLs and the map data will fail
to load:

```bash
cd frontend
python -m http.server 5500
```

Open <http://127.0.0.1:5500>.

If the API is on a different port, pass it: `?api=http://127.0.0.1:8010`.

## What's on screen

| Region | Does |
|---|---|
| **Rail** (left) | Ranked worklist, filtered by category, following whatever the map is showing. Tick two rows to compare them. |
| **Map** (centre) | The zoom ladder — India → Maharashtra → district → cluster |
| **Detail panel** (right) | Opens on a cluster: the nine terms with their sources, a sum line proving they add to the score, and "why not the runner-up" |
| **What-if sheet** (bottom) | Adds budget to a district and re-scores; the rail shows deltas and reorders |
| **Compare** (overlay) | Two clusters side by side, term by term, with a verdict generated from their actual numbers |
| **Intake** (overlay) | A citizen files a complaint in any language, watches the six pipeline stages resolve it, then runs clustering and is taken to the cluster their report joined |

## The citizen loop

`+ REPORT AN ISSUE` closes the circle the rest of the dashboard only reads
from. A complaint is typed (or spoken, as an audio upload), `POST
/citizen-report` runs the real pipeline on it, and the result screen shows
each stage's actual output — language, category, severity, the location
phrase, the village it geocoded to, and the text as stored after redaction.

"Run clustering" then calls `POST /recompute-scores` and redirects to
`?at=cluster:N&mine=<id>`, so the citizen lands on the cluster their report
was folded into, with their own row badged **yours**.

A lone report often stays unclustered, and the screen says so rather than
inventing a cluster: DBSCAN needs corroboration before one voice becomes a
demand signal. File a second complaint about the same problem nearby and it
clusters.

**What the cluster panel deliberately cannot show is who reported.** There is
no citizen identity column in the schema; phone numbers and self-stated names
are redacted before the text is stored (`redact_pii`), while the untouched
original is kept in `citizen_request_raw`. The panel states this outright, so
a viewer reads it as a design property rather than as missing data.

## Deep links

Every view is addressable, so a specific finding can be sent to someone
rather than described to them:

| URL | Opens |
|---|---|
| `?at=state` | Maharashtra |
| `?at=district:Kolhapur` | Kolhapur district |
| `?at=cluster:12` | Cluster 12, zoomed in, panel open |
| `?compare=18,1` | Ajra vs Shirol, side by side |
| `?whatif=Kolhapur:120` | ₹120 crore to Kolhapur, simulated |
| `?report=1` | Citizen intake, ready for a complaint |
| `?at=cluster:92&mine=2014` | A cluster with one report flagged "yours" |

`?compare=18,1` is the one worth bookmarking for a demo: Ajra wins on 7
reports against Shirol's 18, and the verdict line explaining why is generated
from the live scores, not written into the page.

## The zoom ladder

| Level | Shows | Source |
|---|---|---|
| India | 36 states, Maharashtra active | `data/india.topo.json` |
| Maharashtra | 35 districts, those with data highlighted | same file, filtered by `st_nm` |
| District | Demand clusters + individual reports | `/clusters`, `/map-data?layer=reports` |
| Cluster | One cluster isolated, siblings faded | `/clusters` |

## Map data

`data/india.topo.json` — 866 KB TopoJSON, 36 states + 726 districts, Census
2011 boundaries, from [udit-001/india-maps-data](https://github.com/udit-001/india-maps-data).

Its `dt_code` values are the same district codes our Census loaders already
use (Kolhapur `530`, Nashik `516`), so map and database join without a
translation table.

## Three things worth knowing before changing this

**1. Do not set `stroke-width` or `font-size` in CSS for map elements.**
The whole map lives in one scaled `<g>`, so those values are divided by the
live zoom factor in JS to hold a constant on-screen size. A CSS declaration
beats the SVG presentation attribute and silently defeats that — borders
disappear when zoomed out, labels become enormous when zoomed in.

**2. Set `view` to the target transform *before* drawing.**
Bubble radii and stroke widths are computed from `view.k`. Drawing first and
animating after sizes everything against the zoom level you are *leaving*,
which renders district view as a field of giant overlapping blobs.

**3. Match the CSS selector to the class the JS actually emits.**
`loadClusterReports` writes `class="rep rep--new"`; the stylesheet had
`.rep__new`, an element where a modifier was meant. It matched nothing, and
the failure was invisible — the citizen's own report simply came back looking
like every other row. Same failure mode as (1): a selector that silently
matches nothing looks identical to a feature that was never wired up.

## Honest scope

Only Kolhapur and Nashik carry citizen data — 2 of 726 districts. The India
view says so rather than implying national coverage, and districts without
data are rendered inactive and are not clickable.

## File layout

| File | Owns |
|---|---|
| `js/app.js` | Map, projection, navigation, the cluster detail panel |
| `js/panels.js` | Rail, comparison, what-if — talks to the map only through `window.AwaazIQ` |

`app.js` exposes a deliberately small surface (`navigate`, `onNavigate`,
`getClusters`, `TERMS`, `rankOf`, …). `panels.js` never reaches into the
map's internals. Subscribe with `onNavigate` rather than wrapping
`navigate` — the map triggers navigations itself (clicking a bubble, the
breadcrumb, Back), and a wrapper only sees the ones you call.

## What-if, and why the numbers cap

The slider speaks crore because that is the unit a budget officer uses; the
API takes rupees, so the value is multiplied by 1e7 on the way out.

Deltas cap at **+12.00** by design. Extra budget adds 0.4 points per crore up
to a ceiling of 12, so ₹120 crore and ₹500 crore both land on +12. Without
that cap a large enough number would swamp every other term and the ranking
would become "whoever got the most money" — the opposite of the point.
Clusters are re-scored but never re-clustered: what is broken does not change
because money moved, only what is fundable does.

## Not built yet

Nothing on the P4 list. Remaining work is elsewhere: real voice testing,
deployment, the LGD loader, and finishing the JJM crawl.
