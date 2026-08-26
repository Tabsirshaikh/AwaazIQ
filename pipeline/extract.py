ISSUE_KEYWORDS = {
    "road": [
        "सड़क",
        "road",
        "रास्ता",
        "रस्ता",
        "गड्ढा",
        "pothole"
    ],

    "water": [
        "पानी",
        "पाणी",
        "water",
        "नल",
        "बोरवेल",
        "बोअरवेल"
    ],

    "health": [
        "अस्पताल",
        "दवाखाना",
        "hospital",
        "phc"
    ],

    "education": [
        "स्कूल",
        "शाळा",
        "school"
    ],
}


SEVERITY_HIGH = [
    "बहुत",
    "खूप",
    "गंभीर",
    "severe",
    "urgent",
    "बार-बार",
    "repeated"
]


def extract_issue_category(text: str) -> str | None:

    t = text.lower()

    for category, keywords in ISSUE_KEYWORDS.items():

        if any(
            keyword.lower() in t
            for keyword in keywords
        ):
            return category

    return None


def extract_severity(
    text: str,
    duplicate_count: int = 0
) -> str:

    t = text.lower()

    if (
        any(
            keyword.lower() in t
            for keyword in SEVERITY_HIGH
        )
        or duplicate_count > 5
    ):
        return "high"

    return "medium"