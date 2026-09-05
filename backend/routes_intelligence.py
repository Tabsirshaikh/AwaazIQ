"""
P3 Step 10 -- the recompute trigger P2 exposes.

Kept separate from routes_dashboard.py because this is the only write-side
intelligence endpoint: everything else P4 touches is read-only.
"""

import sys
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db

_REPO_ROOT = Path(__file__).resolve().parents[1]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

router = APIRouter()


@router.post("/recompute-scores")
def recompute_scores(db: Session = Depends(get_db)):
    """
    Re-run the full P3 pass: embed, gate, cluster, score, rank.

    Safe to call repeatedly -- it clears the previous clustering and scores
    before writing new ones. Expect this to take tens of seconds on a
    thousand-plus reports: it loads a sentence-transformer and builds a
    distance matrix per category, which is why it is a triggered job rather
    than something that runs inline on every citizen report.
    """
    from intelligence.recompute import recompute

    summary = recompute(db, verbose=False)
    return {"status": "ok", **summary}
