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
    return {
        "id": cluster.id,
        "issue_category": cluster.issue_category,
        "centroid_lat": cluster.centroid_lat,
        "centroid_lon": cluster.centroid_lon,
        "report_count": cluster.report_count,
        "unique_reporters": cluster.unique_reporters,
        "population_affected": cluster.population_affected,
        "priority_score": score.priority_score if score else None,
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


@router.get("/map-data")
def get_map_data(db: Session = Depends(get_db)):
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
                "issue_category": row.issue_category,
                "severity": row.severity,
                "district": row.district,
                "village": row.village,
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
    STUB, per the build plan (P2 Step 7): P3's re-ranking function
    (recompute_with_budget) doesn't exist yet, since P3 hasn't started.
    Returns the current cluster ranking completely unchanged, so P4 can
    build and test against the real response shape now rather than being
    blocked. Swap the body for a call to P3's function once it's delivered.
    """
    return {
        "budget_delta": payload.budget_delta,
        "district": payload.district,
        "clusters": list_clusters(db),
        "stub": True,
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
