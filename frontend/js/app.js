/* ===========================================================================
   AwaazIQ dashboard — zoomable demand map
   India → Maharashtra → district → cluster, with citizen demand rendered at
   every level.

   Zoom technique: the projection is fitted to India ONCE and never changes.
   Navigating between levels animates a transform on a single <g>, computed
   from the target feature's projected bounding box. Re-projecting every frame
   would be far more expensive and visibly janky at 726 districts; this is the
   standard "zoom to bounding box" approach and it stays smooth because the
   browser is only interpolating one matrix.

   Because everything scales together, stroke widths and bubble radii are
   divided by the live zoom factor so they keep a constant on-screen size --
   without that, districts get hairline borders and cluster bubbles balloon.
   =========================================================================== */

(() => {
  "use strict";

  // The API port is configurable so the dashboard works whether the backend
  // was started on the README's 8000 or anything else: ?api=http://host:port
  const params = new URLSearchParams(location.search);
  const API = (params.get("api") || "http://127.0.0.1:8000").replace(/\/$/, "");

  const PILOT_STATE = "Maharashtra";
  const TOPO_URL = "data/india.topo.json";

  const svg = d3.select("#map");
  const stage = document.getElementById("stage");
  const tooltip = d3.select("#tooltip");

  let width = 0;
  let height = 0;

  // Layers, painted back to front.
  const root = svg.append("g").attr("id", "viewport");
  const gStates = root.append("g");
  const gDistricts = root.append("g");
  const gOutline = root.append("g");
  const gReports = root.append("g");
  const gClusters = root.append("g");
  const gLabels = root.append("g");

  const projection = d3.geoMercator();
  const path = d3.geoPath(projection);

  let india, statesFC, districtsFC;
  let clusters = [];
  let reports = null;           // lazily fetched -- 1,000+ points

  let radiusScale, colourScale;

  // Current view: {k, x, y} applied to #viewport.
  let view = { k: 1, x: 0, y: 0 };

  const nav = { level: "india", state: null, district: null, cluster: null };

  /* ------------------------------------------------------------- helpers -- */

  const fmt = d3.format(",");

  function scoreColour(score) {
    if (score == null) return "#d8d3c4";
    return colourScale(score);
  }

  /** Bounding box of a feature in projected pixels, padded. */
  function fitTransform(feature, padding = 0.82) {
    const [[x0, y0], [x1, y1]] = path.bounds(feature);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const k = Math.min(width / dx, height / dy) * padding;
    return {
      k,
      x: width / 2 - k * (x0 + x1) / 2,
      y: height / 2 - k * (y0 + y1) / 2,
    };
  }

  /** Transform for a point (used when diving into a single cluster).
   *  `rightInset` is the width of any panel covering the right edge, so the
   *  point is centred in what the user can actually see. */
  function pointTransform(lon, lat, k, rightInset = 0) {
    const [px, py] = projection([lon, lat]);
    return {
      k,
      x: (width - rightInset) / 2 - k * px,
      y: height / 2 - k * py,
    };
  }

  const PANEL_W = 392;

  /**
   * Animate #viewport to a target transform.
   *
   * `view` must already be set to `target` by the caller BEFORE it draws, so
   * that radii and stroke widths are computed against the zoom level we are
   * arriving at rather than the one we are leaving. Setting it here instead
   * made every bubble size itself from the previous level's scale, which is
   * what turned district view into a field of giant white blobs.
   */
  function animateTo(target, duration = 900) {
    root
      .transition()
      .duration(duration)
      .ease(d3.easeCubicInOut)
      .attr("transform", `translate(${target.x},${target.y}) scale(${target.k})`)
      .on("end", applyZoomCompensation);
    // Compensate continuously so lines don't visibly thicken mid-flight.
    d3.transition()
      .duration(duration)
      .ease(d3.easeCubicInOut)
      .tween("compensate", () => {
        const kFrom = currentK();
        const i = d3.interpolateNumber(kFrom, target.k);
        return (t) => applyZoomCompensation(i(t));
      });
  }

  function currentK() {
    const t = root.attr("transform");
    const m = t && t.match(/scale\(([\d.]+)\)/);
    return m ? parseFloat(m[1]) : 1;
  }

  /** Keep strokes and bubbles a constant on-screen size as we zoom. */
  function applyZoomCompensation(k) {
    const z = k || view.k;
    gStates.selectAll("path").attr("stroke-width", 0.7 / z);
    gDistricts.selectAll("path").attr("stroke-width", 0.6 / z);
    gOutline.selectAll("path").attr("stroke-width", 1.4 / z);
    gClusters.selectAll("circle")
      .attr("r", (d) => radiusScale(d.population_affected || 0) / z)
      .attr("stroke-width", 1.3 / z);
    gReports.selectAll("circle").attr("r", 1.9 / z);
    gLabels.selectAll("text").attr("font-size", `${11 / z}px`)
      .attr("stroke-width", 3 / z);
  }

  /* ------------------------------------------------------------- tooltip -- */

  function showTip(event, html) {
    tooltip.html(html).classed("tooltip--on", true);
    moveTip(event);
  }
  function moveTip(event) {
    const pad = 16;
    const box = tooltip.node().getBoundingClientRect();
    const rect = stage.getBoundingClientRect();
    let x = event.clientX - rect.left + pad;
    let y = event.clientY - rect.top + pad;
    if (x + box.width > rect.width) x = event.clientX - rect.left - box.width - pad;
    if (y + box.height > rect.height) y = event.clientY - rect.top - box.height - pad;
    tooltip.style("left", `${x}px`).style("top", `${y}px`);
  }
  function hideTip() { tooltip.classed("tooltip--on", false); }

  /* ------------------------------------------------------------ chrome ---- */

  function renderBreadcrumb() {
    const crumbs = [{ label: "India", level: "india" }];
    if (nav.state) crumbs.push({ label: nav.state, level: "state" });
    if (nav.district) crumbs.push({ label: nav.district, level: "district" });
    if (nav.cluster) {
      crumbs.push({ label: `Cluster ${nav.cluster.id} · ${nav.cluster.block || ""}`.trim(), level: "cluster" });
    }

    const el = d3.select("#breadcrumb");
    el.selectAll("*").remove();
    crumbs.forEach((c, i) => {
      if (i) el.append("span").attr("class", "crumb__sep").text("›");
      el.append("button")
        .attr("class", `crumb${i === crumbs.length - 1 ? " crumb--current" : ""}`)
        .text(c.label)
        .on("click", () => { if (i < crumbs.length - 1) navigate(c.level); });
    });
    if (crumbs.length > 1) {
      el.append("button")
        .attr("class", "back-btn")
        .text("← BACK")
        .on("click", () => navigate(crumbs[crumbs.length - 2].level));
    }
  }

  function renderStatus() {
    const scope = visibleClusters();
    const totalPop = d3.sum(scope, (c) => c.population_affected || 0);
    const top = scope.length ? d3.max(scope, (c) => c.priority_score || 0) : null;

    const el = d3.select("#status");
    el.selectAll("*").remove();
    const stats = [
      { v: fmt(scope.length), l: "clusters" },
      { v: fmt(totalPop), l: "people affected" },
      { v: top != null ? top.toFixed(1) : "—", l: "top score" },
    ];
    stats.forEach((s, i) => {
      if (i) el.append("div").attr("class", "stat__divider");
      const d = el.append("div").attr("class", "stat");
      d.append("div").attr("class", "stat__value").text(s.v);
      d.append("div").attr("class", "stat__label").text(s.l);
    });
  }

  /* ---------------------------------------------------------- detail panel -- */

  // Human labels and provenance for the nine scoring terms. The source line
  // matters as much as the number: it is what turns "trust the score" into
  // "audit the score".
  const TERMS = [
    ["demand",        "Citizen demand",         "distinct reporters, capped at 25"],
    ["population",    "Population affected",    "Census + PMGSY habitations, log-scaled"],
    ["infra_deficit", "Infrastructure deficit", "measured against the scheme's own norm"],
    ["vulnerability", "Deprivation",            "isolation, power hours, drainage, access"],
    ["equity",        "Equity — silent need",   "BharatNet 2022 fibre status"],
    ["strategic",     "Scheme eligibility",     "PMGSY / IPHS / RTE / JJM rules"],
    ["urgency",       "Urgency",                "recorded seasonal failure"],
    ["feasibility",   "Feasibility",            "Census distance to headquarters"],
    ["cost_penalty",  "Cost penalty",           "scaled by catchment population"],
  ];

  function rankOf(cluster) {
    const ordered = clusters
      .slice()
      .sort((a, b) => (b.priority_score ?? -1) - (a.priority_score ?? -1));
    return ordered.findIndex((c) => c.id === cluster.id) + 1;
  }

  function closePanel() {
    d3.select("#panel").classed("panel--open", false);
  }

  function renderPanel(c) {
    const panel = d3.select("#panel");
    const b = c.breakdown || {};
    const maxAbs = d3.max(TERMS, ([k]) => Math.abs(b[k] || 0)) || 1;
    const sum = TERMS.reduce((acc, [k]) => acc + (b[k] || 0), 0);
    const runner = clusters.find((x) => x.id === c.runner_up_cluster_id);

    panel.html("");

    /* -- head -- */
    const head = panel.append("div").attr("class", "panel__head");
    head.append("button")
      .attr("class", "panel__close")
      .attr("aria-label", "Close detail")
      .html("&times;")
      .on("click", () => navigate("district", { state: nav.state, district: nav.district }));
    head.append("span").attr("class", "panel__cat").text(c.issue_category || "—");
    head.append("div").attr("class", "panel__title").text(c.block || c.district || `Cluster ${c.id}`);
    head.append("div").attr("class", "panel__sub")
      .text(`${c.district} district · cluster ${c.id}`);

    const row = head.append("div").attr("class", "panel__scorerow");
    row.append("div").attr("class", "panel__score")
      .text((c.priority_score ?? 0).toFixed(2));
    row.append("div").attr("class", "panel__scoreof").text("/ 100");
    row.append("div").attr("class", "panel__rank").text(`RANK #${rankOf(c)} OF ${clusters.length}`);

    /* -- body -- */
    const body = panel.append("div").attr("class", "panel__body");

    const facts = body.append("div").attr("class", "panel__section")
      .append("div").attr("class", "facts");
    [
      [fmt(c.report_count ?? 0), "citizen reports"],
      [fmt(c.unique_reporters ?? 0), "distinct reporters"],
      [fmt(c.population_affected ?? 0), "people affected"],
      [fmt(c.settlement_count ?? 0), "settlements"],
    ].forEach(([v, l]) => {
      const f = facts.append("div").attr("class", "fact");
      f.append("div").attr("class", "fact__v").text(v);
      f.append("div").attr("class", "fact__l").text(l);
    });

    /* -- the nine terms -- */
    const sec = body.append("div").attr("class", "panel__section");
    sec.append("div").attr("class", "eyebrow panel__sectionhead").text("Why this score");
    sec.append("div").attr("class", "panel__hint")
      .text("Nine independently-sourced terms. They sum to the score exactly — " +
            "nothing is hidden in a model.");

    TERMS.forEach(([key, label, source]) => {
      const val = b[key] ?? 0;
      const t = sec.append("div").attr("class", "term");
      const r = t.append("div").attr("class", "term__row");
      r.append("span").attr("class", "term__name").text(label);
      r.append("span")
        .attr("class", `term__val${val < 0 ? " term__val--neg" : ""}`)
        .text(`${val > 0 ? "+" : ""}${val.toFixed(2)}`);
      const bar = t.append("div").attr("class", "term__track")
        .append("div")
        .attr("class", `term__bar${val < 0 ? " term__bar--neg" : val === 0 ? " term__bar--zero" : ""}`);
      // Width animates from 0 on the next frame so the panel "fills in".
      requestAnimationFrame(() => {
        bar.style("width", `${Math.max(Math.abs(val) / maxAbs * 100, val === 0 ? 2 : 4)}%`);
      });
      t.append("div").attr("class", "term__src").text(source);
    });

    const sl = sec.append("div").attr("class", "sumline");
    sl.append("span").attr("class", "sumline__l").text("Sum of all nine terms");
    sl.append("span").attr("class", "sumline__v").text(sum.toFixed(2));

    /* -- counterfactual -- */
    if (runner) {
      const rs = body.append("div").attr("class", "panel__section");
      rs.append("div").attr("class", "eyebrow panel__sectionhead").text("Why not the runner-up");
      rs.append("div").attr("class", "panel__hint")
        .text("The next cluster down, and exactly which terms separate them.");

      const card = rs.append("div").attr("class", "runnerup");
      card.append("div").attr("class", "runnerup__name")
        .text(`${runner.block || runner.district} · ${runner.issue_category}`);
      card.append("div").attr("class", "runnerup__score")
        .text(`${(runner.priority_score ?? 0).toFixed(2)} / 100 · ` +
              `${runner.report_count} reports · ${fmt(runner.population_affected || 0)} people`);

      const rb = runner.breakdown || {};
      const diffs = TERMS
        .map(([k, label]) => ({ label, d: (b[k] || 0) - (rb[k] || 0) }))
        .filter((x) => Math.abs(x.d) >= 0.5)
        .sort((a, b2) => Math.abs(b2.d) - Math.abs(a.d))
        .slice(0, 4);

      const list = card.append("div").attr("class", "runnerup__diffs");
      if (diffs.length) {
        diffs.forEach((x) => {
          const d = list.append("div").attr("class", "diff");
          d.append("span").attr("class", "diff__n").text(x.label);
          d.append("span")
            .attr("class", `diff__v diff__v--${x.d > 0 ? "up" : "down"}`)
            .text(`${x.d > 0 ? "+" : ""}${x.d.toFixed(2)}`);
        });
      } else {
        list.append("div").attr("class", "diff")
          .append("span").attr("class", "diff__n")
          .text("The two are separated by less than half a point on every term.");
      }

      card.append("button").attr("class", "runnerup__btn")
        .text("VIEW THIS CLUSTER →")
        .on("click", () => {
          if (runner.district !== nav.district) {
            navigate("district", { state: PILOT_STATE, district: runner.district })
              .then(() => navigate("cluster", { cluster: runner }));
          } else {
            navigate("cluster", { cluster: runner });
          }
        });
    }

    panel.classed("panel--open", true);
  }

  /** Clusters in scope for the current level. */
  function visibleClusters() {
    if (nav.level === "cluster" && nav.cluster) return [nav.cluster];
    if (nav.district) return clusters.filter((c) => c.district === nav.district);
    return clusters;
  }

  /* ------------------------------------------------------------ drawing -- */

  function drawStates() {
    const sel = gStates.selectAll("path").data(statesFC.features, (d) => d.properties.st_nm);
    sel.enter().append("path")
      .attr("d", path)
      .attr("class", (d) =>
        d.properties.st_nm === PILOT_STATE ? "geo geo--active" : "geo geo--dim")
      .on("click", (e, d) => {
        if (d.properties.st_nm === PILOT_STATE) navigate("state", { state: PILOT_STATE });
      })
      .on("mousemove", (e, d) => {
        const isPilot = d.properties.st_nm === PILOT_STATE;
        showTip(e, `<div class="tooltip__title">${d.properties.st_nm}</div>` +
          (isPilot
            ? `<div class="tooltip__row"><span>Clusters</span><b>${clusters.length}</b></div>
               <div class="tooltip__hint">Click to enter</div>`
            : `<div class="tooltip__row"><span>Coverage</span><b>no pilot data</b></div>`));
      })
      .on("mouseleave", hideTip);
    sel.exit().remove();
  }

  function drawDistricts(stateName) {
    const feats = districtsFC.features.filter((d) => d.properties.st_nm === stateName);
    const withData = new Set(clusters.map((c) => c.district));

    const sel = gDistricts.selectAll("path").data(feats, (d) => d.properties.dt_code);
    const enter = sel.enter().append("path").attr("d", path);
    enter.merge(sel)
      .attr("class", (d) =>
        withData.has(d.properties.district) ? "geo geo--active" : "geo geo--dim")
      .on("click", (e, d) => {
        if (withData.has(d.properties.district)) {
          navigate("district", { state: stateName, district: d.properties.district });
        }
      })
      .on("mousemove", (e, d) => {
        const name = d.properties.district;
        const mine = clusters.filter((c) => c.district === name);
        showTip(e, `<div class="tooltip__title">${name}</div>` +
          (mine.length
            ? `<div class="tooltip__row"><span>Clusters</span><b>${mine.length}</b></div>
               <div class="tooltip__row"><span>People affected</span><b>${fmt(d3.sum(mine, (c) => c.population_affected || 0))}</b></div>
               <div class="tooltip__hint">Click to enter</div>`
            : `<div class="tooltip__row"><span>Coverage</span><b>no pilot data</b></div>`));
      })
      .on("mouseleave", hideTip);
    sel.exit().remove();
  }

  function drawOutline(feature) {
    const sel = gOutline.selectAll("path").data(feature ? [feature] : []);
    sel.enter().append("path").attr("class", "geo geo--outline").merge(sel).attr("d", path);
    sel.exit().remove();
  }

  function drawClusters(list) {
    const sel = gClusters.selectAll("circle").data(list, (d) => d.id);

    const enter = sel.enter().append("circle")
      .attr("class", "cluster")
      .attr("cx", (d) => projection([d.centroid_lon, d.centroid_lat])[0])
      .attr("cy", (d) => projection([d.centroid_lon, d.centroid_lat])[1])
      .attr("r", 0)
      .attr("fill", (d) => scoreColour(d.priority_score))
      .on("click", (e, d) => { e.stopPropagation(); navigate("cluster", { cluster: d }); })
      .on("mousemove", (e, d) => {
        showTip(e, `
          <div class="tooltip__title">${d.block || d.district} · ${d.issue_category}</div>
          <div class="tooltip__row"><span>Priority</span><span class="tooltip__score">${(d.priority_score ?? 0).toFixed(2)}</span></div>
          <div class="tooltip__row"><span>Reports</span><b>${d.report_count}</b></div>
          <div class="tooltip__row"><span>Unique reporters</span><b>${d.unique_reporters}</b></div>
          <div class="tooltip__row"><span>People affected</span><b>${fmt(d.population_affected || 0)}</b></div>
          <div class="tooltip__hint">Click for detail</div>`);
      })
      .on("mouseleave", hideTip);

    enter.merge(sel)
      .transition().duration(520).ease(d3.easeCubicOut)
      .attr("r", (d) => radiusScale(d.population_affected || 0) / view.k)
      .attr("fill", (d) => scoreColour(d.priority_score));

    sel.exit().transition().duration(240).attr("r", 0).remove();
  }

  function drawReports(list) {
    const sel = gReports.selectAll("circle").data(list, (d, i) => i);
    sel.enter().append("circle")
      .attr("class", "report")
      .attr("cx", (d) => projection(d.geometry.coordinates)[0])
      .attr("cy", (d) => projection(d.geometry.coordinates)[1])
      .attr("r", 0)
      .transition().delay((d, i) => Math.min(i * 1.2, 500)).duration(320)
      .attr("r", 1.9 / view.k);
    sel.exit().remove();
  }

  function drawLabels(feats, key) {
    const sel = gLabels.selectAll("text").data(feats, (d) => d.properties[key]);
    sel.enter().append("text")
      .attr("class", "label")
      .attr("text-anchor", "middle")
      .attr("x", (d) => path.centroid(d)[0])
      .attr("y", (d) => path.centroid(d)[1])
      .text((d) => d.properties[key])
      .attr("opacity", 0)
      .transition().duration(400).attr("opacity", 1);
    sel.exit().remove();
  }

  /* ---------------------------------------------------------- navigation -- */

  async function navigate(level, opts = {}) {
    hideTip();

    if (level === "india") {
      closePanel();
      Object.assign(nav, { level, state: null, district: null, cluster: null });
      gDistricts.selectAll("path").remove();
      gReports.selectAll("circle").remove();
      drawOutline(null);
      view = fitTransform(india.statesMerged, 0.9);
      drawStates();
      drawClusters([]);
      drawLabels([], "st_nm");
      animateTo(view);
      d3.select("#legendNote").text(
        "Maharashtra is the active pilot. Other states are shown for context only — " +
        "they carry no citizen data yet.");
    }

    if (level === "state") {
      closePanel();
      Object.assign(nav, { level, state: opts.state, district: null, cluster: null });
      gStates.selectAll("path").remove();
      gReports.selectAll("circle").remove();
      const feat = statesFC.features.find((f) => f.properties.st_nm === opts.state);
      view = fitTransform(feat);
      drawDistricts(opts.state);
      drawClusters(clusters);
      drawOutline(feat);
      drawLabels(
        districtsFC.features.filter(
          (d) => d.properties.st_nm === opts.state &&
                 clusters.some((c) => c.district === d.properties.district)),
        "district");
      animateTo(view);
      d3.select("#legendNote").text(
        "Highlighted districts have citizen data. Bubbles are demand clusters, " +
        "sized by population affected.");
    }

    if (level === "district") {
      closePanel();
      Object.assign(nav, { level, state: opts.state, district: opts.district, cluster: null });
      const feat = districtsFC.features.find(
        (d) => d.properties.st_nm === opts.state && d.properties.district === opts.district);
      view = fitTransform(feat);
      drawDistricts(opts.state);
      drawOutline(feat);
      drawLabels([], "district");
      drawClusters(clusters.filter((c) => c.district === opts.district));
      animateTo(view);

      const pts = await ensureReports();
      drawReports(pts.filter((f) => f.properties.district === opts.district));
      d3.select("#legendNote").text(
        "Small dots are individual citizen reports. Bubbles are the clusters they " +
        "were grouped into — corroboration, not repetition.");
    }

    if (level === "cluster") {
      Object.assign(nav, { level, cluster: opts.cluster });
      const c = opts.cluster;
      view = pointTransform(c.centroid_lon, c.centroid_lat, view.k * 3.2, PANEL_W);
      drawClusters(clusters.filter((x) => x.district === nav.district));
      gClusters.selectAll("circle").classed("cluster--faded", (d) => d.id !== c.id);
      animateTo(view);
      renderPanel(c);
      d3.select("#legendNote").text(
        `Cluster ${c.id} — ${c.report_count} reports from ${c.unique_reporters} ` +
        `distinct reporters, affecting ~${fmt(c.population_affected || 0)} people.`);
    }

    if (level !== "cluster") gClusters.selectAll("circle").classed("cluster--faded", false);

    renderBreadcrumb();
    renderStatus();
  }

  async function ensureReports() {
    if (reports) return reports;
    try {
      const fc = await d3.json(`${API}/map-data?layer=reports`);
      reports = fc.features || [];
    } catch {
      reports = [];      // reports are enrichment, not load-bearing
    }
    return reports;
  }

  /* --------------------------------------------------------------- boot -- */

  function sizeToStage() {
    const r = stage.getBoundingClientRect();
    width = r.width;
    height = r.height;
    svg.attr("width", width).attr("height", height)
       .attr("viewBox", `0 0 ${width} ${height}`);
  }

  async function boot() {
    sizeToStage();

    let topo;
    try {
      topo = await d3.json(TOPO_URL);
    } catch (err) {
      return fail(`Couldn't load ${TOPO_URL}. Serve this folder over HTTP rather than ` +
                  `opening the file directly — browsers block local file reads.`);
    }

    statesFC = topojson.feature(topo, topo.objects.states);
    districtsFC = topojson.feature(topo, topo.objects.districts);
    india = { statesMerged: { type: "FeatureCollection", features: statesFC.features } };

    projection.fitExtent([[20, 20], [width - 20, height - 20]], india.statesMerged);

    try {
      clusters = await d3.json(`${API}/clusters`);
    } catch (err) {
      return fail(`No response from <code>${API}</code>.`);
    }
    clusters = (clusters || []).filter((c) => c.centroid_lat != null && c.centroid_lon != null);

    if (!clusters.length) {
      return fail("The API answered but returned no clusters. Run " +
                  "<code>python -m intelligence.recompute</code> from the repo root.");
    }

    const pops = clusters.map((c) => c.population_affected || 0);
    radiusScale = d3.scaleSqrt().domain([0, d3.max(pops) || 1]).range([3, 26]);

    const scores = clusters.map((c) => c.priority_score).filter((s) => s != null);
    colourScale = d3.scaleLinear()
      .domain([d3.min(scores), d3.quantile(scores.slice().sort(d3.ascending), 0.6), d3.max(scores)])
      .range(["#dfe3ea", "#e2c98d", "#c0781e"])
      .clamp(true);

    const districtCount = new Set(clusters.map((c) => c.district)).size;
    document.getElementById("coverageText").textContent =
      `Pilot coverage — ${districtCount} districts · ${clusters.length} clusters`;

    // Deep link, so a view can be shared: ?at=state, ?at=district:Kolhapur,
    // ?at=cluster:12
    const at = params.get("at");
    if (at && at.startsWith("district:")) {
      const name = at.slice(9);
      const known = clusters.some((c) => c.district === name);
      await navigate(known ? "district" : "india",
                     { state: PILOT_STATE, district: name });
    } else if (at && at.startsWith("cluster:")) {
      const target = clusters.find((c) => String(c.id) === at.slice(8));
      if (target) {
        await navigate("district", { state: PILOT_STATE, district: target.district });
        await navigate("cluster", { cluster: target });
      } else {
        await navigate("india");
      }
    } else if (at === "state") {
      await navigate("state", { state: PILOT_STATE });
    } else {
      await navigate("india");
    }

    const loader = document.getElementById("loader");
    loader.classList.add("loader--out");
    setTimeout(() => (loader.hidden = true), 450);
  }

  function fail(msg) {
    document.getElementById("loader").hidden = true;
    document.getElementById("errorMsg").innerHTML = msg;
    document.getElementById("error").hidden = false;
  }

  // Without this, any thrown error leaves the loader spinning forever with no
  // clue why -- the single most confusing failure mode for whoever runs this.
  window.addEventListener("error", (e) =>
    fail(`<b>${e.message}</b><br><small>${e.filename || ""}:${e.lineno || "?"}</small>`));
  window.addEventListener("unhandledrejection", (e) =>
    fail(`<b>${(e.reason && e.reason.message) || e.reason}</b>`));

  // Guarded: the browser fires a resize during startup, before boot() has
  // assigned `india` -- without the guard that throws and the loader hangs.
  // Debounced so dragging a window edge doesn't re-project on every frame.
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (!india) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      sizeToStage();
      projection.fitExtent([[20, 20], [width - 20, height - 20]], india.statesMerged);
      gStates.selectAll("path").attr("d", path);
      gDistricts.selectAll("path").attr("d", path);
      gOutline.selectAll("path").attr("d", path);
      navigate(nav.level, { state: nav.state, district: nav.district, cluster: nav.cluster });
    }, 180);
  });

  boot();
})();
