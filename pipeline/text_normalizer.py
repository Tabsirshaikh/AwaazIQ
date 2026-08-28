"""
Cleans raw citizen-complaint text (from speech-to-text or direct typing)
before further pipeline processing: strips filler words, normalizes common
transliteration variants, and collapses stray whitespace/punctuation.

Replaces the earlier pipeline/normalize.py, which did the same thing under
a different, smaller ruleset.
"""

import re

FILLERS = [
    "umm", "uh", "matlab", "you know", "like", "actually", "basically",
    "toh", "na", "haan",
    "मतलब", "यानी",
]

# Common transliteration variants -> one canonical spelling. Kept short and
# civic-complaint-specific per the spec; not a general transliteration model.
TRANSLIT_MAP = {
    "gaanv": "gaon",
    "gaaon": "gaon",
    "gao": "gaon",
    "sadhak": "sadak",
    "kharaab": "kharab",
    "pani": "paani",
    "gadha": "gaddha",
    "bijlee": "bijli",
    "raasta": "rasta",
    "nallah": "nala",
    "nali": "naali",
    "kachraa": "kachra",
}

REPEATED_PUNCT_RE = re.compile(r"([!?.,;:])\1+")
WHITESPACE_RE = re.compile(r"\s+")

# Python's \b treats Devanagari vowel signs (matras) as non-word characters,
# so \b silently fails to match at the end of most Devanagari words (e.g.
# "यानी" ends in the matra "ी"). Using explicit whitespace/punctuation/
# string-edge lookarounds instead of \b sidesteps that entirely.
_BOUNDARY_CHARS = r"\s.,!?;:()\"'।"
_START = rf"(?:^|(?<=[{_BOUNDARY_CHARS}]))"
_END = rf"(?:$|(?=[{_BOUNDARY_CHARS}]))"


def _alternation_pattern(words) -> re.Pattern:
    """One compiled whole-word pattern matching any of `words`.

    Sorted longest-first because regex alternation is leftmost-first, not
    longest-match: without this, a short entry could shadow a longer one
    that shares its prefix.
    """
    alternatives = "|".join(re.escape(w) for w in sorted(words, key=len, reverse=True))
    return re.compile(_START + "(?:" + alternatives + ")" + _END, flags=re.IGNORECASE)


# Built once at import, not per call: normalize_text used to compile and run
# one pattern per filler and per transliteration variant (24 separate passes
# over every string). These two collapse that to two passes.
FILLERS_RE = _alternation_pattern(FILLERS)
TRANSLIT_RE = _alternation_pattern(TRANSLIT_MAP)


def normalize_text(text: str) -> str:
    if not text or not text.strip():
        return ""

    result = FILLERS_RE.sub("", text)
    result = TRANSLIT_RE.sub(lambda m: TRANSLIT_MAP[m.group(0).lower()], result)
    result = REPEATED_PUNCT_RE.sub(r"\1", result)
    result = WHITESPACE_RE.sub(" ", result).strip()

    return result
