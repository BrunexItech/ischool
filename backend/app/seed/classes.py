"""Each campus's own classes: the stream letter and the name the school gave it, e.g. "Grade 9 A (Strivers)".
A grade with no entry here gets a single class named after the grade; add entries as the school confirms them."""

def _plan(rows: str) -> dict[str, list[tuple[str, str]]]:
    """'G4: A Hekima, B Hodari; G5: A Virtous' -> {'G4': [('A', 'Hekima'), ('B', 'Hodari')], ...}"""
    out = {}
    for part in rows.split(";"):
        code, streams = part.split(":")
        out[code.strip()] = [(x.split()[0], x.split()[1]) for x in streams.split(",")]
    return out


CLASS_PLANS: dict[str, dict[str, list[tuple[str, str]]]] = {
    # North: the names the school confirmed for Grades 5 to 9; the rest reuse the school's own set of names.
    "milai-north": _plan(
        "PP1: A Malaika, B Furaha; PP2: A Imani, B Neema; G1: A Subira, B Shukrani; G2: A Bidii, B Umoja; G3: A Busara, B Shujaa; G4: A Hekima, B Hodari;"
        "G5: A Virtous; G6: A Angels, B Pinnacles; G7: B Olympia; G8: A Titans; G9: A Strivers, B Achievers"
    ),
    "milai-east": _plan(
        "PP1: A Tumaini, B Rehema; PP2: A Baraka, B Amani; G1: A Uaminifu, B Subira; G2: A Shukrani, B Busara; G3: A Bidii, B Shujaa; G4: A Umoja, B Hekima;"
        "G5: A Angels, B Pinnacles; G6: A Strivers, B Achievers; G7: A Titans, B Olympia; G8: A Virtous, B Strivers; G9: A Achievers, B Titans"
    ),
    "milai-west": _plan(
        "PP1: A Furaha; PP2: A Upendo; G1: A Huruma; G2: A Neema; G3: A Hodari; G4: A Busara, B Subira; G5: A Angels, B Pinnacles; G6: A Titans, B Olympia;"
        "G7: A Strivers, B Achievers; G8: A Virtous, B Pinnacles; G9: A Olympia, B Angels; G10: A Titans, B Strivers; G11: A Achievers, B Olympia; G12: A Pinnacles, B Virtous"
    ),
    # Elgon View (early years): the complete list the school gave.
    "milai-elgon-view": _plan(
        "DC: A Malaika; PG: A Furaha, B Upendo, C Amani; PP1: A Huruma, B Tumaini, C Rehema; PP2: A Imani, B Neema, C Baraka;"
        "G1: A Subira, B Shukrani, C Uaminifu; G2: A Bidii, B Umoja, C Hekima; G3: A Busara, B Shujaa, C Hodari"
    ),
}


def classes_for(slug: str, grade_code: str, grade_name: str) -> list[str]:
    """The class names a campus has for one grade."""
    plan = CLASS_PLANS.get(slug, {}).get(grade_code)
    if not plan:
        return [grade_name]
    return [f"{grade_name} {letter} ({nick})" for letter, nick in plan]
