from rapidfuzz import process, fuzz


def resolve_location(
    location_phrase: str | None,
    gazetteer_rows: list[dict],
    threshold: int = 75
) -> dict | None:

    if not location_phrase:
        return None

    if not gazetteer_rows:
        return None

    names = [
        row["name"]
        for row in gazetteer_rows
    ]

    result = process.extractOne(
        location_phrase,
        names,
        scorer=fuzz.WRatio
    )

    if result is None:
        return None

    match, score, idx = result

    if score < threshold:
        return None

    row = gazetteer_rows[idx]

    return {
        "district": row["district"],
        "block": row["block"],
        "village": row["name"],
        "lat": row["lat"],
        "lon": row["lon"],
        "confidence": round(score / 100, 2)
    }