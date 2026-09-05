"""
P3 Step 10 -- the recompute job that runs Steps 1-8 end to end.

Reads citizen_request, clusters it, scores every cluster, and writes
demand_cluster + priority_score. Idempotent: each run clears the previous
clustering and scores first, so triggering it after seeding more data
refreshes the whole picture rather than stacking duplicates.

Exposed to P2 as POST /recompute-scores (backend/routes_intelligence.py).
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[1]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))
if str(_REPO_ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT / "backend"))

from models import CitizenRequest, DemandCluster, Gazetteer, PriorityScore  # noqa: E402

from . import config  # noqa: E402
from . import realdata  # noqa: E402
from .clustering import cluster_all, haversine_km  # noqa: E402
from .population import nearest_hq_distance_km, population_in_catchment  # noqa: E402
from .scoring import score_cluster  # noqa: E402


def _load_reports(db) -> list[dict]:
    return [
        {
            "id": row.id,
            "raw_text": row.raw_text,
            "issue_category": row.issue_category,
            "severity": row.severity,
            "district": row.district,
            "block": row.block,
            "village": row.village,
            "latitude": row.latitude,
            "longitude": row.longitude,
            "confidence": row.confidence,
        }
        for row in db.query(CitizenRequest).all()
    ]


def _load_gazetteer(db) -> list[dict]:
    return [
        {
            "name": row.name,
            "admin_level": row.admin_level,
            "district": row.district,
            "block": row.block,
            "population": row.population,
            "lat": row.latitude,
            "lon": row.longitude,
        }
        for row in db.query(Gazetteer).all()
    ]


def _modal(values: list) -> object | None:
    """Most common non-null value, used to label a cluster's district/block."""
    present = [v for v in values if v]
    if not present:
        return None
    return Counter(present).most_common(1)[0][0]


def _unique_reporters(reports: list[dict]) -> int:
    """
    Distinct reporters, approximated by distinct report text.

    There is no citizen identity in this dataset, so identical text is
    treated as one voice repeated rather than several independent ones.
    That is the "500 people forwarding the same WhatsApp message is not 500
    corroborations" guard from research report SS10.4, implemented with what
    the schema actually has. Real per-citizen identity would replace this.
    """
    return len({(r.get("raw_text") or "").strip().lower() for r in reports})


def _settlement_count(reports: list[dict]) -> int:
    return len({r.get("village") for r in reports if r.get("village")})


def _attach_stragglers(
    reports: list[dict],
    assignments: dict[int, tuple[str, int]],
    grouped: dict[tuple[str, int], list[dict]],
    by_id: dict[int, dict],
) -> int:
    """
    Second pass: attach still-unclustered reports to an ALREADY-ESTABLISHED
    cluster of the same category, if one sits within the gate radius.

    Why this is principled rather than a fudge. DBSCAN's min_samples rule
    exists so that three scattered reports cannot conjure a cluster out of
    nothing -- that guarantee is about *forming* a cluster, and this pass
    does not weaken it: no new cluster is ever created here. Once a problem
    is established by corroboration, a later nearby report of the same
    category is genuinely more evidence for that known problem, and the
    right place for it is that cluster.

    Without this, a citizen reporting a real issue in a thinly-populated
    block gets cluster_id = NULL and the feedback loop has nothing to say to
    them -- which is precisely the population the whole system exists to
    serve, so silently dropping their report would be the worst possible
    failure mode.
    """
    if not grouped:
        return 0

    centroids = {
        key: (
            sum(m["latitude"] for m in members) / len(members),
            sum(m["longitude"] for m in members) / len(members),
        )
        for key, members in grouped.items()
    }

    attached = 0
    for report in reports:
        if report["id"] in assignments:
            continue
        category = report.get("issue_category")
        if not category:
            continue
        if report.get("latitude") is None or report.get("longitude") is None:
            continue

        candidates = [
            (haversine_km(report["latitude"], report["longitude"], lat, lon), key)
            for key, (lat, lon) in centroids.items()
            if key[0] == category
        ]
        if not candidates:
            continue

        distance, key = min(candidates)
        if distance <= config.GATE_RADIUS_KM:
            assignments[report["id"]] = key
            grouped[key].append(by_id[report["id"]])
            attached += 1

    return attached


