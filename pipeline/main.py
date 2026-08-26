from .lang_id import detect_language
from .asr import transcribe
from .normalize import normalize_text
from .extract import (
    extract_issue_category,
    extract_severity
)
from .location import extract_location_phrase
from .geocode import resolve_location
def process_report(
    input_data: dict,
    gazetteer_rows: list[dict]
) -> dict:

    # -------------------------
    # 1. INPUT
    # -------------------------

    is_audio = "audio_path" in input_data

    if is_audio:
        raw_text = transcribe(
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

    field_scores = [
        0.9 if issue_category else 0.3,
        (
            location_resolved["confidence"]
            if location_resolved
            else 0.2
        )
    ]

    confidence_overall = round(
        sum(field_scores) / len(field_scores),
        2
    )


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