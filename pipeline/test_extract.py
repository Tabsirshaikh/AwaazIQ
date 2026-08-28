import sys

from extract import extract_issue_category, extract_severity

sys.stdout.reconfigure(encoding="utf-8")

CATEGORY_CASES = [
    ("sadak mein bahut gaddha hai", "road"),
    ("paani ki samasya hai", "water"),
    ("bijli nahi hai", "electricity"),
    ("current bahut baar jata hai", "electricity"),
    ("kachra bahut din se nahi utha", "sanitation"),
    ("hospital bahut door hai", "health"),
    ("shala mein sadak nahi hai", "road"),  # both match; road checked first
    ("सड़क में गड्ढा है", "road (Devanagari)"),
    ("some random unrelated sentence", None),
]

SEVERITY_CASES = [
    ("yeh bahut urgent hai please turant fix karo", "high"),
    ("normal complaint about a small issue", "medium"),
]


def run():
    print("=== extract_issue_category ===")
    for text, expected in CATEGORY_CASES:
        result = extract_issue_category(text)
        print(f"{text!r} -> {result}  (expected: {expected})")

    print("\n=== extract_severity ===")
    for text, expected in SEVERITY_CASES:
        result = extract_severity(text)
        print(f"{text!r} -> {result} (expected {expected})")


if __name__ == "__main__":
    run()
