/* ===========================================================================
   AwaazIQ — UI layer

   Everything that is not the map: the ranked worklist, the A-vs-B comparison,
   and the what-if budget simulation. Talks to the map only through the small
   window.AwaazIQ surface, never by reaching into its internals.
   =========================================================================== */

(() => {
  "use strict";

  const A = window.AwaazIQ;
  const CATEGORIES = ["all", "road", "water", "health", "education"];

  let filter = "all";
  let picked = [];           // up to two clusters selected for comparison
  let whatIf = null;         // {district, delta, byId:{id: newScore}} once run

  /* ----------------------------------------------------------------- rail -- */

  function scopedClusters() {
    let list = A.getClusters();
    if (filter !== "all") list = list.filter((c) => c.issue_category === filter);
    // Follow the map: inside a district, rank only that district.
    if (A.nav.district) list = list.filter((c) => c.district === A.nav.district);
    const score = (c) =>
      (whatIf && whatIf.byId[c.id] ? whatIf.byId[c.id].score : c.priority_score) ?? -1;
    return list.slice().sort((a, b) => score(b) - score(a));
  }

  function renderChips() {
    const el = d3.select("#chips");
    el.selectAll("*").remove();
    CATEGORIES.forEach((cat) => {
      el.append("button")
        .attr("class", `chip${cat === filter ? " chip--on" : ""}`)
        .text(cat)
        .on("click", () => { filter = cat; renderChips(); renderList(); });
    });
  }

  function renderList() {
    const list = scopedClusters();
    const el = d3.select("#railList");
    el.selectAll("*").remove();

    d3.select("#railCount").text(
      `${list.length} ${A.nav.district ? "in " + A.nav.district : "statewide"}`);

    if (!list.length) {
      el.append("div")
        .style("font-size", "12px").style("color", "var(--body)")
        .style("padding", "14px 8px").style("line-height", "1.5")
        .text("No clusters match this filter.");
      return;
    }

    list.forEach((c, i) => {
      const isActive = A.nav.cluster && A.nav.cluster.id === c.id;
      const isPicked = picked.some((p) => p.id === c.id);
      const wi = whatIf && whatIf.byId[c.id];
      const shifted = wi ? wi.delta : 0;

      const row = el.append("div")
        .attr("class", `row${isActive ? " row--active" : ""}${isPicked ? " row--picked" : ""}`)
        .on("click", () => {
          A.navigate("district", { state: "Maharashtra", district: c.district })
            .then(() => A.navigate("cluster", { cluster: c, state: "Maharashtra", district: c.district }));
        });

      row.append("div").attr("class", "row__rank").text(`#${i + 1}`);

      const main = row.append("div").attr("class", "row__main");
      main.append("div").attr("class", "row__name")
        .text(`${c.block || c.district} · ${c.issue_category}`);
      main.append("div").attr("class", "row__meta")
        .text(`${c.report_count} reports · ${A.fmt(c.population_affected || 0)} people`);

      const right = row.append("div");
      right.append("div").attr("class", "row__score")
        .style("color", shifted ? "var(--amber)" : null)
        .text((wi ? wi.score : (c.priority_score ?? 0)).toFixed(1));
      if (shifted) {
        right.append("div")
          .attr("class", `row__delta row__delta--${shifted > 0 ? "up" : "down"}`)
          .text(`${shifted > 0 ? "+" : ""}${shifted.toFixed(2)}`);
      }

      // Pick control for the comparison view.
      row.append("div")
        .attr("class", `row__pick${isPicked ? " row__pick--on" : ""}`)
        .attr("title", "Select for comparison")
        .html("&#10003;")
        .on("click", (e) => { e.stopPropagation(); togglePick(c); });
    });
  }

  function togglePick(c) {
    const at = picked.findIndex((p) => p.id === c.id);
    if (at >= 0) picked.splice(at, 1);
    else if (picked.length < 2) picked.push(c);
    else picked = [picked[1], c];          // keep the most recent two
    d3.select("#btnCompare")
      .attr("disabled", picked.length === 2 ? null : true)
      .text(`COMPARE (${picked.length}/2)`);
    renderList();
  }

  /* -------------------------------------------------------------- compare -- */

  function openCompare() {
    if (picked.length !== 2) return;
    // Present the higher-scoring cluster on the left so the winner reads first.
    const [a, b] = picked.slice().sort(
      (x, y) => (y.priority_score ?? 0) - (x.priority_score ?? 0));

    const root = d3.select("#compare");
    root.html("");

    const head = root.append("div").attr("class", "compare__head");
    const ht = head.append("div");
    ht.append("div").attr("class", "compare__title")
      .text("More reports do not always mean greater need");
    ht.append("div").attr("class", "compare__sub")
      .text("Both clusters scored by the same nine terms. Where they differ is " +
            "visible term by term — nothing is hidden in a model.");
    head.append("button").attr("class", "btn").style("flex", "0 0 110px")
      .text("← BACK").on("click", closeCompare);

    const grid = root.append("div").attr("class", "compare__grid");
    card(grid, a, true);

    /* middle: per-term opposing bars */
    const mid = grid.append("div").attr("class", "cmid");
    mid.append("div").attr("class", "cmid__title").text("term by term");
    const ab = a.breakdown || {}, bb = b.breakdown || {};
    const maxAbs = d3.max(A.TERMS, ([k]) =>
      Math.max(Math.abs(ab[k] || 0), Math.abs(bb[k] || 0))) || 1;

    A.TERMS.forEach(([k, label]) => {
      const av = ab[k] || 0, bv = bb[k] || 0;
      const g = mid.append("div").attr("class", "cbar");
      g.append("div").attr("class", "cbar__name").text(label);
      const tr = g.append("div").attr("class", "cbar__track");
      tr.append("div").attr("class", "cbar__l").append("i")
        .attr("class", av >= bv ? "" : "dim")
        .style("width", `${Math.abs(av) / maxAbs * 100}%`);
      tr.append("div").attr("class", "cbar__r").append("i")
        .attr("class", bv > av ? "" : "dim")
        .style("width", `${Math.abs(bv) / maxAbs * 100}%`);
    });

    card(grid, b, false);

    /* verdict, generated from the actual numbers rather than written by hand */
    const moreReports = b.report_count > a.report_count ? b : a;
    const winner = a;
    const v = root.append("div").attr("class", "verdict");
    const line = v.append("div").attr("class", "verdict__line");

    if (moreReports.id !== winner.id) {
      const gapTerms = A.TERMS
        .map(([k, label]) => ({ label, d: (ab[k] || 0) - (bb[k] || 0) }))
        .filter((x) => x.d > 0.4)
        .sort((x, y) => y.d - x.d)
        .slice(0, 3)
        .map((x) => x.label.toLowerCase());

      line.html(
        `<b>${moreReports.block || moreReports.district}</b> has ` +
        `<b>${moreReports.report_count}</b> reports against ` +
        `<b>${winner.block || winner.district}</b>'s <b>${winner.report_count}</b> — ` +
        `a complaint-counting system would rank it first. This one ranks ` +
        `<b>${winner.block || winner.district}</b> first, carried by ` +
        `${gapTerms.join(", ")}.`);
      v.append("div").attr("class", "verdict__note")
        .text("Report volume is capped, corroborated evidence — never a raw multiplier. " +
              "That is what stops a well-connected area out-shouting a cut-off one.");
    } else {
      line.html(
        `<b>${winner.block || winner.district}</b> leads on both demand and score. ` +
        `The terms below show how much of that lead comes from evidence volume ` +
        `versus measured need.`);
      v.append("div").attr("class", "verdict__note")
        .text("Agreement between volume and need is the ordinary case — the engine " +
              "exists for when they disagree.");
    }

    root.classed("compare--open", true);
  }

  function card(parent, c, isWinner) {
    const el = parent.append("div").attr("class", `ccard${isWinner ? " ccard--win" : ""}`);
    el.append("div").attr("class", `ccard__tag${isWinner ? " ccard__tag--win" : ""}`)
      .text(`RANK #${A.rankOf(c)} · ${c.issue_category}`);
    el.append("div").attr("class", "ccard__name").text(c.block || c.district);
    el.append("div").attr("class", "ccard__where").text(`${c.district} district · cluster ${c.id}`);
    el.append("span").attr("class", "ccard__score").text((c.priority_score ?? 0).toFixed(2));
    el.append("span").attr("class", "ccard__of").text("  / 100");

    const b = c.breakdown || {};
    [
      ["Citizen reports", A.fmt(c.report_count ?? 0), false],
      ["Distinct reporters", A.fmt(c.unique_reporters ?? 0), false],
      ["People affected", A.fmt(c.population_affected ?? 0), false],
      ["Settlements", A.fmt(c.settlement_count ?? 0), false],
      ["Infrastructure deficit", (b.infra_deficit ?? 0).toFixed(2), true],
      ["Deprivation", (b.vulnerability ?? 0).toFixed(2), true],
      ["Equity — silent need", (b.equity ?? 0).toFixed(2), true],
    ].forEach(([k, val, hi]) => {
      const r = el.append("div").attr("class", "crow");
      r.append("span").attr("class", "crow__k").text(k);
      r.append("span").attr("class", `crow__v${hi ? " crow__v--hi" : ""}`).text(val);
    });
  }

  function closeCompare() { d3.select("#compare").classed("compare--open", false); }

  /* --------------------------------------------------------------- whatif -- */

  function setupWhatIf() {
    const districts = Array.from(new Set(A.getClusters().map((c) => c.district))).sort();
    const sel = d3.select("#wiDistrict");
    sel.selectAll("*").remove();
    districts.forEach((d) => sel.append("option").attr("value", d).text(d));

    const amount = document.getElementById("wiAmount");
    const label = document.getElementById("wiVal");
    const paint = () => { label.textContent = `₹${amount.value} crore`; };
    amount.addEventListener("input", paint);
    paint();

    document.getElementById("btnWhatIf").addEventListener("click", () =>
      d3.select("#sheet").classed("sheet--open", true));
    document.getElementById("sheetClose").addEventListener("click", () =>
      d3.select("#sheet").classed("sheet--open", false));
    document.getElementById("wiRun").addEventListener("click", runWhatIf);
  }

  async function runWhatIf() {
    const district = document.getElementById("wiDistrict").value;
    const crore = +document.getElementById("wiAmount").value;
    const btn = d3.select("#wiRun");
    btn.attr("disabled", true).text("RUNNING…");

    try {
      const res = await fetch(`${A.getApi()}/what-if`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The API takes rupees; the slider speaks crore because that is the
        // unit an Indian budget officer actually uses.
        body: JSON.stringify({ budget_delta: crore * 1e7, district }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // The API returns priority_score as the NEW score, with the original in
      // baseline_priority_score and the difference already computed.
      const byId = {};
      (data.clusters || []).forEach((c) => {
        if (c.id != null && c.priority_score != null) {
          byId[c.id] = { score: c.priority_score, delta: c.score_delta ?? 0 };
        }
      });
      whatIf = { district, delta: crore, byId };

      const moved = data.clusters_affected ?? 0;
      d3.select("#wiResult").html(
        `<b>₹${crore} crore</b> to <b>${district}</b> moved <b>${moved}</b> ` +
        `cluster${moved === 1 ? "" : "s"}. Updated scores and deltas are shown in the ` +
        `ranking on the left. Nothing was re-clustered — what is broken does not change ` +
        `because money moved, only what is fundable does.`);
      renderList();
    } catch (err) {
      d3.select("#wiResult").html(
        `<b>Simulation failed.</b> ${err.message}. The API must be reachable at ` +
        `<code>${A.getApi()}</code>.`);
    } finally {
      btn.attr("disabled", null).text("RUN SIMULATION");
    }
  }

  /* ------------------------------------------------------- run clustering -- */

  /**
   * The officials-only action: re-run the whole P3 pass.
   *
   * This lives on the dashboard and NOT on the citizen page on purpose. A
   * recompute re-embeds every report, re-runs DBSCAN and re-scores all 113
   * clusters, which reorders every district's worklist -- a decision an
   * official takes, not a side effect of one villager pressing a button.
   * It also takes ~30-60s, so the button reports what it is doing instead
   * of appearing to hang.
   */
  async function runClustering() {
    const btn = d3.select("#btnRecompute");
    const toast = d3.select("#toast");
    const say = (msg, warn) => {
      toast.node().hidden = false;
      toast.classed("toast--warn", !!warn).text(msg);
    };

    btn.attr("disabled", true).text("CLUSTERING…");
    say("Re-embedding every report and re-running DBSCAN — this takes a minute.");

    try {
      const res = await fetch(`${A.getApi()}/recompute-scores`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const out = await res.json();
      say(`${out.reports_clustered} of ${out.reports_total} reports clustered into ` +
          `${out.clusters_created} clusters. Top score ${out.top_score}. Reloading…`);
      // Reload rather than patching state in place: a recompute can create,
      // merge or drop clusters, so every cluster id the page is holding may
      // now point at something different.
      setTimeout(() => location.reload(), 1600);
    } catch (err) {
      btn.attr("disabled", null).text("RUN CLUSTERING");
      say(`Clustering failed: ${err.message}`, true);
      setTimeout(() => { toast.node().hidden = true; }, 6000);
    }
  }

  /* ----------------------------------------------------------------- boot -- */

  // Wired outside onReady on purpose. onReady only fires once clusters have
  // loaded, so when the backend is unreachable it never runs -- and the
  // cross-role link would silently drop its ?api=, sending an official to a
  // citizen page pointed at a different backend. Neither of these needs
  // cluster data, so neither should wait for it.
  document.getElementById("btnRecompute").addEventListener("click", runClustering);

  const apiParam = new URLSearchParams(location.search).get("api");
  if (apiParam) {
    document.getElementById("citizenLink").href =
      `report.html?api=${encodeURIComponent(apiParam)}`;
  }

  A.onReady(() => {
    renderChips();
    renderList();
    setupWhatIf();

    document.getElementById("btnCompare").addEventListener("click", openCompare);


    // Keep the worklist in step with the map, including navigations the map
    // starts itself (clicking a bubble, the breadcrumb, or Back).
    A.onNavigate(renderList);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeCompare();
        d3.select("#sheet").classed("sheet--open", false);
      }
    });

    // Deep links, so a specific comparison or simulation can be sent to
    // someone rather than described to them:
    //   ?compare=12,10        open the A-vs-B view for those two clusters
    //   ?whatif=Kolhapur:50   open the sheet and run ₹50 crore for a district
    const q = new URLSearchParams(location.search);

    const cmp = q.get("compare");
    if (cmp) {
      const ids = cmp.split(",").map((s) => s.trim());
      const found = ids
        .map((id) => A.getClusters().find((c) => String(c.id) === id))
        .filter(Boolean);
      if (found.length === 2) {
        picked = found;
        d3.select("#btnCompare").attr("disabled", null).text("COMPARE (2/2)");
        renderList();
        openCompare();
      }
    }

    const wi = q.get("whatif");
    if (wi) {
      const [district, croreRaw] = wi.split(":");
      const crore = Number(croreRaw);
      const districts = Array.from(new Set(A.getClusters().map((c) => c.district)));
      if (districts.includes(district) && Number.isFinite(crore)) {
        document.getElementById("wiDistrict").value = district;
        const amount = document.getElementById("wiAmount");
        amount.value = String(crore);
        amount.dispatchEvent(new Event("input"));
        d3.select("#sheet").classed("sheet--open", true);
        runWhatIf();
      }
    }
  });
})();
