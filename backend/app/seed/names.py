"""Kenyan names for the sample people: a mix of Kalenjin, Luhya and Luo second names, plus the Christian and Swahili
first names families in the Rift Valley and Western Kenya commonly use. Every first name is used once across all
campuses, so a login can be as simple as eugene@milai.com."""

FEMALE_FIRST = [
    "Beatrice", "Grace", "Joyce", "Faith", "Mercy", "Esther", "Ruth", "Lydia", "Naomi", "Sharon", "Winnie", "Caroline", "Pauline", "Janet", "Irene",
    "Dorothy", "Evelyn", "Lilian", "Mildred", "Rose", "Susan", "Tabitha", "Veronica", "Zipporah", "Priscilla", "Rebecca", "Agnes", "Doreen", "Florence",
    "Gladys", "Hellen", "Immaculate", "Judith", "Karen", "Linet", "Margaret", "Nancy", "Olivia", "Purity", "Quinter", "Rael", "Stella", "Terry",
    "Ursula", "Violet", "Wangari", "Yvonne", "Zainab", "Abigail", "Brenda", "Cynthia", "Diana", "Eunice", "Felistas", "Gertrude", "Hannah", "Isabella",
    "Jackline", "Kellen", "Laura", "Maureen", "Norah", "Odette", "Patience", "Rhoda", "Sylvia", "Theresia", "Valarie", "Winfred", "Phoebe", "Damaris",
    "Edna", "Fridah", "Joan", "Leah", "Millicent", "Nelly", "Perpetua", "Roselyne", "Sarah", "Truphena", "Vivian", "Wendy", "Beryl", "Carolyne", "Dinah",
    "Elizabeth", "Flora", "Gloria", "Hilda", "Ivy", "Jane", "Kate", "Lucy", "Monica", "Nicole", "Oprah", "Pamela", "Rita", "Selina", "Tracy", "Ann",
    "Alice", "Bridget", "Cecilia", "Debra", "Emily", "Fiona", "Georgina", "Harriet", "Jacinta", "Kendi", "Lorna", "Mary", "Nelima", "Pendo", "Rehema",
    "Salome", "Tumaini", "Upendo", "Wafula", "Zawadi", "Amina", "Baraka", "Chausiku", "Dorcas", "Eliza", "Faridah", "Gaudencia", "Hawa", "Imelda",
]
MALE_FIRST = [
    "Peter", "Samuel", "Eugene", "John", "James", "David", "Daniel", "Joseph", "Moses", "Stephen", "Paul", "Kevin", "Brian", "Dennis", "Collins", "Felix",
    "Geoffrey", "Isaac", "Jacob", "Kenneth", "Lawrence", "Martin", "Nicholas", "Oscar", "Patrick", "Robert", "Simon", "Thomas", "Victor", "Walter",
    "Amos", "Benard", "Calvin", "Duncan", "Elijah", "Francis", "George", "Harrison", "Ian", "Julius", "Kelvin", "Leonard", "Michael", "Nathan",
    "Oliver", "Philip", "Raphael", "Silas", "Titus", "Vincent", "Wilson", "Abel", "Brighton", "Cornelius", "Derrick", "Edwin", "Fredrick", "Gideon",
    "Hillary", "Ivan", "Job", "Kelly", "Levi", "Maurice", "Newton", "Owen", "Phelix", "Ronald", "Sammy", "Tom", "Urbanus", "Vitalis", "Wesley",
    "Alex", "Boniface", "Clinton", "Denis", "Emmanuel", "Frank", "Gilbert", "Henry", "Ishmael", "Jeremiah", "Kennedy", "Lewis", "Mark", "Noah",
    "Otieno", "Pius", "Quincy", "Reuben", "Stanley", "Tobias", "Ugo", "Vernon", "William", "Zachary", "Allan", "Barnabas", "Cyrus", "Dominic",
    "Erick", "Fidel", "Gabriel", "Hudson", "Innocent", "Joel", "Kiprop", "Luka", "Meshack", "Nelson", "Obadiah", "Prince", "Ramadhan", "Shadrack",
    "Timothy", "Uriah", "Valentine", "Wycliffe", "Yusuf", "Zablon", "Ayub", "Bethuel", "Charles", "Douglas", "Edward", "Festus", "Godfrey", "Harun",
]
# Second names: Kalenjin, Luhya and Luo.
KALENJIN_LAST = ["Rotich", "Kiprono", "Kiplagat", "Kipchumba", "Cheruiyot", "Koech", "Kimutai", "Langat", "Tanui", "Sang", "Bett", "Kosgei", "Chepkwony", "Ngetich", "Kirui", "Tuwei", "Rono", "Biwott", "Kemboi", "Yego", "Kiprotich", "Kipkemboi", "Cherop", "Jepchirchir"]
LUHYA_LAST = ["Wekesa", "Barasa", "Wafula", "Simiyu", "Wanyama", "Mukhwana", "Juma", "Nabwera", "Masinde", "Khaemba", "Sifuna", "Namasaka", "Wamalwa", "Oduor", "Shitandi", "Wangila", "Makokha", "Lusweti", "Wanjala", "Ayuma", "Mulama", "Situma", "Nyongesa", "Khisa"]
LUO_LAST = ["Odhiambo", "Otieno", "Ochieng", "Onyango", "Owino", "Omondi", "Okoth", "Ouma", "Opiyo", "Odongo", "Akinyi", "Atieno", "Awino", "Anyango", "Adhiambo", "Achieng", "Okello", "Oloo", "Ojwang", "Obonyo", "Nyawade", "Orwa", "Mboya", "Ogutu"]
LAST_NAMES = KALENJIN_LAST + LUHYA_LAST + LUO_LAST
# Middle names: the traditional name families often give alongside the Christian one.
KALENJIN_MIDDLE_F = ["Jepkoech", "Chepkemoi", "Jebet", "Chebet", "Jepchirchir", "Cherono", "Jeptoo", "Chelangat", "Jelagat", "Jerotich"]
KALENJIN_MIDDLE_M = ["Kipchirchir", "Kiprop", "Kipkoech", "Kiptoo", "Kiplimo", "Kipngetich", "Kipsang", "Kipyegon", "Kibet", "Kimeli"]
LUHYA_MIDDLE_F = ["Nekesa", "Nafula", "Nasimiyu", "Naliaka", "Namukhula", "Nanjala", "Nabwire", "Nasambu", "Wanjiru", "Khasoa"]
LUHYA_MIDDLE_M = ["Wekesa", "Wafula", "Simiyu", "Barasa", "Wanjala", "Masika", "Khisa", "Juma", "Makokha", "Wangila"]
LUO_MIDDLE_F = ["Atieno", "Akinyi", "Adhiambo", "Anyango", "Awino", "Apiyo", "Achieng", "Auma", "Adongo", "Akoth"]
LUO_MIDDLE_M = ["Otieno", "Odhiambo", "Ochieng", "Onyango", "Omondi", "Okoth", "Ouma", "Opiyo", "Odongo", "Oloo"]
