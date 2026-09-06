/* ===========================================================================
   AwaazIQ — citizen complaint page

   The citizen half of the two-role split. This page can do exactly two
   things: file a report, and look up what happened to one.

   What it deliberately CANNOT do is run clustering. Re-scoring is a
   whole-dataset operation that reorders every district's worklist, and it is
   an official's decision, not a side effect of one villager pressing a
   button. So the citizen gets a tracking view that reports the truth at the
   moment they ask -- including "not yet grouped" -- and the officials'
   dashboard owns the RUN CLUSTERING control.
   =========================================================================== */

(function () {
  "use strict";

  const params = new URLSearchParams(location.search);
  const API = (params.get("api") || "http://127.0.0.1:8000").replace(/\/$/, "");

  // Carry ?api= across to the dashboard, so pointing this page at a
  // non-default backend doesn't silently send officials to another one.
  if (params.get("api")) {
    const link = document.getElementById("adminLink");
    link.href = `index.html?api=${encodeURIComponent(API)}`;
  }

  const SAMPLES = [
    "hamare gaon mein sadak bahut kharab hai near Ajra",
    "पाणी पुरवठा बंद आहे Bhudargad जवळ",
    "अस्पताल बहुत दूर है Chandgad गांव में",
    "school mein shikshak nahi hai near Kagal",
  ];

  // Each stage is something the backend actually does in process_report, and
  // is marked done only when the response proves that field came back. A
  // stage that could not resolve says so rather than showing a tick.
  const STEPS = [
    ["Reading the language and script", (r) => r.language_detected],
    ["Normalising the text", () => true],
    ["Working out the problem and how urgent it is", (r) => r.issue_category],
    ["Finding the place you named", (r) => r.location_raw],
    ["Matching it to a village on the map", (r) => r.village],
    ["Removing phone numbers and names", () => true],
  ];

  const el = (id) => document.getElementById(id);
  const show = (id, on) => { el(id).hidden = !on; };

  /* ------------------------------------------------------------- my ids -- */

  // Per-viewer convenience only: the report numbers this browser has filed,
  // so someone can check back without writing the number down. It never
  // leaves the device and the server has no idea it exists -- which is the
  // point, since the server holds no citizen identity either.
  const STORE = "awaaziq.myreports";

  function myReports() {
    try {
      const raw = localStorage.getItem(STORE);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
  function rememberReport(id) {
    try {
      const list = myReports().filter((x) => x !== id);
      list.unshift(id);
      localStorage.setItem(STORE, JSON.stringify(list.slice(0, 8)));
    } catch { /* private mode, blocked storage -- the page still works */ }
  }
  function renderMine() {
    const box = d3.select("#mine");
    box.selectAll("*").remove();
    const list = myReports();
    if (!list.length) return;
    box.append("span")
      .style("font-size", "11px").style("color", "var(--muted)")
      .style("align-self", "center").style("margin-right", "3px")
      .text("From this device:");
    list.forEach((id) => {
      box.append("button").attr("class", "mine__chip").text(`#${id}`)
        .on("click", () => { el("trackId").value = id; track(id); });
    });
  }

  /* -------------------------------------------------------------- steps -- */

  function renderSteps(result) {
    const box = d3.select("#steps");
    box.selectAll("*").remove();
    STEPS.forEach(([label, check]) => {
      const done = result ? !!check(result) : false;
      const row = box.append("div")
        .attr("class", `step${result ? (done ? " step--done" : "") : " step--on"}`);
      row.append("div").attr("class", "step__dot");
      row.append("div").text(label);
      if (result) {
        row.append("div").attr("class", "step__note")
          .text(done ? "done" : "could not resolve");
      }
    });
  }

  /* ------------------------------------------------------------- submit -- */

  async function submit() {
    const text = el("text").value.trim();
    const audio = el("audio").files[0];
    if (!text && !audio) { el("text").focus(); return; }

    el("submit").disabled = true;
    show("formCard", false);
    show("runCard", true);
    renderSteps(null);

    let saved;
    try {
      let res;
      if (audio) {
        const fd = new FormData();
        fd.append("file", audio);
        res = await fetch(`${API}/citizen-report`, { method: "POST", body: fd });
      } else {
        res = await fetch(`${API}/citizen-report`, {
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
      show("runCard", false);
      showError(err.message);
      return;
    }

    renderSteps(saved);
    rememberReport(saved.id);
    renderMine();
    setTimeout(() => { show("runCard", false); showReceipt(saved); }, 800);
  }

  function showError(message) {
    const box = d3.select("#doneCard");
    box.node().hidden = false;
    box.html("");
    box.append("div").attr("class", "result__banner result__banner--warn")
      .text(`Your report could not be sent: ${message}`);
    box.append("div").attr("class", "card__lead")
      .text("Nothing was saved. Check that the backend is running, then try again.");
    box.append("div").attr("class", "done-actions")
      .append("button").attr("class", "btn").text("TRY AGAIN")
      .on("click", reset);
  }

  function showReceipt(saved) {
    const resolved = !!saved.village;
    const box = d3.select("#doneCard");
    box.node().hidden = false;
    box.html("");

    const rc = box.append("div").attr("class", "receipt");
    rc.append("div").attr("class", "receipt__num").text(`#${saved.id}`);
    rc.append("div").attr("class", "receipt__label")
      .html(resolved
        ? "Your report was received and understood.<br>Keep this number to check on it later."
        : "Your report was received, but the place could not be matched to a " +
          "village we know.<br>Add a nearby village or landmark and send it again.");

    box.append("div").attr("class", "eyebrow").style("margin-bottom", "9px")
      .text("What we understood");

    const kv = box.append("div").attr("class", "kv");
    [
      ["Language", saved.language_detected || "—"],
      ["Problem", saved.issue_category || "not recognised"],
      ["Urgency", saved.severity || "—"],
      ["Place you wrote", saved.location_raw || "—"],
      ["Matched to", saved.village
        ? `${saved.village}, ${saved.block || "?"}, ${saved.district || "?"}`
        : "no match"],
      ["Stored as", saved.raw_text || ""],
    ].forEach(([k, v]) => {
      kv.append("div").attr("class", "kv__k").text(k);
      kv.append("div").attr("class", "kv__v").text(v);
    });

    if (resolved) {
      const next = box.append("div").attr("class", "next");
      next.append("div").attr("class", "next__title").text("What happens now");
      const ol = next.append("ol");
      [
        "Your report waits to be <b>matched with others</b> nearby about the " +
        "same problem. One report on its own is not yet enough — that is how " +
        "the system avoids acting on a single voice.",
        "When officials run the analysis, matching reports are grouped into " +
        "one <b>demand cluster</b> for your area.",
        "That cluster is scored against census, road, water and connectivity " +
        "data, and takes a <b>rank</b> in the district's priority list.",
        "Come back and enter <b>#" + saved.id + "</b> below to see where it got to.",
      ].forEach((t) => ol.append("li").html(t));
    }

    const actions = box.append("div").attr("class", "done-actions");
    actions.append("button").attr("class", "btn btn--primary")
      .text("REPORT ANOTHER PROBLEM").on("click", reset);
    if (resolved) {
      actions.append("button").attr("class", "btn").text("CHECK ITS STATUS")
        .on("click", () => { el("trackId").value = saved.id; track(saved.id); });
    }
  }

  function reset() {
    el("text").value = "";
    el("audio").value = "";
    el("audioLabel").textContent = "🎙 Record or upload audio instead";
    el("submit").disabled = false;
    show("doneCard", false);
    show("runCard", false);
    show("formCard", true);
    el("text").focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* -------------------------------------------------------------- track -- */

  async function track(id) {
    const box = d3.select("#trackResult");
    box.html("");
    box.append("div").attr("class", "tstat")
      .append("div").attr("class", "tstat__text").text("Looking up report…");

    let data;
    try {
      const res = await fetch(`${API}/citizen-report/${id}`);
      if (res.status === 404) {
        return paint("bad", "Not found",
          `There is no report numbered <b>#${id}</b>. Check the number and try again.`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      return paint("bad", "Cannot check", `The server did not answer (${err.message}).`);
    }

    const r = data.report;
    const where = r.village ? `${r.village}, ${r.district}` : "an unmatched place";

    if (data.status === "unresolved") {
      return paint("bad", "Needs a place",
        `Report <b>#${id}</b> was stored, but "${r.location_raw || "the place you " +
        "wrote"}" could not be matched to a village on the map, so it cannot be ` +
        `grouped with others. Send it again naming a nearby village.`);
    }

    if (data.status === "awaiting_corroboration") {
      return paint("wait", "Waiting for others",
        `Report <b>#${id}</b> about <b>${r.issue_category || "a problem"}</b> in ` +
        `<b>${where}</b> has been received, but no matching reports have been ` +
        `grouped with it yet. One report on its own is not treated as a demand ` +
        `signal — if others near you report the same problem, it will join them.`);
    }

    const c = data.cluster;
    paint("ok", "Grouped and ranked",
      `Report <b>#${id}</b> is now part of a <b>${c.issue_category}</b> cluster in ` +
      `<b>${c.block || c.district}</b>, together with <b>${c.report_count} reports</b> ` +
      `from <b>${c.unique_reporters} distinct reporters</b>, affecting about ` +
      `<b>${(c.population_affected || 0).toLocaleString("en-IN")} people</b>.`);

    if (c.rank) {
      const rb = d3.select("#trackResult .tstat").append("div").attr("class", "rankbar");
      rb.append("div").attr("class", "rankbar__num").text(`#${c.rank}`);
      rb.append("div").attr("class", "rankbar__of")
        .html(`of ${c.ranked_out_of} clusters in the state, scored ` +
              `<b>${(c.priority_score ?? 0).toFixed(1)}</b> out of 100`);
    }
  }

  function paint(kind, label, html) {
    const box = d3.select("#trackResult");
    box.html("");
    const s = box.append("div").attr("class", "tstat");
    const head = s.append("div").attr("class", "tstat__head");
    head.append("span").attr("class", `tstat__pill tstat__pill--${kind}`).text(label);
    s.append("div").attr("class", "tstat__text").html(html);
  }

  /* --------------------------------------------------------------- boot -- */

  SAMPLES.forEach((s) => {
    d3.select("#samples").append("button").attr("class", "sample").text(s)
      .on("click", () => { el("text").value = s; el("text").focus(); });
  });

  el("submit").addEventListener("click", submit);
  el("audio").addEventListener("change", function () {
    el("audioLabel").textContent = this.files[0]
      ? `🎙 ${this.files[0].name}`
      : "🎙 Record or upload audio instead";
  });
  el("trackGo").addEventListener("click", () => {
    const id = el("trackId").value.trim();
    if (id) track(id);
  });
  el("trackId").addEventListener("keydown", (e) => {
    if (e.key === "Enter") el("trackGo").click();
  });

  renderMine();

  // ?track=2014 opens straight onto one report's status.
  const t = params.get("track");
  if (t) { el("trackId").value = t; track(t); }
})();
