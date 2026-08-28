import sys

from language_detector import detect_language

sys.stdout.reconfigure(encoding="utf-8")

TEST_CASES = [
    ("सड़क में बहुत गड्ढे हैं", "pure Hindi"),
    ("The road has many potholes", "pure English"),
    ("Yaha bahut paani bhar gaya hai", "Romanized Hindi"),
    ("पानी की समस्या है, please fix karo", "genuinely code-mixed"),
    ("Water problem in Karvir village", "pure English with place name"),
    ("गड्ढा है road पर", "mixed script"),
    ("", "empty string"),
    ("123456", "just numbers"),
    ("बोरवेल खराब है", "pure Hindi"),
    ("Sadak bahut kharab hai near my house", "Romanized Hindi mixed with English"),
    ("रस्ता खूप खराब आहे", "pure Marathi"),
    ("Amchya gavat pani nahi ahe", "Romanized Marathi"),
    ("पाणी नाही, please fix karo", "Marathi/English code-mixed"),
    ("Rasta kharab ahe near the school", "Romanized Marathi mixed with English"),
]


def run():
    for i, (text, note) in enumerate(TEST_CASES, start=1):
        result = detect_language(text)
        display_text = text if text else "(empty string)"
        print(f"{i:2}. [{note}]")
        print(f"    input : {display_text}")
        print(f"    result: {result}")
        print()


if __name__ == "__main__":
    run()
