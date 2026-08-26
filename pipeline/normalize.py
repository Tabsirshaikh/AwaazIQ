import re


FILLERS = [
    "umm",
    "matlab",
    "you know",
    "actually",
    "मतलब",
    "यानी"
]


TRANSLIT_MAP = {
    "gaanv": "gaon",
    "gaaon": "gaon",
    "sadak": "road",
    "saDak": "road"
}


def normalize_text(text: str) -> str:

    t = text.strip()

    for filler in FILLERS:
        t = re.sub(
            rf"\b{re.escape(filler)}\b",
            "",
            t,
            flags=re.IGNORECASE
        )

    for wrong, right in TRANSLIT_MAP.items():
        t = re.sub(
            rf"\b{wrong}\b",
            right,
            t,
            flags=re.IGNORECASE
        )

    return re.sub(
        r"\s+",
        " ",
        t
    ).strip()