def recompute(db, verbose: bool = True) -> dict:
    """Run the full P3 pass. Returns a summary dict."""

    def log(message: str) -> None:
        if verbose:
            print(message)

    reports = _load_reports(db)
    gazetteer = _load_gazetteer(db)
    log(f"loaded {len(reports)} reports, {len(gazetteer)} gazetteer rows")

    # Real government data, loaded once and reused for every cluster. If the
    # loaders have not been run these come back empty and every term falls
    # back to its proxy -- the engine degrades rather than failing.
    amenity_index = realdata.load_amenity_index(db)
    works_index = realdata.load_works_index(db)
    with_records = sum(1 for v in amenity_index if v.get("has_real_data"))
    log(
        f"real data: {with_records}/{len(amenity_index)} villages with government "
        f"records, {len(works_index)} sanctioned works pinned to a village"
    )

    # --- Steps 1-3: embed, gate, cluster -----------------------------------
    assignments = cluster_all(reports)
    log(f"clustered {len(assignments)} reports into groups")

    grouped: dict[tuple[str, int], list[dict]] = {}
    by_id = {r["id"]: r for r in reports}
    for report_id, key in assignments.items():
        grouped.setdefault(key, []).append(by_id[report_id])

    attached = _attach_stragglers(reports, assignments, grouped, by_id)
    log(f"attached {attached} further reports to established clusters")

    # --- clear the previous pass -------------------------------------------
    db.query(CitizenRequest).update({CitizenRequest.cluster_id: None}, synchronize_session=False)
    db.query(PriorityScore).delete(synchronize_session=False)
    db.query(DemandCluster).delete(synchronize_session=False)
    db.commit()

    # --- Steps 4-7: population, gap score, priority score, breakdown -------
    scored: list[tuple[DemandCluster, dict]] = []

    for (category, _label), members in grouped.items():
        centroid_lat = sum(m["latitude"] for m in members) / len(members)
        centroid_lon = sum(m["longitude"] for m in members) / len(members)

        population_affected = population_in_catchment(
            centroid_lat, centroid_lon, category, gazetteer
        )
        confidences = [m["confidence"] for m in members if m["confidence"] is not None]
        average_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        cluster = DemandCluster(
            issue_category=category,
            centroid_lat=centroid_lat,
            centroid_lon=centroid_lon,
            report_count=len(members),
            unique_reporters=_unique_reporters(members),
            population_affected=population_affected,
            district=_modal([m["district"] for m in members]),
            block=_modal([m["block"] for m in members]),
            avg_confidence=round(average_confidence, 4),
            settlement_count=_settlement_count(members),
        )
        db.add(cluster)
        db.flush()  # assign cluster.id

        for member in members:
            db.query(CitizenRequest).filter(CitizenRequest.id == member["id"]).update(
                {CitizenRequest.cluster_id: cluster.id}, synchronize_session=False
            )

        # --- what the government's own records say about this place --------
        nearby_villages = realdata.villages_near(centroid_lat, centroid_lon, amenity_index)

        infra_value, infra_evidence = realdata.real_infra_deficit(
            category, nearby_villages, works_index, population_affected
        )
        vulnerability_value, vulnerability_evidence = realdata.real_vulnerability(
            nearby_villages
        )
        reporting_value, reporting_evidence = realdata.real_reporting_capacity_deficit(
            nearby_villages
        )
        eligible, eligibility_evidence = realdata.real_scheme_eligibility(
            category, nearby_villages, population_affected
        )
        hq_km, hq_evidence = realdata.real_hq_distance_km(nearby_villages)

        result = score_cluster(
            unique_reporters=cluster.unique_reporters,
            population_affected=population_affected,
            settlement_count=cluster.settlement_count,
            severities=[m["severity"] for m in members],
            average_confidence=average_confidence,
            issue_category=category,
            block=cluster.block,
            distance_to_hq_km=nearest_hq_distance_km(centroid_lat, centroid_lon, gazetteer),
            real_infra_deficit=infra_value,
            real_vulnerability=vulnerability_value,
            real_reporting_deficit=reporting_value,
            # Only assert eligibility when there were records to judge it on;
            # "we have no data" must not be recorded as "not eligible".
            scheme_eligible=eligible if eligibility_evidence else None,
            real_hq_distance_km=hq_km,
        )
        result["evidence"] = {
            "infra_deficit": infra_evidence,
            "vulnerability": vulnerability_evidence,
            "reporting_capacity": reporting_evidence,
            "scheme_eligibility": eligibility_evidence,
            "feasibility": hq_evidence,
            "villages_examined": len(nearby_villages),
        }
        scored.append((cluster, result))

    db.commit()
    log(f"created {len(scored)} clusters")

    # --- Step 8: runner-up / counterfactual --------------------------------
    # Sorted descending, each cluster's runner-up is simply the next one down,
    # so P4 can render "why not this other one" without a second query.
    scored.sort(key=lambda pair: pair[1]["priority_score"], reverse=True)

    for index, (cluster, result) in enumerate(scored):
        runner_up = scored[index + 1][0].id if index + 1 < len(scored) else None
        db.add(
            PriorityScore(
                cluster_id=cluster.id,
                priority_score=result["priority_score"],
                breakdown=json.dumps(result["breakdown"]),
                runner_up_cluster_id=runner_up,
            )
        )

    db.commit()

    summary = {
        "reports_total": len(reports),
        "reports_clustered": len(assignments),
        "clusters_created": len(scored),
        "top_score": scored[0][1]["priority_score"] if scored else None,
        "categories": dict(Counter(c.issue_category for c, _ in scored)),
    }
    log(f"summary: {summary}")
    return summary


def main() -> None:
    from database import SessionLocal

    db = SessionLocal()
    try:
        recompute(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
