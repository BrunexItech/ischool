"""Sample multiple-choice questions and lesson topics, written to the CBC learning areas."""

import random

# (question, [options], index of the right option)
ENGLISH = [
    ("Choose the correct word: She ___ to school every day.", ["go", "goes", "going", "gone"], 1),
    ("Which word is a noun?", ["quickly", "table", "run", "beautiful"], 1),
    ("The opposite of 'ancient' is:", ["old", "modern", "tall", "heavy"], 1),
    ("Which sentence is written correctly?", ["we went to the market.", "We went to the market.", "we Went to the market", "We went to the Market"], 1),
    ("Choose the correct plural of 'child':", ["childs", "childes", "children", "childrens"], 2),
    ("A word that describes a verb is called an:", ["adjective", "adverb", "article", "noun"], 1),
    ("Which word rhymes with 'light'?", ["lift", "night", "late", "lit"], 1),
    ("Fill in: They ___ playing football yesterday.", ["is", "are", "was", "were"], 3),
    ("Which is a synonym of 'happy'?", ["sad", "angry", "joyful", "tired"], 2),
    ("The past tense of 'write' is:", ["writed", "wrote", "written", "writing"], 1),
]
KISWAHILI = [
    ("Wingi wa 'kitabu' ni:", ["kitabu", "vitabu", "mitabu", "bitabu"], 1),
    ("Kinyume cha 'mrefu' ni:", ["mnene", "mfupi", "mwembamba", "mkubwa"], 1),
    ("Chagua sentensi sahihi:", ["Mtoto anacheza mpira.", "Mtoto wanacheza mpira.", "Watoto anacheza mpira.", "Mtoto wanacheza mipira."], 0),
    ("Neno 'shule' ni aina gani ya neno?", ["kitenzi", "nomino", "kivumishi", "kielezi"], 1),
    ("Salamu ya asubuhi ni:", ["Usiku mwema", "Habari za asubuhi", "Kwaheri", "Pole sana"], 1),
    ("Kiswahili cha 'water' ni:", ["moto", "maji", "mkate", "maziwa"], 1),
    ("'Alikula' ni wakati gani?", ["uliopita", "uliopo", "ujao", "hali ya mazoea"], 0),
    ("Kisawe cha 'rafiki' ni:", ["adui", "swahiba", "jirani", "mgeni"], 1),
]
SCIENCE = [
    ("Which part of the plant makes food?", ["Root", "Stem", "Leaf", "Flower"], 2),
    ("Water changes to vapour through:", ["freezing", "evaporation", "melting", "condensation"], 1),
    ("Which of these is a living thing?", ["Stone", "Tree", "Table", "River"], 1),
    ("The organ that pumps blood is the:", ["lungs", "heart", "kidney", "stomach"], 1),
    ("Which gas do plants take in for photosynthesis?", ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], 2),
    ("A force that pulls objects to the ground is:", ["friction", "gravity", "magnetism", "wind"], 1),
    ("Which is a good conductor of heat?", ["Wood", "Plastic", "Iron", "Rubber"], 2),
    ("The Sun is a:", ["planet", "moon", "star", "comet"], 2),
    ("Which instrument measures temperature?", ["Ruler", "Thermometer", "Balance", "Clock"], 1),
    ("Animals that eat only plants are called:", ["carnivores", "herbivores", "omnivores", "decomposers"], 1),
]
SOCIAL = [
    ("The capital city of Kenya is:", ["Mombasa", "Kisumu", "Nairobi", "Eldoret"], 2),
    ("Which is the largest lake in Kenya?", ["Lake Turkana", "Lake Victoria", "Lake Naivasha", "Lake Baringo"], 1),
    ("The Kenyan flag has these colours except:", ["black", "red", "green", "blue"], 3),
    ("Kenya gained independence in the year:", ["1953", "1963", "1973", "1983"], 1),
    ("Which county is Eldoret town in?", ["Nakuru", "Uasin Gishu", "Kakamega", "Kisumu"], 1),
    ("The mountain that is Kenya's highest is:", ["Mt. Elgon", "Mt. Kenya", "Mt. Longonot", "Mt. Kilimanjaro"], 1),
    ("The person who leads a county is the:", ["President", "Governor", "Chief", "Principal"], 1),
    ("Which of these is a cash crop grown in Kenya?", ["Tea", "Rice paper", "Cotton wool", "Sand"], 0),
]
GENERIC = [
    ("A good way to prepare for a test is to:", ["Revise regularly", "Skip lessons", "Copy from others", "Sleep in class"], 0),
    ("Which of these shows respect to others?", ["Interrupting", "Listening", "Shouting", "Ignoring"], 1),
    ("Before starting an experiment, you should first:", ["Read the instructions", "Taste the materials", "Run away", "Mix everything"], 0),
    ("Teamwork means:", ["Working alone", "Working together", "Competing always", "Avoiding others"], 1),
    ("Which habit keeps our environment clean?", ["Littering", "Proper waste disposal", "Burning plastics", "Dumping in rivers"], 1),
    ("Keeping safe online means:", ["Sharing passwords", "Keeping passwords private", "Talking to strangers", "Clicking all links"], 1),
]


