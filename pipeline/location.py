import re

# ── Trigger words that often precede/surround a location name ────────────────
LOCATION_TRIGGERS_EN = [
    "village", "gaon", "gram", "ward", "block",
    "near", "in", "at", "of", "from", "mein",
    "district", "tehsil", "taluka", "panchayat",
]

LOCATION_TRIGGERS_HI = [
    # Devanagari
    "गांव", "गाव", "गाँव", "ग्राम", "वार्ड", "ब्लॉक",
    "जवळ", "पास", "में", "मे", "के", "की",
    "जिला", "तहसील", "पंचायत", "तालुका",
]

ALL_TRIGGERS = set(
    [t.lower() for t in LOCATION_TRIGGERS_EN]
    + LOCATION_TRIGGERS_HI
)

# ── Devanagari word pattern (for proper-noun heuristic) ──────────────────────
_DEVA_WORD = re.compile(r"[\u0900-\u097F]+")

# ── Stopwords to exclude from Devanagari proper-noun detection ───────────────
DEVA_STOPWORDS = {
    "है", "हैं", "था", "थे", "की", "के", "का", "में", "से", "को", "पर",
    "और", "भी", "नहीं", "यह", "वह", "हम", "आप", "यहाँ", "वहाँ", "बहुत",
    "गंभीर", "खराब", "पानी", "सड़क", "अस्पताल", "स्कूल", "बोरवेल", "नल",
    "आहे", "नाही", "मला", "गाव", "पाणी", "रस्ता",
}

# Words to strip from the returned phrase so the geocoder gets a clean name
PHRASE_NOISE_WORDS = {
    "mein", "me", "near", "in", "at", "of", "from", "the",
    "village", "gaon", "gram", "ward", "block", "district",
    "tehsil", "taluka", "panchayat", "ke", "ki", "ka",
}


def _clean_phrase(phrase: str) -> str:
    """
    Remove noise trigger/function words so the geocoder sees only the
    proper-noun part (e.g. 'Baramati mein road' -> 'Baramati').
    """
    tokens = phrase.split()
    cleaned = [
        t for t in tokens
        if t.lower().strip(".,!?;:") not in PHRASE_NOISE_WORDS
    ]
    return " ".join(cleaned).strip() or phrase  # fall back to original if all stripped


def extract_location_phrase(text: str) -> str | None:
    """
    Extract the most likely location phrase from a normalised complaint string.

    Strategy (in priority order):
    1. Trigger-word window: find a known trigger word and grab the 2-word window
       around it — this captures "near Karvir village", "gaon Karve", etc.
    2. Capitalised Latin word sequence: in English/Hinglish text, a run of
       Title-Case words not at the start of the sentence is likely a proper noun.
    3. Devanagari proper-noun heuristic: a Devanagari word that is NOT in the
       stopword list and appears after a trigger word.

    Returns None if no location phrase can be found.
    """
    words = text.split()

    # ── Strategy 1: trigger-word window ─────────────────────────────────────
    for i, word in enumerate(words):
        clean = word.strip(".,!?;:")
        if clean.lower() in ALL_TRIGGERS or clean in ALL_TRIGGERS:
            window = words[max(0, i - 2): i + 4]
            phrase = " ".join(window).strip(".,!?;: ")
            if phrase:
                return _clean_phrase(phrase) or phrase

    # -- Strategy 2: capitalised Latin sequence (>=1 title-case word, not pos 0)
    cap_pattern = re.compile(r"(?<!\A)(?<!\. )([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)")
    match = cap_pattern.search(text)
    if match:
        return _clean_phrase(match.group(1).strip())

    # -- Strategy 2b: sentence-initial Title-Case word that looks like a place
    # (handles "Baramati mein..." where Baramati is at position 0)
    if words and re.match(r"^[A-Z][a-z]{2,}$", words[0]):
        candidate = words[0]
        if candidate.lower() not in PHRASE_NOISE_WORDS:
            return candidate

    # -- Strategy 3: Devanagari word not in stopword list
    deva_words = _DEVA_WORD.findall(text)
    for dw in deva_words:
        if dw not in DEVA_STOPWORDS and len(dw) >= 3:
            return dw

    return None