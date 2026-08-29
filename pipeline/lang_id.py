import re


# ── Script ranges ────────────────────────────────────────────────────────────
DEVANAGARI = re.compile(r"[\u0900-\u097F]")
LATIN_WORD  = re.compile(r"[a-zA-Z]")

# ── Marathi function-word markers ────────────────────────────────────────────
MARATHI_MARKERS = [
    "आहे", "नाही", "मला", "तुम्ही", "काय", "गाव",
    "आमच्या", "आमच्या", "त्यांनी", "होते", "केले",
    "आम्हाला", "आमच्या", "झाले", "असे", "तसे",
    "जवळ", "च्या", "ला", "ना", "हो",
]

# ── Hindi function-word markers (Devanagari) ─────────────────────────────────
HINDI_DEVA_MARKERS = [
    "है", "हैं", "था", "थे", "की", "के", "का",
    "में", "से", "को", "पर", "और", "भी", "नहीं",
    "हमारे", "हमारा", "यहाँ", "वहाँ", "बहुत",
]

# ── Hinglish / Hindi-Latin markers ──────────────────────────────────────────
HINDI_LATIN_MARKERS = [
    "hai", "nahi", "gaon", "sadak", "paani", "pani",
    "bahut", "kharab", "baarish", "rasta", "ganda",
    "nala", "bijli", "sarkaar", "doctor", "aspatal",
    "theek", "achha", "zyada", "bilkul",
]


def detect_language(text: str) -> str:
    """
    Rule-based language identification.

    Returns one of:
        mr-Deva  — Marathi in Devanagari
        hi-Deva  — Hindi in Devanagari
        hi-Latn  — Hindi / Hinglish in Latin script
        mixed    — Code-mixed (both Devanagari and Latin present)
        en       — English
    """
    if not text or not text.strip():
        return "en"

    text = text.strip()

    has_devanagari = bool(DEVANAGARI.search(text))
    has_latin_words = bool(re.search(r"[a-zA-Z]{2,}", text))  # ≥2 Latin chars

    # ── Code-mixed: both scripts present ────────────────────────────────────
    if has_devanagari and has_latin_words:
        return "mixed"

    # ── Pure Devanagari ──────────────────────────────────────────────────────
    if has_devanagari:
        # Count Marathi vs Hindi markers
        marathi_hits = sum(1 for m in MARATHI_MARKERS if m in text)
        hindi_hits   = sum(1 for m in HINDI_DEVA_MARKERS if m in text)

        if marathi_hits > hindi_hits:
            return "mr-Deva"
        return "hi-Deva"

    # ── Latin script ─────────────────────────────────────────────────────────
    text_lower = text.lower()
    if any(marker in text_lower for marker in HINDI_LATIN_MARKERS):
        return "hi-Latn"

    return "en"