def maths(rng: random.Random, level: int, count: int = 10):
    """Arithmetic questions that grow harder with the grade level (1 = early primary)."""
    out = []
    for _ in range(count):
        kind = rng.choice(["add", "sub", "mul", "pct"] if level >= 4 else ["add", "sub", "mul"])
        if kind == "add":
            a, b = rng.randint(10 * level, 99 * level), rng.randint(10, 90 * level)
            ans, q = a + b, f"What is {a} + {b}?"
        elif kind == "sub":
            a, b = rng.randint(50 * level, 150 * level), rng.randint(10, 49 * level)
            ans, q = a - b, f"What is {a} - {b}?"
        elif kind == "mul":
            a, b = rng.randint(2, 6 + level), rng.randint(2, 12)
            ans, q = a * b, f"What is {a} x {b}?"
        else:
            base, pct = rng.choice([200, 400, 500, 800]), rng.choice([10, 20, 25, 50])
            ans, q = base * pct // 100, f"What is {pct}% of {base}?"
        wrong = {ans + d for d in (1, 2, 5, 10, -1, -2, -5, -10) if ans + d >= 0} - {ans}
        options = rng.sample(sorted(wrong), 3) + [ans]
        rng.shuffle(options)
        out.append((q, [str(o) for o in options], options.index(ans)))
    return out


def bank_for(subject: str, rng: random.Random, level: int):
    s = subject.lower()
    if "math" in s:
        return maths(rng, level)
    if "english" in s or "literature" in s:
        return ENGLISH
    if "kiswahili" in s:
        return KISWAHILI
    if "science" in s or s in ("biology", "chemistry", "physics") or "agriculture" in s or "environmental" in s:
        return SCIENCE
    if "social" in s or "history" in s or "geography" in s:
        return SOCIAL
    return None


