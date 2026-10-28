"""The Kenyan Competency Based Curriculum, as each level actually teaches it: learning areas and how many
lessons a week each gets in a 40-lesson week (20 for pre-primary)."""

# Pre-primary (PP1, PP2)
PRE_PRIMARY = {
    "Language Activities": 5,
    "Mathematical Activities": 5,
    "Environmental Activities": 4,
    "Psychomotor and Creative Activities": 4,
    "Religious Education Activities": 2,
}
# Lower primary (Grades 1 to 3)
LOWER_PRIMARY = {
    "English Language Activities": 7,
    "Kiswahili Language Activities": 6,
    "Indigenous Language Activities": 3,
    "Mathematical Activities": 8,
    "Environmental Activities": 6,
    "Hygiene and Nutrition Activities": 3,
    "Religious Education Activities": 3,
    "Movement and Creative Activities": 4,
}
# Upper primary (Grades 4 to 6)
UPPER_PRIMARY = {
    "English": 6,
    "Kiswahili": 5,
    "Mathematics": 7,
    "Science and Technology": 5,
    "Agriculture and Nutrition": 3,
    "Social Studies": 4,
    "Christian Religious Education": 3,
    "Creative Arts": 3,
    "Physical and Health Education": 4,
}
# Junior school (Grades 7 to 9)
JUNIOR = {
    "English": 5,
    "Kiswahili": 4,
    "Mathematics": 6,
    "Integrated Science": 5,
    "Health Education": 2,
    "Pre-Technical Studies": 3,
    "Social Studies": 3,
    "Christian Religious Education": 2,
    "Business Studies": 2,
    "Agriculture": 2,
    "Life Skills Education": 1,
    "Sports and Physical Education": 2,
    "Visual Arts": 1,
    "Performing Arts": 1,
    "Computer Science": 1,
}
# Senior school (Grades 10 to 12): the compulsory core plus the STEM, Social Sciences and Arts pathway learning areas.
SENIOR = {
    "English": 5,
    "Kiswahili": 4,
    "Core Mathematics": 6,
    "Community Service Learning": 2,
    "Physical Education": 2,
    "Biology": 3,
    "Chemistry": 3,
    "Physics": 3,
    "Computer Studies": 2,
    "History and Citizenship": 2,
    "Geography": 2,
    "Business Studies": 2,
    "Christian Religious Education": 2,
    "Literature in English": 1,
    "Agriculture": 1,
}

BY_GRADE = {"PP1": PRE_PRIMARY, "PP2": PRE_PRIMARY, "G1": LOWER_PRIMARY, "G2": LOWER_PRIMARY, "G3": LOWER_PRIMARY,
            "G4": UPPER_PRIMARY, "G5": UPPER_PRIMARY, "G6": UPPER_PRIMARY, "G7": JUNIOR, "G8": JUNIOR, "G9": JUNIOR,
            "G10": SENIOR, "G11": SENIOR, "G12": SENIOR}

# Who teaches what beyond the class teacher. In primary the class teacher takes most learning areas; the specialists
# below take the rest. In junior and senior school every learning area has a subject teacher.
PRIMARY_SPECIALISTS = {
    "Psychomotor and Creative Activities": "arts", "Movement and Creative Activities": "pe",
    "Creative Arts": "arts", "Physical and Health Education": "pe",
    "Kiswahili": "kiswahili", "Kiswahili Language Activities": "kiswahili",
}
SECONDARY_GROUPS = {
    "languages": ["English", "Kiswahili", "Literature in English"],
    "mathematics": ["Mathematics", "Core Mathematics", "Computer Science", "Computer Studies"],
    "sciences": ["Integrated Science", "Health Education", "Agriculture", "Biology", "Chemistry", "Physics"],
    "humanities": ["Social Studies", "Christian Religious Education", "Business Studies", "Life Skills Education", "History and Citizenship", "Geography", "Community Service Learning"],
    "technical": ["Pre-Technical Studies"],
    "arts": ["Visual Arts", "Performing Arts"],
    "pe": ["Sports and Physical Education", "Physical Education"],
}
