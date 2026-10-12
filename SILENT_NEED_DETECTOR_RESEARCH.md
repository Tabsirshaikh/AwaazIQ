# Research: building a real Silent Need Detector

Companion to `FEATURE_ROADMAP.md`. Answers two things directly: where does
literacy data actually come from, and what's the honest way to build
"this village is reporting less than it should be" instead of the current
flat connectivity-only proxy.

## 1. The literacy data — verified live, a different Census product than what's already loaded

`load_village_amenities.py` pulls from Census 2011's **District Census
Handbook, Village Amenities schedule** — infrastructure and facilities,
280+ columns. Literacy is not in that schedule at all; it lives in a
**separate Census 2011 product, the Primary Census Abstract (PCA)**,
joined to the same villages by the same census village code.

**Checked live**: `data.gov.in`'s Maharashtra Village/Town-wise PCA page
loads real content — the word "Literate" appears in it, and it lists real
downloadable CSV resources. It carries households, population, the 0-6
age group, SC/ST population, literate/illiterate counts, and workers by
category, at the same village level everything else in this project
already uses.
[Maharashtra PCA (data.gov.in)](https://www.data.gov.in/catalog/villagetown-wise-primary-census-abstract-2011-maharashtra),
[Primary Census Abstract 2011, India and states](https://www.data.gov.in/catalog/primary-census-abstract-2011-india-and-states-0)

**This needs a new loader**, not an addition to the existing amenities one
— different source file, same join key (village census code), same
pattern as `load_demographic_data.py` already uses for population. Add
`literacy_rate_pct` (and optionally `female_literacy_rate_pct`, since the
digital-divide literature below treats them as separately predictive) to
`VillageAmenities`.

**Consistent with this project's own existing rule**: the SC/ST columns in
the same PCA file must stay excluded, exactly like the same decision
already made for the Village Amenities schedule (`load_village_amenities.py`'s
own "DELIBERATE OMISSION" section) — literacy rate is an aggregate,
area-level fact; individual or caste-level data is not.

## 2. What real research says about this problem

### 2.1 Participation bias doesn't automatically become outcome bias — but only if you design for it

Mellon, Peixoto & Sjoberg's work on Brazilian participatory budgeting
found that online voters and offline voters differed exactly along
digital-divide lines, **and yet the outcome of the vote didn't
change** — participation bias and outcome bias are two different things,
linked only by how the system is designed to handle the gap. This is the
paper this project's own research PDF already cites for exactly this
point. The practical reading for AwaazIQ: an under-reporting village
staying invisible isn't an inevitable consequence of who reports — it's a
design choice this project can actively correct for, which is the whole
justification for building this feature at all.
[The haves and the have nots (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S0740624X25000012)

### 2.2 The real methodology: predict expected need independently, then compare to actual reports

Kontokosta et al. (NYU, published on 20M+ real NYC 311 requests) is the
closest real precedent to what this feature should do, and it's a genuine
two-step design, not a single score:

1. **Predict expected issue rate from data that doesn't depend on citizen
   reports at all** — in their case, a model trained on building
   violations, property records and census data. **In AwaazIQ's case,
   this step is already built**: `real_infra_deficit()` already computes
   a real, independent infra_deficit per area from Census/PMGSY/JJM,
   with zero dependency on how many citizens reported anything.
2. **Compare actual complaint volume against that independent
   prediction.** Areas with high predicted need and low actual reports
   are the bias signal — not "low connectivity" on its own, but
   **specifically the gap between what's independently known to be wrong
   and what citizens have actually said.**

They found this correction changes real outcomes: a model that accounts
for under-reporting allocates inspections more fairly across
non-white, less-educated, and lower-income residents than one that
doesn't. A related study in Kansas City found the same pattern directly —
**despite greater objective need, lower-income and less-educated areas
report less**, not more, confirming the direction of the bias.
[Equity in 311 Reporting (arXiv)](https://arxiv.org/abs/1710.02452),
[NYU Marron Institute summary](https://marroninstitute.nyu.edu/blog/equity-in-311-reporting),
[Bias in smart city governance — Kansas City (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S2210670720307216)

**Important scoping-down, stated honestly**: their model uses gradient
boosting regression on millions of records. AwaazIQ has 441 villages
total. Fitting a complex ML model on a dataset this small would overfit
and produce confident-looking nonsense — the same failure mode this
project has already avoided elsewhere (e.g., `config.py`'s own comment on
why `APPLY_CATEGORY_IMPORTANCE` stays off). The right-sized version of
their method here is a simple ratio baseline, not a trained model — see
§3.

### 2.3 Literacy is a real, separate driver from connectivity — not a duplicate signal

Research on India's rural digital divide specifically names **low digital
literacy, not just infrastructure access**, as an independent barrier —
people with a working internet connection still don't participate if they
lack the literacy/confidence to use it. This is the direct justification
for loading literacy as its own signal rather than treating BharatNet
fibre status as a sufficient proxy for "can this village make itself
heard."
[Bridging the Digital Divide through E-Governance, Madhya Pradesh](https://www.researchgate.net/publication/400445652_Bridging_the_Digital_Divide_through_E-Governance_An_Empirical_Study_of_Rural_Inclusion_and_Service_Accessibility_in_Madhya_Pradesh)

### 2.4 Underreporting-correction literature — the general technique, not directly needed at this scale

Broader academic work on correcting under-reported counts (disease
surveillance, crowdsourced urban data) exists and confirms the general
principle — assuming uniform under-reporting when it's actually uneven
across areas produces worse estimates than modeling the unevenness
explicitly. Useful as background confirmation that this is a real,
recognized problem with a real literature behind it; the specific
techniques (compound Poisson models, Bayesian spatial correction) are
built for much larger datasets than this project has and are not
recommended here.
[Bias correction for underreported data in small area mapping](https://www.researchgate.net/publication/354162404_Bias_correction_for_underreported_data_in_small_area_mapping)

## 3. The actual design for this codebase

**A ratio baseline, not a trained model** — right-sized for 441 villages:

1. Load literacy (§1) alongside the existing BharatNet connectivity data.
2. For every gazetteer village (not just ones with enough reports to
   cluster — this must run as its own full scan, since `DBSCAN_MIN_SAMPLES
   = 3` already excludes the exact villages this feature exists to catch),
   compute:
   - `real_deficit` — already available today from `real_infra_deficit()`
     and `real_vulnerability()`, independent of citizen reports.
   - `actual_reports` — the village's real report count, however many
     that is, including zero.
   - `expected_reports` — a simple baseline: the project-wide average
     reports-per-1,000-population **among villages with good connectivity
     and literacy** (a "reports freely" reference group), scaled by this
     village's own population, then discounted by this village's own
     connectivity and literacy shortfall relative to that reference group.
3. **Flag, don't score**: a village where `real_deficit` is high,
   `actual_reports` is far below `expected_reports`, and both connectivity
   and literacy are genuinely poor is a silent-need candidate. Surface it
   as its own list — "villages that may need help but aren't being heard
   from" — not folded into the cluster-level `equity` point boost, for
   the reason already established: villages with too few reports to
   cluster can't be scored fairly against ones that can.
4. Recalibrate the baseline (`expected_reports`) every time `recompute()`
   runs, from whatever the current reference-group villages actually show
   — never hardcode it, and never let is silently go stale.

This keeps every part of the existing "never fabricate, never treat
absence of reports as absence of need" philosophy intact — it just gives
that philosophy a real, calibrated number instead of a flat connectivity
proxy and a decade-old hardcoded block list.

## Sources

- [Maharashtra Primary Census Abstract 2011 (data.gov.in)](https://www.data.gov.in/catalog/villagetown-wise-primary-census-abstract-2011-maharashtra)
- [Primary Census Abstract 2011, India and states](https://www.data.gov.in/catalog/primary-census-abstract-2011-india-and-states-0)
- [The haves and the have nots: civic technologies and government responsiveness](https://www.sciencedirect.com/science/article/pii/S0740624X25000012)
- [Equity in 311 Reporting (arXiv 1710.02452)](https://arxiv.org/abs/1710.02452)
- [NYU Marron Institute: Equity in 311 Reporting summary](https://marroninstitute.nyu.edu/blog/equity-in-311-reporting)
- [Bias in smart city governance — Kansas City 311 study](https://www.sciencedirect.com/science/article/pii/S2210670720307216)
- [Bridging the Digital Divide through E-Governance, Madhya Pradesh](https://www.researchgate.net/publication/400445652_Bridging_the_Digital_Divide_through_E-Governance_An_Empirical_Study_of_Rural_Inclusion_and_Service_Accessibility_in_Madhya_Pradesh)
- [Bias correction for underreported data in small area mapping](https://www.researchgate.net/publication/354162404_Bias_correction_for_underreported_data_in_small_area_mapping)
