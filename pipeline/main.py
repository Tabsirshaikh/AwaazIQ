from .language_detector import detect_language
from .speech_to_text import transcribe_audio
from .text_normalizer import normalize_text
from .extract import (
    extract_issue_category,
    extract_severity
)
from .location import extract_location_phrase
from .geocode import resolve_location

# --- Confidence tuning knobs -------------------------------------------
# Kept at module level so they're visible and changeable without reading
# through the function body.
CONFIDENCE_WITH_CATEGORY = 0.9
CONFIDENCE_NO_CATEGORY = 0.3
CONFIDENCE_NO_LOCATION = 0.2
LOW_CONFIDENCE_THRESHOLD = 0.5
DECAY_PER_EXTRA_LOW_FIELD = 0.85
# -----------------------------------------------------------------------


def process_report(
    input_data: dict,
    gazetteer_rows: list[dict]
) -> dict:

    # -------------------------
    # 1. INPUT
    # -------------------------

    is_audio = "audio_path" in input_data

    if is_audio:
        raw_text = transcribe_audio(
            input_data["audio_path"]
        )
    else:
        raw_text = input_data["text"]


    # -------------------------
    # 2. LANGUAGE
    # -------------------------

    language = detect_language(raw_text)


    # -------------------------
    # 3. NORMALIZATION
    # -------------------------

    normalized = normalize_text(raw_text)


    # -------------------------
    # 4. ISSUE
    # -------------------------

    issue_category = extract_issue_category(
        normalized
    )


    # -------------------------
    # 5. SEVERITY
    # -------------------------

    severity = extract_severity(
        normalized
    )


    # -------------------------
    # 6. LOCATION
    # -------------------------

    location_phrase = extract_location_phrase(
        normalized
    )


    # -------------------------
    # 7. LOCATION RESOLUTION
    # -------------------------

    location_resolved = resolve_location(
        location_phrase,
        gazetteer_rows
    )


    # -------------------------
    # 8. CONFIDENCE
    # -------------------------
    # Averaging alone understates risk when several extraction steps are
    # ALL uncertain at once (vs. just one weak field) -- a record with no
    # recognized issue AND no resolved location is much less trustworthy
    # than the simple average of its two scores suggests. When more than
    # one field is below LOW_CONFIDENCE_THRESHOLD, apply a multiplicative
    # decay on top of the average, once per extra low field.

    field_scores = [
        CONFIDENCE_WITH_CATEGORY if issue_category else CONFIDENCE_NO_CATEGORY,
        (
            location_resolved["confidence"]
            if location_resolved
            else CONFIDENCE_NO_LOCATION
        )
    ]

    base_confidence = sum(field_scores) / len(field_scores)

    low_fields = sum(
        1 for score in field_scores if score < LOW_CONFIDENCE_THRESHOLD
    )
    if low_fields > 1:
        base_confidence *= DECAY_PER_EXTRA_LOW_FIELD ** (low_fields - 1)

    confidence_overall = round(base_confidence, 2)


    # -------------------------
    # 9. FINAL RECORD
    # -------------------------

    return {
        "raw_text": raw_text,
        "language_detected": language,
        "issue_category": issue_category,
        "severity": severity,
        "location_raw": location_phrase,
        "location_resolved": location_resolved,
        "is_synthetic": False,
        "confidence_overall": confidence_overall
    }