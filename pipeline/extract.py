import re

# Keywords are matched against text AFTER text_normalizer.normalize_text has
# run, so romanized variants here are the canonical forms it produces (e.g.
# "sadak", "gaddha", "paani", "bijli", "kachra", "naali") rather than every
# raw spelling variant.
ISSUE_KEYWORDS = {
    "road": [
        "सड़क", "road", "रास्ता", "रस्ता", "गड्ढा", "pothole",
        "sadak", "rasta", "gaddha", "khadda", "khadde",
    ],

    "water": [
        "पानी", "पाणी", "water", "नल", "बोरवेल", "बोअरवेल",
        "paani", "borewell",
    ],

    "electricity": [
        "बिजली", "वीज", "बत्ती", "bijli", "current", "light",
        "transformer", "power",
    ],

    "sanitation": [
        "कचरा", "नाली", "गटर", "शौचालय", "kachra", "naali", "nala",
        "gutter", "toilet", "shauchalay", "garbage",
    ],

    "health": [
        "अस्पताल", "दवाखाना", "hospital", "phc", "aspatal",
        "davakhana", "clinic", "doctor",
    ],

    "education": [
        "स्कूल", "शाळा", "शाळेत", "school", "shala",
    ],
}

SEVERITY_HIGH = [
    "बहुत", "खूप", "गंभीर", "severe", "urgent", "बार-बार", "repeated",
    "तुरंत", "जल्दी", "इमरजेंसी", "turant", "emergency", "danger",
    "dangerous", "critical",
]

# Python's \b doesn't treat Devanagari vowel signs (matras) as word
# characters, so it silently fails to match at the end of most Devanagari
# words. Use whitespace/punctuation/string-edge lookarounds instead (same
# fix as text_normalizer.py).
_BOUNDARY_CHARS = r"\s.,!?;:()\"'।"
_START = rf"(?:^|(?<=[{_BOUNDARY_CHARS}]))"
_END = rf"(?:$|(?=[{_BOUNDARY_CHARS}]))"


def _alternation_pattern(words) -> re.Pattern:
    """One compiled whole-word pattern matching any of `words`.

    Sorted longest-first because regex alternation is leftmost-first, not
    longest-match. The trailing "s?" handles simple English plurals
    (pothole/potholes) without enumerating every plural as its own keyword.
    """
    alternatives = "|".join(re.escape(w) for w in sorted(words, key=len, reverse=True))
    return re.compile(_START + "(?:" + alternatives + ")s?" + _END, flags=re.IGNORECASE)


# Built once at import rather than recompiling one pattern per keyword on
# every call (~55 separate regex searches per report, previously).
CATEGORY_PATTERNS = {
    category: _alternation_pattern(keywords)
    for category, keywords in ISSUE_KEYWORDS.items()
}
SEVERITY_HIGH_RE = _alternation_pattern(SEVERITY_HIGH)


def extract_issue_category(text: str) -> str | None:
    """The category with the most keyword hits wins.

    Previously this returned the first category with *any* match, in plain
    dict order -- so "sadak ke paas hospital hai, doctor nahi, clinic band"
    came back as road (one hit) purely because road is declared before
    health (three hits). Counting hits picks the category the text is
    actually about; ties still fall back to declaration order, which keeps
    genuinely-ambiguous reports behaving as before.
    """
    best_category = None
    best_count = 0

    for category, pattern in CATEGORY_PATTERNS.items():
        count = len(pattern.findall(text))
        if count > best_count:
            best_category = category
            best_count = count

    return best_category


def extract_severity(text: str, duplicate_count: int = 0) -> str:
    if SEVERITY_HIGH_RE.search(text) is not None or duplicate_count > 5:
        return "high"

    return "medium"
