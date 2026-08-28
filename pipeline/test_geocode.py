import sys

from geocode import resolve_location

sys.stdout.reconfigure(encoding="utf-8")

GAZETTEER_ROWS = [
    {"name": "Kagal", "district": "Kolhapur", "block": None, "latitude": 16.5833, "longitude": 74.3167},
    {"name": "Ichalkaranji", "district": "Kolhapur", "block": None, "latitude": 16.6910, "longitude": 74.4600},
    {"name": "Sinnar", "district": "Nashik", "block": None, "latitude": 19.8500, "longitude": 74.0000},
]


def run():
    cases = [
        ("Kagal village", "close fuzzy match should resolve"),
        ("Ichalkarnji", "typo'd name should still fuzzy-match"),
        (None, "no location phrase -> None"),
        ("some totally unrelated phrase xyz", "no good match -> None"),
    ]

    for phrase, note in cases:
        result = resolve_location(phrase, GAZETTEER_ROWS)
        print(f"[{note}]")
        print(f"  input : {phrase!r}")
        print(f"  result: {result}")
        print()

    print("empty gazetteer_rows case:")
    print(" ", resolve_location("Kagal", []))


if __name__ == "__main__":
    run()