# Lesson topics by learning area. Anything not listed falls back to generic unit titles.
TOPICS = {
    "Mathematics": ["Numbers and place value", "Addition and subtraction", "Multiplication", "Division", "Fractions", "Decimals", "Measurement: length and mass", "Time and money", "Geometry: shapes and angles", "Data handling", "Algebra: simple equations", "Revision and assessment"],
    "Mathematical Activities": ["Counting 1 to 20", "Number recognition", "Sorting and grouping", "Patterns", "Comparing sizes", "Shapes around us", "Adding objects", "Taking away objects", "Measuring with hands", "Money activities"],
    "Core Mathematics": ["Indices and logarithms", "Quadratic expressions", "Linear programming", "Sequences and series", "Trigonometry", "Matrices", "Statistics", "Probability", "Vectors", "Revision and assessment"],
    "English": ["Listening and speaking: greetings", "Reading comprehension", "Grammar: nouns and pronouns", "Grammar: verbs and tenses", "Composition writing", "Vocabulary building", "Poetry and rhyme", "Punctuation", "Letter writing", "Oral reports", "Revision and assessment"],
    "English Language Activities": ["Listening to stories", "Letter sounds", "Reading simple words", "Writing letters", "Naming objects", "Rhymes and songs", "Simple sentences", "Reading short stories", "Speaking about myself", "Revision and assessment"],
    "Language Activities": ["Listening to stories", "Pronouncing sounds", "Naming things around us", "Songs and rhymes", "Pre-writing patterns", "Picture reading", "Telling short stories", "Greetings and polite words"],
    "Kiswahili": ["Kusikiliza na kuzungumza", "Kusoma kwa ufahamu", "Nomino na viwakilishi", "Vitenzi na nyakati", "Insha", "Methali na nahau", "Barua", "Msamiati", "Mazoezi ya sarufi", "Marudio na tathmini"],
    "Kiswahili Language Activities": ["Salamu na maamkuzi", "Sauti za herufi", "Kusoma maneno", "Kuandika herufi", "Majina ya vitu", "Nyimbo na mashairi", "Sentensi fupi", "Hadithi fupi", "Marudio na tathmini"],
    "Science and Technology": ["Living things and their environment", "Parts of a plant", "Human body: the senses", "Air and water", "Soil", "Light and sound", "Simple machines", "Electricity", "Weather and climate", "Revision and assessment"],
    "Integrated Science": ["Introduction to science", "Cells and living organisms", "Mixtures, elements and compounds", "Force and energy", "Matter and its properties", "Reproduction in plants", "Human body systems", "Heat transfer", "Electricity and magnetism", "Revision and assessment"],
    "Environmental Activities": ["Our home and family", "Plants around us", "Animals around us", "Weather", "Keeping clean", "Water and its uses", "Safety at home and school", "Our school"],
    "Social Studies": ["Our county and country", "Physical features of Kenya", "Climate and vegetation", "Early communities in Kenya", "Citizenship and governance", "Trade and transport", "Resources and conservation", "Revision and assessment"],
    "Christian Religious Education": ["Creation", "God's care for us", "Jesus' birth and early life", "The parables of Jesus", "Christian values", "Prayer", "Leaders in the Bible", "Revision and assessment"],
    "Agriculture and Nutrition": ["Crops grown in our area", "Preparing a seedbed", "Planting and weeding", "Animals on the farm", "Food groups", "Balanced diet", "Food hygiene", "Kitchen gardens"],
    "Creative Arts": ["Drawing and colour", "Paper craft", "Clay modelling", "Songs and rhythm", "Traditional dances", "Simple instruments", "Weaving", "Class exhibition"],
    "Physical and Health Education": ["Warm-up and stretching", "Running and relays", "Ball games: football", "Netball skills", "Personal hygiene", "First aid basics", "Athletics events", "Sports day preparation"],
    "Biology": ["Cell structure", "Classification", "Nutrition in plants", "Nutrition in animals", "Transport in living organisms", "Gaseous exchange", "Reproduction", "Ecology"],
    "Chemistry": ["Introduction to chemistry", "States of matter", "Atomic structure", "The periodic table", "Chemical bonding", "Acids, bases and salts", "Rates of reaction", "Organic chemistry"],
    "Physics": ["Measurement", "Forces", "Work, energy and power", "Heat", "Waves", "Light", "Electricity", "Magnetism"],
}


def topics_for(subject: str) -> list[str]:
    if subject in TOPICS:
        return TOPICS[subject]
    base = subject.replace(" Activities", "")
    return [f"{base}: introduction", f"{base}: key concepts", f"{base}: practical work", f"{base}: group project", f"{base}: application in daily life", f"{base}: assessment and feedback", f"{base}: revision", f"{base}: extension tasks"]
