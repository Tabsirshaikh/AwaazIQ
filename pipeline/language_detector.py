"""
Fast, rule-based language detection for short citizen-complaint text.

Covers Marathi, Hindi, and English, since this project is focused on
Maharashtra — Marathi is treated as the default/primary Indic language.

Combines Unicode script detection (Devanagari vs Latin) with curated word
lists for common Marathi and Hindi words, since in Indian civic-complaint
text a LOT of Marathi/Hindi is typed in Latin script ("sadak kharab ahe")
rather than Devanagari. Pure script-range checking alone would misclassify
that as English, so any word matching a marker list below counts as an
Indic-language signal even when written in Latin letters.

Marathi and Hindi share a huge amount of vocabulary, especially once
romanized, so this is inherently approximate — good enough for an MVP,
not a substitute for a real statistical language ID model. Where a
Devanagari word doesn't match either language's specific marker list, it
defaults to Marathi ("mr"), since that's this project's primary language.
"""

import re

DEVANAGARI_RE = re.compile(r"[ऀ-ॿ]")
LATIN_RE = re.compile(r"[A-Za-z]")
NON_WORD_RE = re.compile(r"[^\wऀ-ॿ]")

# Devanagari-spelling markers. Marathi and Hindi spell many function words
# differently even though they share the same script, so these are safe.
MARATHI_DEVANAGARI_MARKERS = {
    "आहे", "आहेत", "नाही", "मला", "तुम्ही", "तुला", "त्याला", "तिला",
    "काय", "कसे", "कुठे", "कधी", "किती", "कोण", "आणि", "पण", "झाले",
    "झाला", "झाली", "होते", "होता", "होती", "करा", "करतो", "करते",
    "पाहिजे", "माझा", "माझी", "तुझा", "आपला", "त्याचा", "तिचा", "गाव",
    "आम्ही", "चांगला", "चांगले", "बरोबर",
}

HINDI_DEVANAGARI_MARKERS = {
    "है", "हैं", "नहीं", "मुझे", "तुम", "आप", "उसे", "उसको", "क्या",
    "कैसे", "कहाँ", "कब", "कितना", "कौन", "और", "लेकिन", "हुआ", "हुई",
    "था", "थी", "थे", "करो", "करता", "करती", "चाहिए", "मेरा", "मेरी",
    "तेरा", "अपना", "उसका", "उसकी", "गांव", "हम", "अच्छा", "ठीक",
}

# Romanized markers. Deliberately excludes short words that collide with
# common English words (e.g. "the", "my", "is", "a"). Two exceptions:
# "par" (Hindi "on") and "var" (Marathi "on") are real English words too,
# but given this project's heavy Hindi/Marathi skew, biasing toward Indic
# classification is the intended tradeoff (see module docstring).
MARATHI_LATIN_MARKERS = {
    "ahe", "aahe", "mala", "tumhi", "tula", "tyala", "tila", "kay",
    "kase", "kashi", "kuthe", "kadhi", "kiti", "kon", "zala", "zali",
    "jhala", "jhali", "karto", "karte", "kartoy", "pahije", "aplya",
    "tyacha", "ticha", "amhi", "amcha", "amchi", "amche", "amchya",
    "tumcha", "tumchi", "tumche", "tyancha", "tyanchi", "changla",
    "changle", "barobar", "mahit", "hava", "have", "gharat", "rasta",
    "gaav", "gavat", "ani", "madhe", "madhye", "var", "houn",
}

HINDI_LATIN_MARKERS = {
    "hai", "hain", "nahi", "nahin", "kya", "kyun", "kyu", "kaise", "kahan",
    "kab", "kaun", "kitna", "kitne", "bahut", "bohot", "thoda", "zyada",
    "jyada", "accha", "achha", "theek", "thik", "chahiye", "karo", "kar",
    "karna", "kiya", "kijiye", "raha", "rahi", "rahe", "tha", "thi",
    "gaya", "gayi", "gaye", "mila", "milega", "milegi", "milte",
    "hoga", "hogi", "honge", "mera", "meri", "mere", "tera", "teri",
    "tere", "apna", "apni", "apne", "hamara", "hamari", "tumhara",
    "unka", "iska", "uska", "yaha", "yahan", "wahan", "wahin", "idhar",
    "udhar", "abhi", "phir", "lekin", "magar", "sirf", "bas", "paani",
    "pani", "sadak", "gaddha", "gadha", "gaon", "gaanv", "kharab",
    "kharaab", "bijli", "samasya", "paisa", "rupaye", "ghar", "subah",
    "sham", "raat", "roz", "bhar",
    "mein", "ka", "ki", "ke", "se", "ko", "par", "aur", "hoon", "hun",
}


def detect_language(text: str) -> str:
    if not text or not text.strip():
        return "en"

    mr_signal = False
    hi_signal = False
    deva_generic = False
    en_signal = False

    for word in text.strip().split():
        clean = NON_WORD_RE.sub("", word)
        if not clean:
            continue

        if DEVANAGARI_RE.search(clean):
            if clean in MARATHI_DEVANAGARI_MARKERS:
                mr_signal = True
            elif clean in HINDI_DEVANAGARI_MARKERS:
                hi_signal = True
            else:
                deva_generic = True
        elif LATIN_RE.search(clean):
            lower = clean.lower()
            if lower in MARATHI_LATIN_MARKERS:
                mr_signal = True
            elif lower in HINDI_LATIN_MARKERS:
                hi_signal = True
            else:
                en_signal = True
        # else: pure digits/symbols, no script signal

    indic_signal = mr_signal or hi_signal or deva_generic

    if indic_signal and en_signal:
        return "mixed"
    if mr_signal:
        return "mr"
    if hi_signal:
        return "hi"
    if deva_generic:
        return "mr"
    if en_signal:
        return "en"
    return "en"
