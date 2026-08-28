import sqlite3
import sys
from pathlib import Path

from pipeline.main import process_report

sys.stdout.reconfigure(encoding="utf-8")

DB_PATH = Path(__file__).resolve().parent.parent / "backend" / "hackathon.db"

TEST_CASES = [
    # --- original 5 ---
    {"text": "Hamare gaon mein road bahut kharab hai", "expect_category": "road"},
    {"text": "बारिश में सड़क बंद हो जाती है", "expect_category": "road"},
    {"text": "आमच्या गावात पाणी नाही", "expect_category": "water"},
    {"text": "The road connecting our village to the highway is unusable", "expect_category": "road"},
    {"text": "hospital bahut door hai", "expect_category": "health"},

    # --- Hindi (Devanagari) ---
    {"text": "सड़क में बहुत गड्ढे हैं", "expect_category": "road", "expect_language": "hi"},
    {"text": "हमारे गांव में पानी नहीं है", "expect_category": "water", "expect_language": "hi"},
    {"text": "बिजली नहीं आ रही है तीन दिन से", "expect_category": "electricity", "expect_language": "hi"},
    {"text": "स्कूल में शिक्षक नहीं है", "expect_category": "education", "expect_language": "hi"},
    {"text": "अस्पताल बहुत दूर है", "expect_category": "health", "expect_language": "hi"},
    {"text": "गली में कचरा पड़ा है", "expect_category": "sanitation", "expect_language": "hi"},

    # --- English ---
    {"text": "The water supply has been cut off for a week", "expect_category": "water", "expect_language": "en"},
    {"text": "There is no doctor available at the health center", "expect_category": "health", "expect_language": "en"},
    {"text": "Garbage collection has stopped near our colony", "expect_category": "sanitation", "expect_language": "en"},
    {"text": "The transformer near our street is broken", "expect_category": "electricity", "expect_language": "en"},
    {"text": "Our school building roof is leaking", "expect_category": "education", "expect_language": "en"},
    {"text": "Potholes on the highway are causing accidents", "expect_category": "road", "expect_language": "en"},

    # --- Marathi (Devanagari) ---
    {"text": "आमच्या गावात रस्ता खूप खराब आहे", "expect_category": "road", "expect_language": "mr"},
    {"text": "पाणी पुरवठा बंद आहे", "expect_category": "water", "expect_language": "mr"},
    {"text": "शाळेत शिक्षक नाहीत", "expect_category": "education", "expect_language": "mr"},
    {"text": "दवाखाना खूप लांब आहे", "expect_category": "health", "expect_language": "mr"},

    # --- Romanized Hindi/Marathi ---
    {"text": "sadak bahut kharab hai near Kagal village", "expect_category": "road"},
    {"text": "paani ki bahut samasya hai gaon mein", "expect_category": "water"},
    {"text": "bijli nahi hai kal se", "expect_category": "electricity"},
    {"text": "rasta kharab ahe amchya gavat", "expect_category": "road", "expect_language": "mr"},
    {"text": "kachra utha nahi raha kai dino se", "expect_category": "sanitation"},

    # --- code-mixed ---
    {"text": "पानी की समस्या है, please send a tanker", "expect_category": "water", "expect_language": "mixed"},
    {"text": "road is very kharab, please fix karo", "expect_category": "road", "expect_language": "mixed"},
    {"text": "hospital mein doctor nahi hai, very bad service", "expect_category": "health", "expect_language": "mixed"},
    {"text": "school madhe shikshak nahi, please help", "expect_category": "education"},

    # --- ambiguous / dual-category (first match by dict order wins: road before water) ---
    {"text": "paani aur sadak dono kharab hain gaon mein", "expect_category": "road"},

    # --- no issue keyword at all ---
    {"text": "kuch samasya hai par pata nahi kya", "expect_category": None},
    {"text": "everything is fine here, just checking in", "expect_category": None},

    # --- deliberately ambiguous / unresolvable locations (>= 3, per the plan) ---
    {"text": "sadak kharab hai near XYZ nonexistent market", "expect_category": "road", "expect_location_none": True},
    {"text": "paani ki samasya hai near Zzqqxx village", "expect_category": "water", "expect_location_none": True},
    {"text": "bijli nahi hai near Notarealplace town", "expect_category": "electricity", "expect_location_none": True},

    # --- misspelled-but-close real location (fuzzy match should still work) ---
    {"text": "sadak kharab hai near Kolapur", "expect_category": "road"},

    # --- empty / degenerate text, should not crash ---
    {"text": "", "expect_category": None},
    {"text": "123456", "expect_category": None},

    # --- plural keyword forms (regression check for the "potholes" gap) ---
    {"text": "so many potholes on our street", "expect_category": "road", "expect_language": "en"},
]


def load_real_gazetteer_rows() -> list[dict]:
    if not DB_PATH.exists():
        print(f"(no database found at {DB_PATH}, testing with empty gazetteer)\n")
        return []

    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    rows = [dict(r) for r in con.execute("SELECT * FROM gazetteer").fetchall()]
    con.close()
    return rows


def run_tests(gazetteer_rows):
    passed = 0

    for case in TEST_CASES:
        result = process_report({"text": case["text"]}, gazetteer_rows)

        checks = []
        if "expect_category" in case:
            checks.append(("category", result["issue_category"] == case["expect_category"]))
        if "expect_language" in case:
            checks.append(("language", result["language_detected"] == case["expect_language"]))
        if case.get("expect_location_none"):
            checks.append(("location_none", result["location_resolved"] is None))

        case_passed = all(ok for _, ok in checks)
        if case_passed:
            passed += 1
            status = "PASS"
        else:
            failed = ", ".join(name for name, ok in checks if not ok)
            status = f"FAIL ({failed})"

        display_text = case["text"] if case["text"] else "(empty string)"
        print(
            f"{status}: {display_text[:55]!r} "
            f"-> category={result['issue_category']} "
            f"lang={result['language_detected']} "
            f"location={result['location_resolved']['village'] if result['location_resolved'] else None}"
        )

    print(f"\n{passed}/{len(TEST_CASES)} passed")


if __name__ == "__main__":
    run_tests(gazetteer_rows=load_real_gazetteer_rows())
