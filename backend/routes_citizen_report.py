"""
POST /citizen-report — the real ingestion endpoint. Accepts either typed
text or an uploaded audio file, runs it through the full NLP pipeline
(pipeline.main.process_report), redacts PII from the text before storing
it, and keeps the untouched original in a separate table.
"""

import re
import sys
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline.main import process_report  # noqa: E402

from database import get_db  # noqa: E402
from models import CitizenRequest, CitizenRequestRaw, Gazetteer  # noqa: E402

router = APIRouter()

# Indian mobile numbers: 10 digits, starting 6-9.
PHONE_RE = re.compile(r"\b[6-9]\d{9}\b")

# Common name-prefixes followed by a capitalized word, e.g. "Mr. Sharma",
# "Shri Kumar".
NAME_PREFIX_RE = re.compile(
    r"\b(?:Mr|Mrs|Ms|Miss|Dr|Shri|Smt)\.?\s+[A-Z][a-zA-Z]*\b"
)


def redact_pii(text: str) -> str:
    redacted = PHONE_RE.sub("[PHONE]", text)
    redacted = NAME_PREFIX_RE.sub("[NAME]", redacted)
    return redacted


_gazetteer_cache: list[dict] | None = None
_gazetteer_cache_count: int | None = None


def _load_gazetteer_rows(db: Session) -> list[dict]:
    """Gazetteer rows for geocoding, cached across requests.

    This used to materialise all ~1000 gazetteer rows from the database on
    every single POST /citizen-report. The gazetteer is static reference
    data during normal operation, so it's cached and re-read only when the
    row count changes (i.e. someone re-ran load_gazetteer.py) -- one cheap
    COUNT(*) per request instead of a full table load.

    Caveat: in-place edits that don't change the row count won't invalidate
    the cache. That's fine today because the only such writer is
    load_demographic_data.py, which updates `population`, and geocoding
    never reads that column -- but restart the server if that changes.
    """
    global _gazetteer_cache, _gazetteer_cache_count

    count = db.query(Gazetteer).count()
    if _gazetteer_cache is None or count != _gazetteer_cache_count:
        # Keys must be "lat"/"lon" -- that is what pipeline.geocode reads, and
        # what the build plan's Interface Contract (Section 2) specifies for
        # location_resolved. Naming them latitude/longitude here silently threw
        # away every coordinate: geocode's row.get("lat") returned None for all
        # 1,000+ reports, leaving /map-data permanently empty.
        _gazetteer_cache = [
            {
                "name": row.name,
                "district": row.district,
                "block": row.block,
                "lat": row.latitude,
                "lon": row.longitude,
            }
            for row in db.query(Gazetteer).all()
        ]
        _gazetteer_cache_count = count

    return _gazetteer_cache


def serialize_citizen_request(citizen_request: CitizenRequest) -> dict:
    return {
        "id": citizen_request.id,
        "raw_text": citizen_request.raw_text,
        "language_detected": citizen_request.language_detected,
        "issue_category": citizen_request.issue_category,
        "severity": citizen_request.severity,
        "location_raw": citizen_request.location_raw,
        "district": citizen_request.district,
        "block": citizen_request.block,
        "village": citizen_request.village,
        "latitude": citizen_request.latitude,
        "longitude": citizen_request.longitude,
        "confidence": citizen_request.confidence,
        "is_synthetic": citizen_request.is_synthetic,
        # Which demand cluster this report was folded into, once P3 has run.
        # This is what powers the citizen feedback loop: "your report
        # contributed to Cluster N, currently ranked #M".
        "cluster_id": citizen_request.cluster_id,
        "created_at": citizen_request.created_at,
    }


@router.post("/citizen-report")
async def create_citizen_report(request: Request, db: Session = Depends(get_db)):
    content_type = request.headers.get("content-type", "")
    tmp_path = None

    try:
        if "multipart/form-data" in content_type:
            form = await request.form()
            upload = form.get("file")
            # A plain (non-file) form field named "file" comes back as a str,
            # which has no .filename/.read and would blow up below.
            if upload is None or not hasattr(upload, "read"):
                raise HTTPException(status_code=400, detail="No audio file provided")

            suffix = Path(upload.filename or "").suffix or ".wav"
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(await upload.read())
                tmp_path = tmp.name

            input_data = {"audio_path": tmp_path}
        else:
            # Previously an unparseable or empty body raised straight out of
            # request.json() as a 500; a malformed request is the client's
            # error, so report it as one.
            try:
                body = await request.json()
            except Exception:
                raise HTTPException(
                    status_code=400,
                    detail='Body must be JSON of the form {"text": "..."}',
                )

            if not isinstance(body, dict):
                raise HTTPException(
                    status_code=400,
                    detail='Body must be a JSON object of the form {"text": "..."}',
                )

            text = body.get("text")
            if not isinstance(text, str) or not text.strip():
                raise HTTPException(
                    status_code=400, detail="No text provided"
                )
            input_data = {"text": text}

        gazetteer_rows = _load_gazetteer_rows(db)
        result = process_report(input_data, gazetteer_rows)

        original_text = result["raw_text"]
        redacted_text = redact_pii(original_text)
        location_resolved = result.get("location_resolved") or {}

        citizen_request = CitizenRequest(
            raw_text=redacted_text,
            language_detected=result["language_detected"],
            issue_category=result["issue_category"],
            severity=result["severity"],
            location_raw=result["location_raw"],
            district=location_resolved.get("district"),
            block=location_resolved.get("block"),
            village=location_resolved.get("village"),
            latitude=location_resolved.get("lat"),
            longitude=location_resolved.get("lon"),
            confidence=result["confidence_overall"],
            is_synthetic=result["is_synthetic"],
        )
        db.add(citizen_request)
        db.commit()
        db.refresh(citizen_request)

        db.add(
            CitizenRequestRaw(
                original_text=original_text,
                linked_request_id=citizen_request.id,
            )
        )
        db.commit()

        return serialize_citizen_request(citizen_request)
    finally:
        if tmp_path:
            Path(tmp_path).unlink(missing_ok=True)
