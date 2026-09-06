"""
Read-only endpoints backing the frontend dashboard: clusters, map data, and
a paginated citizen-reports listing.
"""

import json

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import CitizenRequest, DemandCluster, PriorityScore
from routes_citizen_report import serialize_citizen_request

router = APIRouter()


def _latest_score_by_cluster(db: Session) -> dict[int, PriorityScore]:
    latest: dict[int, PriorityScore] = {}
    for score in db.query(PriorityScore).all():
        current = latest.get(score.cluster_id)
        if current is None or score.id > current.id:
            latest[score.cluster_id] = score
    return latest


def _serialize_cluster(cluster: DemandCluster, score: PriorityScore | None) -> dict:
    breakdown = None
    if score and score.breakdown:
        try:
            breakdown = json.loads(score.breakdown)
        except (TypeError, ValueError):
            breakdown = score.breakdown

    return {
        "id": cluster.id,
        "issue_category": cluster.issue_category,
        "centroid_lat": cluster.centroid_lat,
        "centroid_lon": cluster.centroid_lon,
        "report_count": cluster.report_count,
        "unique_reporters": cluster.unique_reporters,
        "population_affected": cluster.population_affected,
        # Added with P3 so the dashboard can label and compare clusters
        # without a second round-trip -- the Cluster A vs B screen needs
        # every one of these fields on one row.
        "district": cluster.district,
        "block": cluster.block,
        "settlement_count": cluster.settlement_count,
        "avg_confidence": cluster.avg_confidence,
        "priority_score": score.priority_score if score else None,
        "breakdown": breakdown,
        "runner_up_cluster_id": score.runner_up_cluster_id if score else None,
    }


@router.get("/clusters")
def list_clusters(db: Session = Depends(get_db)):
    clusters = db.query(DemandCluster).all()
    if not clusters:
        return []

    scores_by_cluster = _latest_score_by_cluster(db)

    clusters_sorted = sorted(
        clusters,
        key=lambda c: (
            scores_by_cluster[c.id].priority_score
            if c.id in scores_by_cluster
            else float("-inf")
        ),
        reverse=True,
    )

    return [
        _serialize_cluster(c, scores_by_cluster.get(c.id))
        for c in clusters_sorted
    ]


@router.get("/clusters/{cluster_id}")
def get_cluster(cluster_id: int, db: Session = Depends(get_db)):
    cluster = db.query(DemandCluster).filter(DemandCluster.id == cluster_id).first()
    if cluster is None:
        raise HTTPException(status_code=404, detail=f"Cluster {cluster_id} not found")

    score = (
        db.query(PriorityScore)
        .filter(PriorityScore.cluster_id == cluster_id)
        .order_by(PriorityScore.id.desc())
        .first()
    )

    breakdown = None
    if score and score.breakdown:
        try:
            breakdown = json.loads(score.breakdown)
        except (TypeError, ValueError):
            breakdown = score.breakdown

    detail = _serialize_cluster(cluster, score)
    detail["priority_breakdown"] = breakdown
    detail["runner_up_cluster_id"] = score.runner_up_cluster_id if score else None
    detail["computed_at"] = score.computed_at if score else None
    return detail


