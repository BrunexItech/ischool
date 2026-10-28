"""Each campus's own classes: the stream letter and the name the school gave it, e.g. "Grade 9 A (Strivers)".
A grade with no entry here gets a single class named after the grade; add entries as the school confirms them."""

CLASS_PLANS: dict[str, dict[str, list[tuple[str, str]]]] = {
    "milai-north": {
        "G9": [("A", "Strivers"), ("B", "Achievers")],
        "G8": [("A", "Titans")],
        "G7": [("B", "Olympia")],
        "G6": [("A", "Angels"), ("B", "Pinnacles")],
        "G5": [("A", "Virtous")],
    },
    "milai-elgon-view": {
        "DC": [("A", "Malaika")],
        "PG": [("A", "Furaha"), ("B", "Upendo"), ("C", "Amani")],
        "PP1": [("A", "Huruma"), ("B", "Tumaini"), ("C", "Rehema")],
        "PP2": [("A", "Imani"), ("B", "Neema"), ("C", "Baraka")],
        "G1": [("A", "Subira"), ("B", "Shukrani"), ("C", "Uaminifu")],
        "G2": [("A", "Bidii"), ("B", "Umoja"), ("C", "Hekima")],
        "G3": [("A", "Busara"), ("B", "Shujaa"), ("C", "Hodari")],
    },
}


def classes_for(slug: str, grade_code: str, grade_name: str) -> list[str]:
    """The class names a campus has for one grade."""
    plan = CLASS_PLANS.get(slug, {}).get(grade_code)
    if not plan:
        return [grade_name]
    return [f"{grade_name} {letter} ({nick})" for letter, nick in plan]
