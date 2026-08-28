import sys

from text_normalizer import normalize_text

sys.stdout.reconfigure(encoding="utf-8")

TEST_CASES = [
    "umm sadak mein bahut gaddha hai",
    "you know the water problem is very bad na",
    "gaanv mein paani nahi hai",
    "road is bad???!!",
    "matlab yeh problem bahut purani hai",
    "  extra   spaces   everywhere  ",
    "",
    "clean text with no issues",
]


def run():
    for i, text in enumerate(TEST_CASES, start=1):
        result = normalize_text(text)
        display_input = text if text else "(empty string)"
        display_output = result if result else "(empty string)"
        print(f"{i}. before: {display_input}")
        print(f"   after : {display_output}")
        print()


if __name__ == "__main__":
    run()
