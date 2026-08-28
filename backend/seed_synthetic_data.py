"""
Generates realistic synthetic citizen_request rows (is_synthetic=True) so
the demo has volume beyond what a few people can generate live by hand.

Village selection is weighted by real Census population (gazetteer.population,
loaded by load_demographic_data.py) rather than uniform random, so the
geographic distribution on the map actually reflects where people live
instead of looking artificially even.

Each synthetic complaint is a template sentence naming a real village, run
through the actual process_report() pipeline (not hand-assigned fields), so
language/category/severity/location come out exactly as they would for a
real citizen report -- this also doubles as a load test of the pipeline at
volume.

Covers all 6 issue categories the pipeline currently supports (road, water,
electricity, sanitation, health, education) -- broader than the build
plan's Hour-0 "start with just Roads + Water" scoping note, since P1 had
already built keyword support for all 6 by the time this ran.
"""

import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline.main import process_report  # noqa: E402

from database import SessionLocal  # noqa: E402
from models import CitizenRequest, Gazetteer  # noqa: E402

TARGET_COUNT = 1000  # within the plan's 800-1500 range

# Every template places a real location.py trigger word (near/gaon/village/
# जवळ/गांव) within 2 words of {village}, matching location.py's +/-2 word
# extraction window -- otherwise extract_location_phrase never finds the
# village at all and it silently fails to geocode. Learned this the hard
# way: an earlier draft using "mein"/"se" (not real triggers) and triggers
# placed too far from the village name resolved locations for only 69% of
# rows; this version should do much better.
TEMPLATES = {
    "road": [
        "sadak bahut kharab hai near {village}",
        "bahut bada gaddha hai {village} gaon mein",
        "road is very bad near {village} village, please fix",
        "रस्ता खूप खराब आहे {village} जवळ",
        "सड़क में बड़ा गड्ढा है {village} गांव में",
    ],
    "water": [
        "paani ki bahut samasya hai near {village}",
        "pani nahi aata teen din se {village} gaon mein",
        "water supply has been cut off near {village}",
        "पाणी पुरवठा बंद आहे {village} जवळ",
        "पानी की गंभीर समस्या है {village} गांव में",
    ],
    "electricity": [
        "bijli bahut baar jati hai near {village}",
        "current nahi hai kal se {village} gaon mein",
        "power cut near {village} for two days now",
        "वीज गायब आहे {village} जवळ रोज",
        "बिजली नहीं आ रही है {village} गांव में",
    ],
    "sanitation": [
        "kachra bahut din se nahi utha near {village}",
        "garbage collection has stopped near {village}",
        "naali choked hai {village} gaon mein",
        "कचरा उचलला जात नाही {village} जवळ",
        "कचरा पड़ा है {village} गांव में",
    ],
    "health": [
        "hospital bahut door hai near {village}",
        "doctor nahi hai {village} gaon mein",
        "no doctor available near {village} health center",
        "दवाखाना खूप लांब आहे {village} जवळ",
        "अस्पताल बहुत दूर है {village} गांव में",
    ],
    "education": [
        "school mein shikshak nahi hai near {village}",
        "school ki chhat kharab hai {village} gaon mein",
        "the school near {village} village has no teachers",
        "शाळेत शिक्षक नाहीत {village} जवळ",
        "स्कूल में शिक्षक नहीं है {village} गांव में",
    ],
}

SEVERITY_BOOSTERS = ["bahut", "khoop", "urgent", "severe", "turant"]

# Villages with no population figure still exist and can still get
# complaints; give them a small flat weight instead of excluding them.
DEFAULT_WEIGHT = 50


def load_weighted_village_names(db) -> list[dict]:
    return [
        {
            "name": row.name,
            "weight": row.population if row.population and row.population > 0 else DEFAULT_WEIGHT,
        }
        for row in db.query(Gazetteer).all()
    ]


def load_gazetteer_rows(db) -> list[dict]:
    return [
        {
            "name": row.name,
            "district": row.district,
            "block": row.block,
            "latitude": row.latitude,
            "longitude": row.longitude,
        }
        for row in db.query(Gazetteer).all()
    ]


def generate_text(weighted_villages: list[dict]) -> str:
    category = random.choice(list(TEMPLATES.keys()))
    template = random.choice(TEMPLATES[category])
    village = random.choices(
        [v["name"] for v in weighted_villages],
        weights=[v["weight"] for v in weighted_villages],
        k=1,
    )[0]

    text = template.format(village=village)
    if random.random() < 0.4:
        text = f"{random.choice(SEVERITY_BOOSTERS)} {text}"
    return text


def main():
    db = SessionLocal()

    weighted_villages = load_weighted_village_names(db)
    if not weighted_villages:
        print("No gazetteer rows found -- run load_gazetteer.py first.")
        db.close()
        return

    gazetteer_rows = load_gazetteer_rows(db)

    inserted = 0
    category_counts: dict[str | None, int] = {}
    district_counts: dict[str | None, int] = {}

    for _ in range(TARGET_COUNT):
        text = generate_text(weighted_villages)
        result = process_report({"text": text}, gazetteer_rows)
        location_resolved = result.get("location_resolved") or {}

        row = CitizenRequest(
            raw_text=result["raw_text"],
            language_detected=result["language_detected"],
            issue_category=result["issue_category"],
            severity=result["severity"],
            location_raw=result["location_raw"],
            district=location_resolved.get("district"),
            block=location_resolved.get("block"),
            village=location_resolved.get("village"),
            latitude=location_resolved.get("latitude"),
            longitude=location_resolved.get("longitude"),
            confidence=result["confidence_overall"],
            is_synthetic=True,
        )
        db.add(row)
        inserted += 1

        category_counts[result["issue_category"]] = category_counts.get(result["issue_category"], 0) + 1
        district_counts[location_resolved.get("district")] = district_counts.get(location_resolved.get("district"), 0) + 1

        if inserted % 200 == 0:
            db.commit()
            print(f"  inserted {inserted}/{TARGET_COUNT}...")

    db.commit()
    db.close()

    print(f"\nInserted {inserted} synthetic citizen_request rows (is_synthetic=True).")
    print("\nCategory distribution:")
    for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
        print(f"  {cat or '(uncategorized)'}: {count}")
    print("\nDistrict resolution:")
    for district, count in sorted(district_counts.items(), key=lambda x: -x[1]):
        print(f"  {district or '(unresolved)'}: {count}")


if __name__ == "__main__":
    main()
