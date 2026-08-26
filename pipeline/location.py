LOCATION_TRIGGERS = [
    "gaon",
    "village",
    "ward",
    "block",
    "near",
    "गांव",
    "गाव",
    "जवळ",
    "पास"
]


def extract_location_phrase(
    text: str
) -> str | None:

    words = text.split()

    for i, word in enumerate(words):

        if word.lower() in LOCATION_TRIGGERS:

            window = words[
                max(0, i - 2): i + 3
            ]

            return " ".join(window)

    return None