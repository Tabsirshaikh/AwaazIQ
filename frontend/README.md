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

## Deep links

The current view is addressable, so a specific place can be shared:

| URL | Opens at |
|---|---|
| `?at=state` | Maharashtra |
| `?at=district:Kolhapur` | Kolhapur district |
| `?at=cluster:12` | Cluster 12, zoomed in |

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

## Two things worth knowing before changing this

**1. Do not set `stroke-width` or `font-size` in CSS for map elements.**
The whole map lives in one scaled `<g>`, so those values are divided by the
live zoom factor in JS to hold a constant on-screen size. A CSS declaration
beats the SVG presentation attribute and silently defeats that — borders
disappear when zoomed out, labels become enormous when zoomed in.

**2. Set `view` to the target transform *before* drawing.**
Bubble radii and stroke widths are computed from `view.k`. Drawing first and
animating after sizes everything against the zoom level you are *leaving*,
which renders district view as a field of giant overlapping blobs.

## Honest scope

Only Kolhapur and Nashik carry citizen data — 2 of 726 districts. The India
view says so rather than implying national coverage, and districts without
data are rendered inactive and are not clickable.

## Not built yet

The ranked cluster list, the nine-term score breakdown panel, the
cluster A-vs-B comparison, and the what-if budget slider. Every API they
need is already live.