@router.get("/clusters/{cluster_id}/reports")
def cluster_reports(
    cluster_id: int,
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """
    The individual citizen reports folded into one cluster.

    This is what lets the dashboard answer "who reported this?" -- and the
    honest answer is that it can show WHAT was reported, from WHERE, in WHICH
    language and WHEN, but never WHO. There is no citizen identity column, and
    phone numbers and name-prefixes are redacted from the text at ingestion
    before it is ever stored (routes_citizen_report.redact_pii). That is a
    deliberate privacy property carried from the DPDP Act design, not a gap to
    be filled in later.
    """
    cluster = db.query(DemandCluster).filter(DemandCluster.id == cluster_id).first()
    if cluster is None:
        raise HTTPException(status_code=404, detail=f"Cluster {cluster_id} not found")

    in_cluster = db.query(CitizenRequest).filter(
        CitizenRequest.cluster_id == cluster_id
    )

    # Counted over the whole cluster, not over the page. Deriving these from
    # the returned rows instead would make both numbers silently collapse to
    # `limit` on any cluster larger than one page.
    #
    # "Distinct reporters" is approximated by distinct report text, exactly as
    # the scoring engine does it, so the two numbers can never disagree.
    total = in_cluster.count()
    distinct = len(
        {(text or "").strip().lower() for (text,) in in_cluster.with_entities(
            CitizenRequest.raw_text
        )}
    )

    rows = (
        in_cluster.order_by(
            CitizenRequest.created_at.desc(), CitizenRequest.id.desc()
        )
        .limit(limit)
        .all()
    )

    return {
        "cluster_id": cluster_id,
        "report_count": total,
        "distinct_texts": distinct,
        "returned": len(rows),
        "identity_available": False,
        "reports": [serialize_citizen_request(r) for r in rows],
    }


@router.get("/citizen-report/{report_id}")
def citizen_report_status(report_id: int, db: Session = Depends(get_db)):
    """
    What happened to one citizen's report -- the citizen-side view.

    A report has three honest states, and the tracking page shows whichever
    one is true rather than implying progress that has not happened:

      unresolved   the location could not be matched to a known village, so
                   it can never join a cluster as it stands
      awaiting     resolved, but clustering has not yet found corroboration.
                   One report is not yet a demand signal, so this is the
                   normal state for a fresh complaint, not an error
      clustered    folded into a demand cluster, which carries a rank the
                   citizen can see

    Lives here rather than in routes_citizen_report because ranking needs
    _latest_score_by_cluster; importing it the other way round would be a
    circular import.
    """
    report = db.query(CitizenRequest).filter(CitizenRequest.id == report_id).first()
    if report is None:
        raise HTTPException(status_code=404, detail=f"Report {report_id} not found")

    payload = {"report": serialize_citizen_request(report), "cluster": None}

    if report.village is None:
        payload["status"] = "unresolved"
        return payload

    if report.cluster_id is None:
        payload["status"] = "awaiting_corroboration"
        return payload

    cluster = (
        db.query(DemandCluster).filter(DemandCluster.id == report.cluster_id).first()
    )
    if cluster is None:
        # The cluster id points at nothing -- possible between a recompute
        # that dropped clusters and one that reassigned reports.
        payload["status"] = "awaiting_corroboration"
        return payload

    scores = _latest_score_by_cluster(db)
    ranked = sorted(
        scores.values(), key=lambda s: s.priority_score, reverse=True
    )
    rank = next(
        (i + 1 for i, s in enumerate(ranked) if s.cluster_id == cluster.id), None
    )

    payload["status"] = "clustered"
    payload["cluster"] = _serialize_cluster(cluster, scores.get(cluster.id))
    payload["cluster"]["rank"] = rank
    payload["cluster"]["ranked_out_of"] = len(ranked)
    return payload


@router.get("/map-data")
def get_map_data(
    layer: str = Query("clusters", pattern="^(clusters|reports)$"),
    db: Session = Depends(get_db),
):
    """
    GeoJSON for Leaflet.

    layer=clusters (default) is what the build plan asks for -- one feature
    per scored cluster, sized/coloured by priority_score. layer=reports
    returns the individual citizen reports instead, which is what the demo's
    "watch a thousand reports land, then watch clusters form" beat needs.
    """
    if layer == "clusters":
        scores_by_cluster = _latest_score_by_cluster(db)
        clusters = (
            db.query(DemandCluster)
            .filter(
                DemandCluster.centroid_lat.isnot(None),
                DemandCluster.centroid_lon.isnot(None),
            )
            .all()
        )
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [c.centroid_lon, c.centroid_lat],
                    },
                    "properties": _serialize_cluster(c, scores_by_cluster.get(c.id)),
                }
                for c in clusters
            ],
        }

    rows = (
        db.query(CitizenRequest)
        .filter(
            CitizenRequest.latitude.isnot(None),
            CitizenRequest.longitude.isnot(None),
        )
        .all()
    )

    features = [
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [row.longitude, row.latitude],
            },
            "properties": {
                # The report's own id: without it a caller can only match a
                # point back to its record by guessing on village + category,
                # which silently picks the wrong report whenever a village has
                # more than one.
                "id": row.id,
                "issue_category": row.issue_category,
                "severity": row.severity,
                "district": row.district,
                "village": row.village,
                "cluster_id": row.cluster_id,
                "is_synthetic": row.is_synthetic,
                "created_at": row.created_at,
            },
        }
        for row in rows
    ]

    return {"type": "FeatureCollection", "features": features}


class WhatIfRequest(BaseModel):
    budget_delta: float
    district: str


@router.post("/what-if")
def what_if(payload: WhatIfRequest, db: Session = Depends(get_db)):
    """
    Live, no longer a stub: calls P3's recompute_with_budget (build plan P2
    Step 7 / P3 Step 9).

    Re-scores every cluster as if `district` had received `budget_delta`
    extra rupees and returns the re-sorted ranking. Each row carries both the
    new and baseline score plus the delta, so the dashboard can animate what
    actually moved. Clusters are NOT re-clustered -- what is broken does not
    change because money moved, only what is fundable does.
    """
    from intelligence.whatif import recompute_with_budget

    clusters = recompute_with_budget(db, payload.budget_delta, payload.district)
    moved = [c for c in clusters if c["score_delta"] != 0]

    return {
        "budget_delta": payload.budget_delta,
        "district": payload.district,
        "clusters": clusters,
        "clusters_affected": len(moved),
        "stub": False,
    }


@router.get("/citizen-reports")
def list_citizen_reports(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(CitizenRequest)
        .order_by(CitizenRequest.id)
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [serialize_citizen_request(row) for row in rows]
