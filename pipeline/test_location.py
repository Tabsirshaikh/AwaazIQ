import sys

from location import extract_location_phrase

sys.stdout.reconfigure(encoding="utf-8")

TEST_CASES = [
    ("water problem near Kagal chowk", "English trigger 'near'"),
    ("Hamare gaon mein bahut samasya hai", "Romanized trigger 'gaon'"),
    ("आमच्या गावात पाणी नाही", "Devanagari trigger 'गावात'... should NOT match (not exact 'गाव')"),
    ("आमच्या गाव मध्ये पाणी नाही", "Devanagari trigger 'गाव' exact word"),
    ("water problem near, Kagal chowk.", "trigger word with attached punctuation"),
    ("no trigger words in this sentence at all", "no match -> None"),
]


def run():
    for text, note in TEST_CASES:
        result = extract_location_phrase(text)
        print(f"[{note}]")
        print(f"  input : {text}")
        print(f"  result: {result}")
        print()


if __name__ == "__main__":
    run()
