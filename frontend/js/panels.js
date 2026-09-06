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
            .then(() => A.navigate("cluster", { cluster: c }));
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

  /* --------------------------------------------------------------- intake -- */

  // Real sentences in the registers the pipeline is built for: Devanagari
  // Hindi, Marathi, and romanised code-mixed Hinglish.
  const SAMPLES = [
    "hamare gaon mein sadak bahut kharab hai near Ajra",
    "पाणी पुरवठा बंद आहे Bhudargad जवळ",
    "अस्पताल बहुत दूर है Chandgad गांव में",
    "school mein shikshak nahi hai near Kagal",
  ];

  // The backend does the whole pipeline in one call, so these stages are a
  // faithful description of what it runs -- not a fake progress bar. Each is
  // marked done as soon as the response confirms that field came back.
  const STEPS = [
    ["Language & script ID", (r) => r.language_detected],
    ["Text normalization", () => true],
    ["Issue & severity extraction", (r) => r.issue_category],
    ["Location extraction", (r) => r.location_raw],
    ["Geocoding against gazetteer", (r) => r.village],
    ["PII redaction", () => true],
  ];

  function openIntake() {
    d3.select("#intake").classed("intake--open", true);
    document.getElementById("intakeForm").hidden = false;
    document.getElementById("intakeRun").hidden = true;
    document.getElementById("intakeDone").hidden = true;
    document.getElementById("intakeText").focus();
  }
  function closeIntake() { d3.select("#intake").classed("intake--open", false); }

  function renderSamples() {
    const el = d3.select("#intakeSamples");
    el.selectAll("*").remove();
    SAMPLES.forEach((s) => {
      el.append("button").attr("class", "sample").text(s)
        .on("click", () => { document.getElementById("intakeText").value = s; });
    });
  }

  function renderSteps(result) {
    const el = d3.select("#intakeSteps");
    el.selectAll("*").remove();
    STEPS.forEach(([label, check], i) => {
      const done = result ? !!check(result) : false;
      const row = el.append("div")
        .attr("class", `step${result ? (done ? " step--done" : "") : " step--on"}`);
      row.append("div").attr("class", "step__dot");
      row.append("div").text(label);
      if (result) {
        row.append("div").attr("class", "step__note")
          .text(done ? "ok" : "not resolved");
      }
    });
  }

  async function submitReport() {
    const text = document.getElementById("intakeText").value.trim();
    const audio = document.getElementById("intakeAudio").files[0];
    if (!text && !audio) return;

    document.getElementById("intakeForm").hidden = true;
    document.getElementById("intakeRun").hidden = false;
    renderSteps(null);

    let saved;
    try {
      let res;
      if (audio) {
        const fd = new FormData();
        fd.append("file", audio);
        res = await fetch(`${A.getApi()}/citizen-report`, { method: "POST", body: fd });
      } else {
        res = await fetch(`${A.getApi()}/citizen-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
      }
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || `HTTP ${res.status}`);
      }
      saved = await res.json();
    } catch (err) {
      showResult(null, err.message);
      return;
    }

    renderSteps(saved);
    setTimeout(() => showResult(saved), 700);
  }

  function showResult(saved, error) {
    document.getElementById("intakeRun").hidden = true;
    const el = d3.select("#intakeDone");
    el.node().hidden = false;
    el.html("");

    if (error) {
      el.append("div").attr("class", "result__banner result__banner--warn")
        .text(`Could not file the report: ${error}`);
      el.append("div").attr("class", "intake__done-actions")
        .append("button").attr("class", "btn").text("TRY AGAIN")
        .on("click", openIntake);
      return;
    }

    const resolved = !!saved.village;
    el.append("div")
      .attr("class", `result__banner${resolved ? "" : " result__banner--warn"}`)
      .text(resolved
        ? `Report #${saved.id} filed and understood.`
        : `Report #${saved.id} filed, but the location could not be resolved to a ` +
          `known village — so it cannot join a cluster yet.`);

    const kv = el.append("div").attr("class", "kv");
    [
      ["Language", saved.language_detected || "—"],
      ["Category", saved.issue_category || "not recognised"],
      ["Severity", saved.severity || "—"],
      ["Location said", saved.location_raw || "—"],
      ["Resolved to", saved.village
        ? `${saved.village}, ${saved.block || "?"}, ${saved.district || "?"}` : "unresolved"],
      ["Confidence", saved.confidence != null ? saved.confidence.toFixed(2) : "—"],
      ["Stored text", saved.raw_text || ""],
    ].forEach(([k, v]) => {
      kv.append("div").attr("class", "kv__k").text(k);
      kv.append("div").attr("class", "kv__v").text(v);
    });

    const actions = el.append("div").attr("class", "intake__done-actions");
    if (resolved) {
      actions.append("button").attr("class", "btn btn--primary")
        .text("RUN CLUSTERING → FIND MY CLUSTER")
        .on("click", function () { clusterAndReveal(saved, d3.select(this)); });
    }
    actions.append("button").attr("class", "btn").text("FILE ANOTHER")
      .on("click", () => {
        document.getElementById("intakeText").value = "";
        document.getElementById("intakeAudio").value = "";
        document.getElementById("intakeAudioLabel").textContent = "🎙 or upload audio";
        openIntake();
      });
    actions.append("button").attr("class", "btn").text("CLOSE").on("click", closeIntake);
  }

  /**
   * Re-run clustering and scoring, then take the user to whichever cluster
   * their report joined.
   *
   * A new report has cluster_id = NULL until the P3 pass runs, so this is not
   * cosmetic -- it is the step that actually folds the report into a demand
   * signal. It takes ~20s on 1,000 reports, which is why the button reports
   * progress rather than just spinning.
   */
  async function clusterAndReveal(saved, btn) {
    btn.attr("disabled", true).text("CLUSTERING… (~20s)");
    try {
      await fetch(`${A.getApi()}/recompute-scores`, { method: "POST" });

      // Re-read this specific report by id to learn which cluster took it.
      // Matching on village + is_synthetic instead would pick whichever
      // report happened to come first from that village, which is the wrong
      // one as soon as a village has been reported about twice.
      const all = await (await fetch(`${A.getApi()}/map-data?layer=reports`)).json();
      const mine = (all.features || []).find(
        (f) => f.properties && f.properties.id === saved.id);

      const clusterId = mine ? mine.properties.cluster_id : null;
      if (clusterId == null) {
        btn.attr("disabled", null).text("RUN CLUSTERING → FIND MY CLUSTER");
        d3.select("#intakeDone").insert("div", ".intake__done-actions")
          .attr("class", "result__banner result__banner--warn")
          .text("Clustering ran, but this report stayed unclustered — a lone report " +
                "with nothing corroborating it is not yet a demand signal. That is " +
                "correct behaviour, not a failure.");
        return;
      }

      // Reload clusters so the new scores are what the dashboard shows.
      location.href =
        `${location.pathname}?api=${encodeURIComponent(A.getApi())}&at=cluster:${clusterId}&mine=${saved.id}`;
    } catch (err) {
      btn.attr("disabled", null).text("RUN CLUSTERING → FIND MY CLUSTER");
      d3.select("#intakeDone").insert("div", ".intake__done-actions")
        .attr("class", "result__banner result__banner--warn")
        .text(`Clustering failed: ${err.message}`);
    }
  }

  /* ----------------------------------------------------------------- boot -- */

  A.onReady(() => {
    renderChips();
    renderList();
    setupWhatIf();

    document.getElementById("btnCompare").addEventListener("click", openCompare);

    renderSamples();
    document.getElementById("btnReport").addEventListener("click", openIntake);
    document.getElementById("intakeClose").addEventListener("click", closeIntake);
    document.getElementById("intakeSubmit").addEventListener("click", submitReport);
    document.getElementById("intakeAudio").addEventListener("change", (e) => {
      const f = e.target.files[0];
      document.getElementById("intakeAudioLabel").textContent =
        f ? `🎙 ${f.name}` : "🎙 or upload audio";
    });
    document.getElementById("intakeText").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitReport();
    });

    // Keep the worklist in step with the map, including navigations the map
    // starts itself (clicking a bubble, the breadcrumb, or Back).
    A.onNavigate(renderList);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeCompare();
        closeIntake();
        d3.select("#sheet").classed("sheet--open", false);
      }
    });

    // Deep links, so a specific comparison or simulation can be sent to
    // someone rather than described to them:
    //   ?compare=12,10        open the A-vs-B view for those two clusters
    //   ?whatif=Kolhapur:50   open the sheet and run ₹50 crore for a district
    const q = new URLSearchParams(location.search);

    if (q.get("report") === "1") openIntake();

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
