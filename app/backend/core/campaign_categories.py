"""
Canonical campaign category slugs for validation (keep in sync with frontend `campaignCategories.ts`).
"""

# fmt: off
CAMPAIGN_CATEGORY_SLUGS: tuple[str, ...] = (
    "environment",
    "health",
    "education",
    "food",
    "animals",
    "community",
    "arts",
    "sports",
    "disaster",
    "housing",
    "justice",
    "innovation",
    "children",
    "memorial",
    "faith",
    "veterans",
    "women",
)
# fmt: on

CAMPAIGN_CATEGORY_SET = frozenset(CAMPAIGN_CATEGORY_SLUGS)

# Common model outputs → slug
_CATEGORY_ALIASES: dict[str, str] = {
    "animal": "animals",
    "wildlife": "animals",
    "hunger": "food",
    "food_security": "food",
    "foodandhunger": "food",
    "food_hunger": "food",
    "tech": "innovation",
    "technology": "innovation",
    "stem": "innovation",
    "startup": "innovation",
    "human_rights": "justice",
    "civil_rights": "justice",
    "legal": "justice",
    "emergency": "disaster",
    "relief": "disaster",
    "culture": "arts",
    "music": "arts",
    "art": "arts",
    "kids": "children",
    "youth": "children",
    "lgbtq": "justice",
    "medical": "health",
    "healthcare": "health",
    "climate": "environment",
    "nature": "environment",
    "local": "community",
    "neighborhood": "community",
    "memorial_fund": "memorial",
    "tribute": "memorial",
}


def normalize_campaign_category(raw: str | None) -> tuple[str, list[str]]:
    """
    Map free-form model output to a whitelist slug.

    Returns:
        (slug, notes) where notes describe coercions for optional UI display.
    """
    notes: list[str] = []
    if not raw or not str(raw).strip():
        return "community", ["category was empty; defaulted to community"]

    s = str(raw).strip().lower().replace("-", "_")
    s = "".join(c if c.isalnum() or c == "_" else "_" for c in s)
    while "__" in s:
        s = s.replace("__", "_")
    s = s.strip("_")

    if s in CAMPAIGN_CATEGORY_SET:
        return s, notes

    if s in _CATEGORY_ALIASES:
        mapped = _CATEGORY_ALIASES[s]
        notes.append(f'category "{raw}" mapped to {mapped}')
        return mapped, notes

    # Longer user strings: only treat as a match if the canonical slug appears as a substring
    # (avoid short false positives like "men" inside "women").
    if len(s) >= 4:
        for slug in CAMPAIGN_CATEGORY_SLUGS:
            if len(slug) >= 4 and slug in s:
                notes.append(f'category "{raw}" matched to {slug}')
                return slug, notes

    notes.append(f'category "{raw}" unknown; defaulted to community')
    return "community", notes
