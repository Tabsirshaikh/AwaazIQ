import re

LOCATION_TRIGGERS = {
    "gaon", "village", "ward", "block", "near", "taluka", "tehsil",
    "colony", "nagar", "gali", "chowk",
    "गांव", "गाव", "जवळ", "पास", "तालुका", "जिल्हा", "वस्ती", "पाडा",
    "मोहल्ला", "गली", "चौक", "नगर", "जिला",
}

_STRIP_PUNCT_RE = re.compile(r"^[^\wऀ-ॿ]+|[^\wऀ-ॿ]+$")


def extract_location_phrase(text: str) -> str | None:
    words = text.split()

    for i, word in enumerate(words):
        bare_word = _STRIP_PUNCT_RE.sub("", word).lower()

        if bare_word in LOCATION_TRIGGERS:
            window = words[max(0, i - 2): i + 3]
            return " ".join(window)

    return None
