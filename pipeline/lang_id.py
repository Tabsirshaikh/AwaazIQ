import re


DEVANAGARI = re.compile(r"[\u0900-\u097F]")

MARATHI_MARKERS = [
    "आहे",
    "मला",
    "तुम्ही",
    "काय",
    "नाही",
    "गाव",
]

HINDI_LATIN_MARKERS = [
    "hai",
    "nahi",
    "gaon",
    "sadak",
    "paani",
    "bahut",
    "kharab",
]


def detect_language(text: str) -> str:
    """
    Basic rule-based language identification.

    Returns:
        mr-Deva : Marathi written in Devanagari
        hi-Deva : Hindi written in Devanagari
        hi-Latn : Hindi/Hinglish written in Latin script
        en      : English
    """

    if not text or not text.strip():
        return "en"

    text = text.strip()

    # Check Devanagari
    if DEVANAGARI.search(text):

        # Marathi indicators
        if any(marker in text for marker in MARATHI_MARKERS):
            return "mr-Deva"

        # Otherwise treat Devanagari as Hindi for MVP
        return "hi-Deva"

    # Check Hindi/Hinglish written using English alphabet
    text_lower = text.lower()

    if any(
        marker in text_lower
        for marker in HINDI_LATIN_MARKERS
    ):
        return "hi-Latn"

    # Default
    return "en"