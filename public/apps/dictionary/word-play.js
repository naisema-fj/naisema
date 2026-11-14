// Curated challenges: a similar shape is a clue, not proof of a new Fijian word.
// Each answer below is tied to the owner's examples or independent usage.
const bondage = {
  title: "What changes around bobula?",
  intro: "Bobula names a person held in bondage. Look at the added pieces, then guess what each longer form does before opening it.",
  hint: "The added vaka- and vei- can change how an action is presented. The ending in -taki is part of a whole recorded form; it does not always give one fixed English translation.",
  cards: [
    {word: "bobulataka", question: "If bobula names the person, what might bobulataka do to someone?", answer: "To enslave someone or bring them into bondage.", parts: [{text: "bobula", role: "base"}, {text: "-taka", role: "recorded ending"}]},
    {word: "vakabobulataki", question: "In vakabobulataki keda, who is being brought under another's control?", answer: "Keda means us: the phrase is about bringing us into bondage. In other sentences the same form can describe people who have been enslaved.", parts: [{text: "vaka-", role: "prefix"}, {text: "bobula", role: "base"}, {text: "-taki", role: "recorded ending"}]},
    {word: "veivakabobulataki", question: "What might this longer form name when a text speaks of a practice or condition?", answer: "Enslavement or an enslaving practice. It can also describe work that is exploitative or coercive, depending on the phrase.", parts: [{text: "vei-", role: "prefix"}, {text: "vaka-", role: "prefix"}, {text: "bobula", role: "base"}, {text: "-taki", role: "recorded ending"}]}
  ],
  after: "What about bobulataki and vakaboubula? Their spelling and use still need a complete, checked Fijian phrase. Try comparing them with the forms above before treating them as dictionary words.",
  link: {label: "Read the forms in a Fijian passage", href: "https://www.wordproject.org/bibles/fj/45/6.htm"}
};

const houses = {
  title: "Which kind of vale?",
  intro: "Vale is a house or building. In these examples, ni joins it to an activity, and the whole expression names a place by what people do there. The joined spellings are also in use.",
  hint: "Start with vale, then read the activity after ni: sili (bathe), kana (eat), volavola (write or do office work). Do not assume every vale ni phrase must become one written word.",
  cards: [
    {word: "valenisili", question: "Vale ni sili: would you expect to bathe or eat here?", answer: "A bathroom. The same expression is also written vale ni sili.", parts: [{text: "vale", role: "base"}, {text: "ni", role: "linker"}, {text: "sili", role: "activity"}]},
    {word: "valenikana", question: "Vale ni kana: what makes this building different from a valenisili?", answer: "A dining hall or eating place; in some contexts, a restaurant. People go there to eat.", parts: [{text: "vale", role: "base"}, {text: "ni", role: "linker"}, {text: "kana", role: "activity"}]},
    {word: "valenivolavola", question: "Vale ni volavola: what work gives this place its name?", answer: "An office, where writing or administrative work is done.", parts: [{text: "vale", role: "base"}, {text: "ni", role: "linker"}, {text: "volavola", role: "activity"}]}
  ],
  link: {label: "See valenivolavola in a Fiji government document", href: "https://www.justice.gov.fj/wp-content/uploads/2024/08/Information-on-Change-of-Name-itaukei-Language.pdf"}
};

const houseOrder = {
  title: "Which order makes a big house?",
  intro: "Fijian can put the description after the thing it describes. Try the two orders, then look at the roles in the recorded phrase.",
  cards: [
    {word: "na vale levu", question: "Which phrase means ‘the big house’?", options: ["na levu vale", "na vale levu"], correct: "na vale levu", incorrectHint: "Try placing the description after vale.", clues: ["levu"], answer: "Na vale levu. Na opens the matanauni, vale is its yavu, and levu describes the house. The reversed order does not work as this ordinary descriptive phrase.", parts: [{text: "na", role: "mata"}, {text: "vale", role: "yavu"}, {text: "levu", role: "description"}]}
  ],
  link: {label: "See na vale levu in a linguistics paper", href: "https://www.victoria.ac.nz/__data/assets/pdf_file/0014/1010336/WWPL23_2017_online_version.pdf"}
};

const stomachMarker = {
  title: "Which opening fits ketequ?",
  intro: "Kete names the stomach. The attached -qu adds ‘my’. Now choose the opening for an ordinary body-part noun phrase.",
  cards: [
    {word: "na ketequ", question: "Which form would you use for ‘my stomach’ here?", options: ["o ketequ", "na ketequ"], correct: "na ketequ", incorrectHint: "Think of the usual mata before a common noun, rather than a personal name or pronoun.", clues: ["-qu", "mata"], answer: "Na ketequ. Na is the mata of this common-noun phrase; kete is the body-part base and -qu means ‘my’. In this ordinary use, o is the marker to look for with a personal name or pronoun, not ketequ. A Fijian passage records na ketequ.", parts: [{text: "na", role: "mata"}, {text: "kete", role: "yavu"}, {text: "-qu", role: "possessive suffix"}]},
    {word: "ketequ / ketena", question: "If ketequ is my stomach, whose stomach is ketena?", options: ["His or her stomach", "My stomach"], correct: "His or her stomach", incorrectHint: "The body part stays kete; compare the attached endings.", clues: ["-qu"], answer: "Ketena means his or her stomach. The ending changes with the possessor: ketequ has -qu for ‘my’, while ketena has -na for ‘his or her’. A University of the South Pacific study records na ketena in this sense.", parts: [{text: "kete", role: "body-part base"}, {text: "-qu / -na", role: "possessor endings"}]}
  ],
  link: {label: "Read a study of ketena in Fijian varieties", href: "https://repository.usp.ac.fj/id/eprint/13300/1/The_glottal_stop_in_Nasarowaqa_Fijian_and_other_other_Oceanic_languages.pdf"}
};

const speech = {
  title: "From vosa to veivosaki",
  intro: "Vosa can name a word or speech, and it can mean to speak. What changes when the conversation involves people together?",
  hint: "Vei- often points to a shared or reciprocal action, but the whole word still needs its own checked meaning.",
  cards: [
    {word: "vosa", question: "When does vosa mean a word, and when does it mean speaking?", answer: "Vosa can name a word or speech, and it can also mean to speak. The surrounding phrase decides which use fits. A courteous saying and a formal reply show two further settings for speech.", sayingId: "proverb-110", cultureTerm: "Ulivi ni vosa"},
    {word: "veivosaki", question: "Would veivosaki be one word spoken alone, or people talking together?", answer: "People talking together; a conversation or discussion.", parts: [{text: "vei-", role: "prefix"}, {text: "vosa", role: "base"}]},
    {word: "veivosataki", question: "Does the extra ending make this identical to veivosaki?", answer: "No. In one Fiji consumer text, veivosataki refers to matters discussed with a bank. In a religious glossary it is also used in a different sense, correction or chastening. Read the whole phrase before choosing an English meaning.", parts: [{text: "vei-", role: "prefix"}, {text: "vosa", role: "base"}, {text: "-taki", role: "recorded ending"}]}
  ],
  link: {label: "Explore an early Fijian account of vosa and veivosaki", href: "https://upload.wikimedia.org/wikipedia/commons/8/80/A_Fijian_and_English_and_an_English_and_Fijian_dictionary%2C_with_examples_of_common_and_peculiar_modes_of_expression_and_uses_of_words%2C_also%2C_containing_brief_hints_on_native_customs_%28IA_fijianenglishand00hazl%29.pdf"}
};

const mangroves = {
  title: "One tree or many?",
  intro: "Dogo can name a mangrove tree. Veidogo points to mangroves together, such as the vegetation along a coast. Fiji conservation material identifies dogo with the black mangrove, Bruguiera gymnorrhiza, but local naming may vary.",
  hint: "Here vei- helps form a collective meaning. That clue works for this pair; it does not give every vei- word the same meaning.",
  cards: [
    {word: "veidogo", question: "If you are looking at a stretch of mangroves, which form fits better than dogo?", answer: "Veidogo, for mangroves collectively or mangrove vegetation. Dogo can pick out a tree; the whole veidogo is a coastal habitat.", parts: [{text: "vei-", role: "prefix"}, {text: "dogo", role: "base"}]},
    {word: "veidogo", question: "What might a coastal village lose if its veidogo disappears?", options: ["Shore protection and young fish habitat", "Only the shade of one tree"], correct: "Shore protection and young fish habitat", incorrectHint: "Think about the whole mangrove area and the animals sheltered there.", answer: "Mangrove roots help protect Fiji's shores and provide nursery habitat for fish. Veidogo names vegetation with a role in the community's coastline, not just a collection of identical trees.", clues: ["dogo", "qari"]}
  ],
  link: {label: "See why Fiji's mangroves matter to coastal communities", href: "https://www.worldwildlife.org/news/stories/working-with-fijis-coastal-communities-to-protect-vital-mangrove-forests/"}
};

const possession = {
  title: "Why batiqu, but na noqu vale?",
  intro: "Both can mean ‘my’, but the relationship changes the form. Teeth are part of your body; a house is something you may own or live in.",
  hint: "In Vosa Vakaviti Raraba, a body-part word can take -qu directly. A house normally uses noqu before vale. The na at the start of each full phrase is the mata, not part of the word itself.",
  cards: [
    {word: "na batiqu", question: "Where does the ‘my’ piece sit in ‘my teeth’?", answer: "After bati: bati + -qu → batiqu. In na batiqu, na is the mata of the whole matanauni; bati is its yavu.", parts: [{text: "na", role: "mata"}, {text: "bati", role: "yavu"}, {text: "-qu", role: "suffix: my"}]},
    {word: "na noqu vale", question: "Could you normally make ‘my house’ by writing valequ?", answer: "In Vosa Vakaviti Raraba, say na noqu vale. The possession is carried by noqu before the yavu vale, rather than by -qu attached to vale. Other Fijian varieties can follow different patterns.", parts: [{text: "na", role: "mata"}, {text: "noqu", role: "possession"}, {text: "vale", role: "yavu"}], linkWord: "vale"}
  ],
  after: "You may also hear noqu bati in some dialects. Ask a fluent parent, elder, or community speaker which form they use and what a complete sentence means. You can share the sentence as a correction or addition.",
  link: {label: "Read a linguistic account of Fijian possession", href: "https://glowlinguistics.org/42/wp-content/uploads/sites/4/2019/03/GLOW_FJPoss.pdf"}
};

const coconuts = {
  title: "From one niu to a grove",
  intro: "Niu is a coconut. Veiniu is used for a coconut plantation or grove. Veiniuniu also appears in Fijian writing about coconut palms.",
  hint: "Here vei- helps shift attention from one coconut to an area of coconut palms. The repeated niu in veiniuniu is a form to investigate, not proof that every doubled word means ‘many’. ",
  cards: [
    {word: "veiniu", question: "On a village map, would this label point to one coconut or a place where palms grow?", answer: "A coconut plantation or grove in the Ovalau mapping report.", parts: [{text: "vei-", role: "prefix"}, {text: "niu", role: "base"}]},
    {word: "veiniuniu", question: "What does the longer form evoke in ‘koro ni veiniuniu’?", answer: "A place associated with many coconut palms. The phrase is used in a Fijian text, but the difference between veiniu and veiniuniu needs more community examples.", parts: [{text: "vei-", role: "prefix"}, {text: "niuniu", role: "repeated base"}]}
  ],
  after: "Does your family use veiniu and veiniuniu differently? Ask a fluent speaker for a sentence that shows the difference, then share it with the dictionary.",
  link: {label: "See veiniu on an Ovalau community map", href: "https://www.iapad.org/wp-content/uploads/2015/07/ovalau_report_revised_20050720.pdf"}
};

const movement = {
  title: "Moving in different ways",
  intro: "Lako means to go; cici means to run. The longer recorded words describe movement across places or back and forth.",
  hint: "Vei- and the ending -yaki are useful clues here, but they do not make every longer movement word mean the same thing.",
  cards: [
    {word: "veilakoyaki", question: "Would you expect stillness or travel between places?", answer: "Travel or movement from place to place. A New Zealand Fijian information sheet uses it for travel routes and transport.", parts: [{text: "vei-", role: "prefix"}, {text: "lako", role: "base"}, {text: "-yaki", role: "recorded ending"}]},
    {word: "veiciciyaki", question: "How does this differ from the slower idea of veilakoyaki?", answer: "Running about or back and forth. A Fijian text describes creatures veiciciyaki voli, darting about.", parts: [{text: "vei-", role: "prefix"}, {text: "cici", role: "base"}, {text: "-yaki", role: "recorded ending"}]}
  ],
  link: {label: "See veiciciyaki in a Fijian passage", href: "https://www.wordproject.org/bibles/fj/26/1.htm"}
};

const farewell = {
  title: "More than going to sleep",
  intro: "Moce can be about sleep, but vakamoce is also used when saying goodbye. The longer form is about people parting from one another.",
  hint: "Look at vei- + vaka- + moce + -taki as clues to the attested whole word; the meaning comes from the complete farewell context, not from adding four English glosses.",
  cards: [
    {word: "veivakamocetaki", question: "When the traveller leaves, what might the people do?", answer: "They say goodbye to one another. A Fiji Times account uses the form when a passenger leaves a plane; this does not mean that everyone goes to sleep.", parts: [{text: "vei-", role: "prefix"}, {text: "vaka-", role: "prefix"}, {text: "moce", role: "base"}, {text: "-taki", role: "recorded ending"}]},
    {word: "E ratou veivakamocetaki", question: "In the account, did the farewell happen after one passenger got off, or because everyone was going to sleep?", options: ["After one passenger got off", "Because everyone was going to sleep"], correct: "After one passenger got off", incorrectHint: "The plane was about to continue its journey.", answer: "The group exchanged farewells when Kalara got off the plane at Waiqele; the flight then continued to Savusavu. The situation makes the parting sense clear."}
  ],
  link: {label: "Read veivakamocetaki in a Fiji Times account", href: "https://www.fijitimes.com.fj/serekali-ni-sa-kacikaci-ni-cagi-o-delaikoro/"}
};

const predicate = {
  title: "Build a matavu around lako",
  intro: "A matavu has a yavu and may also have duru. Try reading the roles in the recorded phrase before translating it word by word.",
  cards: [
    {word: "Au sa lako mai", question: "Which part identifies who is coming, and which part names the action?", answer: "Au points to the speaker and serves as durusau here. Lako is the yavu. Sa is a durugauna; mai indicates movement toward the speaker. In the cited bilingual text, the phrase means ‘I came’.", parts: [{text: "au", role: "durusau"}, {text: "sa", role: "durugauna"}, {text: "lako", role: "yavu"}, {text: "mai", role: "direction"}]}
  ],
  link: {label: "See the phrase in a bilingual Fijian text", href: "https://www.divinerevelations.info/searchable_directory2/bible_language_resources/fijian_four_laws.pdf"}
};

const journeyNoun = {
  title: "How someone walks, or a journey?",
  intro: "Ilakolako can describe how someone walks. In a travel phrase, it can also name a trip or journey. Look closely: the longer word has an opening i- and repeats lako.",
  cards: [
    {word: "ilakolako", question: "What can you see in ilakolako?", options: ["Only i- added", "Only lako repeated", "Both i- and repeated lako"], correct: "Both i- and repeated lako", incorrectHint: "Look at the beginning and count how many times you see lako.", clues: ["i-", "drua"], answer: "Both. The recorded word is i- + lako + lako. Here i- helps form a noun, and the base appears twice. The whole word can describe how someone walks or, in a travel context, a journey. Repetition alone does not settle which sense is meant.", parts: [{text: "i-", role: "noun-forming beginning"}, {text: "lako", role: "base"}, {text: "lako", role: "repeated base"}]},
    {word: "ilakolako ni veisiko", question: "What sort of journey was this in the iTaukei Affairs report?", options: ["A visit", "A race"], correct: "A visit", incorrectHint: "Look at veisiko after ni; it gives the purpose.", clues: ["lako", "ni"], answer: "A visiting journey. In the report, an ilakolako ni veisiko brought people to a family in Rewa. Ilakolako names the journey; ni veisiko specifies its purpose."}
  ],
  link: {label: "Read ilakolako in an iTaukei Affairs report", href: "https://www.parliament.gov.fj/wp-content/uploads/2024/03/iTaukei-Affairs-Board-Annual-Report-2021%E2%80%932022.pdf"}
};

const twoPeople = {
  title: "Two of us: is the listener included?",
  intro: "Both of these forms refer to two people. The difference is whether the person you are speaking to is one of them.",
  hint: "When you say 'we two', first decide whether you mean 'you and I' or 'another person and I'.",
  cards: [
    {word: "keirau", question: "You and I are talking about my friend and me. Which 'we two' includes no listener?", answer: "Keirau: the two of us, excluding the person being addressed."},
    {word: "kedaru", question: "Now I mean you and me together. Which 'we two' fits?", answer: "Kedaru: you and I, including the person being addressed. Daru is a shorter form in this set."}
  ]
};

const taro = {
  title: "The crop or its leaves?",
  intro: "Dalo names the taro crop. Rourou names its leaves, especially when they are prepared as food.",
  hint: "A plate of rourou and a dalo plant are connected, but the two words point to different parts or uses.",
  cards: [
    {word: "rourou", question: "If someone serves rourou with a meal, are you expecting the starchy root or the leaves?", answer: "The leaves, often cooked as a green vegetable."},
    {word: "rourou", question: "Why do Fiji cooks prepare rourou carefully before serving it?", options: ["The leaves can cause a mild itch", "The word names a raw fruit"], correct: "The leaves can cause a mild itch", incorrectHint: "Think about the preparation of taro leaves as food.", answer: "Tourism Fiji notes that the taro leaves are prepared to remove a mild itch before they are cooked. The starchy dalo corm is usually baked, fried, or boiled; rourou points to the leaf side of the crop.", clues: ["dalo"]}
  ],
  link: {label: "Explore dalo and rourou in Fiji food", href: "https://www.fiji.travel/things-to-do/local-eats/unusual-fijian-foods"}
};

const marks = {
  title: "Which mark ends the sentence?",
  intro: "A small mark can change how a sentence is read. The Fijian names distinguish a statement from a direct question.",
  hint: "A digo ends a statement. An icegutaro ends a question.",
  cards: [
    {word: "digo", question: "Which mark closes a statement?", answer: "Digo, the full stop (.)."},
    {word: "icegutaro", question: "Which mark would you put after a direct question?", answer: "Icegutaro, the question mark (?)."}
  ]
};

const loans = {
  title: "English words, Fijian shapes",
  intro: "Two familiar baked foods have names borrowed from English. Fijian gives them sound patterns that fit its words.",
  hint: "Fijian lexical words normally end in a vowel. Listen to the final vowel in each borrowed form.",
  cards: [
    {word: "keke", question: "What did English cake become in Fijian?", answer: "Keke. It ends in a vowel, and the English spelling is not carried over."},
    {word: "bisikete", question: "What did English biscuit become in Fijian?", answer: "Bisikete. The final -e belongs to the Fijian form; bisiketer is not the word."}
  ],
  link: {label: "Read research on English loanwords in Fijian", href: "https://openresearch-repository.anu.edu.au/server/api/core/bitstreams/78ff8d53-4142-446c-84cb-507a8a6ff982/content"}
};

const accusation = {
  title: "Who is being accused?",
  intro: "Beitaka means to accuse. Read what follows it: the person may appear in a na phrase or as a pronoun directly after a different recorded ending.",
  hint: "Compare the full phrases before deciding what -taka and -taki are doing. In this Tuvavosa analysis, na opens a matanauni raraba; a directly following personal pronoun can be nauni qali inside the matavu.",
  cards: [
    {word: "beitaka na tamata tani", question: "Which words identify the person accused?", answer: "Na tamata tani (‘another person’). Here beitaka is followed by a na phrase. The phrase is recorded in a Fijian rendering of Deuteronomy 19:16; it does not prove that every person accused must be expressed this way.", clues: ["dewa", "matanauni raraba"], parts: [{text: "beitaka", role: "predicate"}, {text: "na", role: "mata"}, {text: "tamata tani", role: "person accused"}]},
    {word: "beitaki koya", question: "What changes when koya (‘him or her’) follows directly?", answer: "The recorded form is beitaki before koya. Unlike na tamata tani, this personal pronoun follows without na. In the Tuvavosa phrase analysis, a directly attached pronoun is nauni qali; the difference is about phrase structure as well as the ending.", clues: ["dewa", "nauni qali"], parts: [{text: "beitaki", role: "predicate form"}, {text: "koya", role: "pronoun"}]},
    {word: "veibeitaki", question: "Does this always name an accusation?", answer: "No. Na veibeitaki can name an accusation, while eda dau qai veibeitaki voli describes people blaming one another. The surrounding mata and duru help show whether the whole expression is a matanauni or a matavu. Do not assign one English word class from the spelling alone.", clues: ["vei-", "matanauni", "matavu"], parts: [{text: "vei-", role: "recorded prefix"}, {text: "bei", role: "base"}, {text: "-taki", role: "recorded ending"}]}
  ],
  link: {label: "Read beitaki koya in a Fijian passage", href: "https://www.bible.com/bible/676/MRK.15.FNV"}
};

const seeing = {
  title: "Who follows the seeing word?",
  intro: "Raica and raici are both recorded. Look at the kind of expression after each form before calling them interchangeable.",
  cards: [
    {word: "au raica tiko na gone", question: "Where does the phrase for the child begin?", answer: "At na gone. This is a matanauni raraba after raica tiko; na marks the beginning of that phrase.", clues: ["dewa", "matanauni raraba"], parts: [{text: "au", role: "durusau"}, {text: "raica", role: "predicate form"}, {text: "tiko", role: "duru"}, {text: "na gone", role: "matanauni raraba"}]},
    {word: "au raici Jo tiko", question: "Why does Jo stand between raici and tiko?", answer: "Jo is a personal name immediately after raici. The Tuvavosa analysis calls it nauni qali within this matavu, rather than a separate na phrase. The choice of form follows the whole construction.", clues: ["nauni qali", "matavu"], parts: [{text: "au", role: "durusau"}, {text: "raici", role: "predicate form"}, {text: "Jo", role: "nauni qali"}, {text: "tiko", role: "duru"}]}
  ],
  link: {label: "Read research on Fijian object position", href: "https://qmro.qmul.ac.uk/xmlui/bitstream/handle/123456789/55754/van%20Urk%20Object%20licensing%20in%20Fijian%20and%20the%20role%20of%20adjacency%202019%20Accepted.pdf?isAllowed=y&sequence=2"}
};

const drinking = {
  title: "What does yaqona add to gunu?",
  intro: "Gunu names the drinking action. A following nauni can say what sort of drinking is meant without becoming an object after a dewa form.",
  cards: [
    {word: "au gunu yaqona tiko", question: "What does yaqona contribute here?", answer: "It narrows the action to drinking yaqona. The Tuvavosa account calls yaqona a kilavu nauni in this construction. It contrasts this recorded phrase with *au gunuva yaqona tiko; do not add -va just because English says ‘drink yaqona’.", clues: ["kilavu nauni", "dewa"], parts: [{text: "au", role: "durusau"}, {text: "gunu", role: "yavu"}, {text: "yaqona", role: "kilavu nauni"}, {text: "tiko", role: "duru"}]},
    {word: "gunu + yaqona", question: "Which part still names the action if yaqona is taken away?", answer: "Gunu remains the yavu naming the drinking action. Yaqona is the kilavu nauni that specifies the drink in this recorded construction; it does not replace gunu as the yavu.", clues: ["yavu", "kilavu nauni"]}
  ]
};

const shoreCrabs = {
  title: "Which crab lives where?",
  intro: "Qari and lairo are both crabs eaten in Fiji, but their names point to different coastal habitats.",
  cards: [
    {word: "qari", question: "Would you look for this crab around mangroves or on dry land?", answer: "Around mangroves and muddy shores. Qari names a mud or mangrove crab; a particular identification still depends on local usage."},
    {word: "lairo", question: "Which name fits the large land crab?", answer: "Lairo. Unlike qari, it is a land crab, even though it may live near the coast."}
  ],
  link: {label: "Explore Fiji fishery resource profiles", href: "https://fiji.wcs.org/Portals/82/WCS%20Fisheries%20Profile%20290920%20WEB%20%281%29.pdf?ver=2020-10-14-024200-580"}
};

const prawnOrLobster = {
  title: "A prawn or a lobster?",
  intro: "One extra vowel changes the animal here. Ura and urau should not be folded into one English ‘seafood’ label.",
  cards: [
    {word: "ura", question: "Which word is used for a prawn, including freshwater prawns?", answer: "Ura. Ura dina is recorded for a native freshwater prawn; the broad name does not by itself identify one species."},
    {word: "urau", question: "Which word points to a spiny lobster?", answer: "Urau. Its reef and coastal habitat differs from the freshwater prawn example for ura."}
  ],
  link: {label: "Read Fiji fishery resource profiles", href: "https://fiji.wcs.org/Portals/82/WCS%20Fisheries%20Profile%20290920%20WEB%20%281%29.pdf?ver=2020-10-14-024200-580"}
};

const mullets = {
  title: "A mullet name, or one kind of mullet?",
  intro: "Kanace can be a broad Fijian name for mullet. Koto is a more specific name used for the flathead mullet.",
  cards: [
    {word: "kanace", question: "Does kanace always identify one species?", answer: "No. Fiji fisheries sources use kanace broadly for mullet, even though local names can identify particular kinds."},
    {word: "koto", question: "Which fish does this more specific name identify?", answer: "The flathead mullet (Mugil cephalus). It is one of the mullets found around Fiji's mangrove areas."}
  ],
  link: {label: "Compare Fiji mullet names in the fishery profiles", href: "https://fiji.wcs.org/Portals/82/WCS%20Fisheries%20Profile%20290920%20WEB%20%281%29.pdf?ver=2020-10-14-024200-580"}
};

const appleOrder = {
  title: "Build the red apple phrase",
  intro: "Apolo is an apple. In the supplied Fijian phrase, the colour and size follow the fruit they describe.",
  cards: [
    {word: "na apolo damudamu levu", question: "Which order gives ‘the big red apple’ here?", options: ["na levu damudamu apolo", "na apolo damudamu levu"], correct: "na apolo damudamu levu", incorrectHint: "Start with the apple, then read its descriptions.", answer: "Na apolo damudamu levu. Na opens the matanauni; apolo is its yavu, followed by damudamu and levu as descriptions. The phrase is supplied by the dictionary owner, and a published analysis also records the same modifier order with apolo.", clues: ["mata", "matanauni"], parts: [{text: "na", role: "mata"}, {text: "apolo", role: "yavu"}, {text: "damudamu", role: "colour"}, {text: "levu", role: "size"}]},
    {word: "apolo damudamu / apolo drokadroka", question: "If the apple turns green, which description changes?", options: ["levu", "damudamu"], correct: "damudamu", incorrectHint: "Size stays the same; look for the colour word.", answer: "Damudamu gives the red colour. Drokadroka gives the green colour in the recorded apolo phrase. Apolo still names the fruit, and levu still describes its size.", clues: ["apolo"]}
  ]
};

const netOrRule = {
  title: "Which lawa do you mean?",
  intro: "Lawa has two independently checked meanings in this dictionary. A surrounding phrase tells the reader which one fits.",
  cards: [
    {word: "lawa", question: "If fish are caught in it, what is lawa?", answer: "A net. This is the older fishing sense, rather than the rule you must obey."},
    {word: "lawa", question: "If someone breaks it and faces a penalty, what is lawa?", answer: "A law or rule. This is a separate sense of the same written headword."}
  ]
};

const saInquiry = {
  title: "Going now, or going later?",
  intro: "Sa draws attention to something now in effect or relevant. Na can point ahead. Read the whole phrase before choosing an English time expression.",
  cards: [
    {word: "Au sa lako", question: "If I am taking my leave now, how would you understand this?", options: ["I am going / I am leaving now", "I will go at some later time"], correct: "I am going / I am leaving now", incorrectHint: "Notice that the departure is already relevant to this moment.", answer: "In this departure setting, Au sa lako means ‘I am going’ or ‘I am leaving now’. Sa is a durugauna; it does not simply mean English past tense. A different context may call for a different English rendering.", clues: ["na", "durugauna", "lako"], parts: [{text: "Au", role: "durusau"}, {text: "sa", role: "durugauna"}, {text: "lako", role: "yavu"}]},
    {word: "sa na", question: "Could sa and future na occur together?", options: ["Yes, in a suitable context", "No, they must never appear together"], correct: "Yes, in a suitable context", incorrectHint: "One marker can present an event as newly relevant while the other locates it in the future.", answer: "Yes. Sa na is recorded in Fijian. Sa can give a future event relevance as of now, while na still points ahead. The whole sentence decides what the speaker means.", clues: ["na", "durugauna"]}
  ],
  link: {label: "Read research on sa and na", href: "https://openresearch-repository.anu.edu.au/server/api/core/bitstreams/ed84f88d-599f-4e6b-ad77-cda0bbf73c01/content"}
};

const naInquiry = {
  title: "Two jobs for na",
  intro: "The same written form appears in two different places. Its role becomes clear when you look at what surrounds it.",
  cards: [
    {word: "Au na lako", question: "What does na tell us about the going here?", options: ["It is placed ahead: I will go", "It introduces the house"], correct: "It is placed ahead: I will go", incorrectHint: "Look after au and before lako.", answer: "Au na lako means ‘I will go’. Here na is a future durugauna inside the matavu, before the yavu lako. Compare Au sa lako for a going made relevant now.", clues: ["sa", "durugauna", "lako"], parts: [{text: "Au", role: "durusau"}, {text: "na", role: "future durugauna"}, {text: "lako", role: "yavu"}]},
    {word: "na vale", question: "Does na mean ‘will’ before vale?", options: ["No, it opens the noun phrase", "Yes, vale is a future action"], correct: "No, it opens the noun phrase", incorrectHint: "Vale is a house here. What begins the phrase naming it?", answer: "No. In na vale (‘the house’), na is the mata of a matanauni and vale is its yavu. This is a different function from future na in Au na lako.", clues: ["mata", "matanauni raraba", "vale"], parts: [{text: "na", role: "mata"}, {text: "vale", role: "yavu"}]}
  ],
  link: {label: "Read research on the Fijian future marker", href: "https://kir.oer4pacific.org/id/eprint/67/1/PacificLanguagesOA.pdf.pdf"}
};

const bananaCount = {
  title: "How many bunches in a bewa?",
  intro: "Bewa counts groups of banana bunches. One bewa is ten bunches, not ten individual bananas.",
  cards: [
    {word: "bewa", question: "If a grower has five bewa, how many bunches is that?", options: ["50 bunches", "5 bananas"], correct: "50 bunches", incorrectHint: "Multiply five groups by ten bunches per group.", answer: "Five bewa are 50 bunches. The number of individual bananas still depends on how many fruits are in each bunch."},
    {word: "bewa / bola", question: "Could you use bewa to count the same thing as bola?", options: ["No, their traditional counting jobs differ", "Yes, both always count bananas"], correct: "No, their traditional counting jobs differ", incorrectHint: "Look at the item being counted, not only the number ten.", answer: "A Fiji account gives one bewa as ten bunches of vudi and one bola as ten Fijian canoes. The item being counted matters, and local counting practices can differ.", clues: ["bola"]}
  ],
  link: {label: "Read about Fijian counting units", href: "https://www.fijitimes.com.fj/counting-the-itaukei-way/"}
};

const villageMeetings = {
  title: "Who meets in this bose?",
  intro: "Bose can name a meeting and can also occur in a phrase that identifies its community or institution.",
  cards: [
    {word: "bose vakoro / Bose ni Tikina", question: "Which phrase points to a village meeting rather than a district meeting?", options: ["bose vakoro", "Bose ni Tikina"], correct: "bose vakoro", incorrectHint: "Koro is the village; tikina is the district.", answer: "A bose vakoro is a village meeting. Bose ni Tikina refers to a district-level meeting. The added words tell you whose meeting is meant.", clues: ["koro", "tikina"]},
    {word: "bose / veibose", question: "In a board's annual report, why does veibose fit several meetings between board sessions?", options: ["It refers to meetings in that context", "It names one person"], correct: "It refers to meetings in that context", incorrectHint: "The report discusses committees meeting during the year.", answer: "The report uses veibose for the board's meetings and bose for a committee meeting. The contrast is visible in this passage, but vei- does not give every word a fixed English plural meaning.", parts: [{text: "vei-", role: "recorded beginning"}, {text: "bose", role: "base"}]}
  ],
  link: {label: "See bose and veibose in a Fiji board report", href: "https://www.parliament.gov.fj/wp-content/uploads/2018/11/1iTaukei-Trust-Fund-Board-2017-Annual-Report.pdf"}
};

const drinkingCup = {
  title: "The cup or the mixing bowl?",
  intro: "In a yaqona gathering, a bilo is the cup offered to a drinker. The larger tanoa holds the drink before it is served.",
  cards: [
    {word: "bilo / tanoa", question: "Which vessel is handed to the person about to drink?", options: ["bilo", "tanoa"], correct: "bilo", incorrectHint: "The tanoa stays where the yaqona is mixed.", answer: "The drinker receives a bilo. Yaqona is prepared in a tanoa and served into the smaller drinking vessel.", clues: ["tanoa", "yaqona"]},
    {word: "bilo ni yaqona / bilo yaqona", question: "Does adding ni change a cup of yaqona into a cup for yaqona?", options: ["Yes, the two phrases can differ", "No, the two phrases always mean the same thing"], correct: "Yes, the two phrases can differ", incorrectHint: "Ask whether you mean the vessel's purpose or the drink currently in it.", answer: "A Fijian syntax study contrasts bilo ni yaqona (‘a kava cup’, made for the drink) with bilo yaqona (‘a cup of kava’, containing the drink). The small ni changes the relationship between the words.", clues: ["ni", "yaqona"], parts: [{text: "bilo", role: "cup"}, {text: "ni", role: "linker in the first phrase"}, {text: "yaqona", role: "drink"}]}
  ],
  link: {label: "Read a linguistic account of bilo ni yaqona", href: "https://era.ed.ac.uk/server/api/core/bitstreams/7e2f8cdd-cc5b-4861-a47c-4fc5e982b827/content"}
};

const fenceBoundary = {
  title: "What does the bai enclose?",
  intro: "Bai is a fence or enclosing barrier. A house may stand inside it, but the bai is the boundary, not the house.",
  cards: [
    {word: "bai / vale", question: "In a plan showing a garden inside a fence, which word names the enclosing boundary?", options: ["bai", "vale"], correct: "bai", incorrectHint: "Vale names the building.", answer: "Bai names the fence or enclosure. Vale names a house or building; one may be inside the other.", clues: ["vale"]},
    {word: "loma ni bai", question: "Does loma ni bai point inside or outside the enclosure?", options: ["Inside it", "Outside it"], correct: "Inside it", incorrectHint: "Loma points to the interior.", answer: "Inside the enclosure. A Fiji environmental plan uses loma ni bai for space within a settlement or garden boundary.", clues: ["bai", "loma"], parts: [{text: "loma", role: "interior"}, {text: "ni", role: "linker"}, {text: "bai", role: "enclosure"}]}
  ],
  link: {label: "See bai in a Fiji environmental plan", href: "https://parliament.gov.fj/wp-content/uploads/2017/03/EIA-Report.pdf"}
};

const treeFern = {
  title: "Which balabala are you looking at?",
  intro: "Balabala can name a living tree fern. An older use also names a slender stick made from it for tending the hair.",
  cards: [
    {word: "balabala", question: "A person shows you a balabala growing in the forest. Is this the fern or the hair tool?", options: ["The living fern", "The hair tool"], correct: "The living fern", incorrectHint: "The same name can follow a plant into an object made from it.", answer: "The living fern. The historical tool sense needs a context about someone using or making the stick."},
    {word: "balabala", question: "Can the name balabala alone identify one exact species?", options: ["No, several Fijian tree ferns share the name", "Yes, it always means one species"], correct: "No, several Fijian tree ferns share the name", incorrectHint: "Look at the range of ferns in Te Papa's Fiji guide.", answer: "No. Te Papa records balabala across at least twelve Fijian tree fern species. A photo, location, or botanical features are needed before giving a scientific name."}
  ],
  link: {label: "Explore Fiji's balabala tree ferns", href: "https://collections.tepapa.govt.nz/topic/4060"}
};

const pandanusMat = {
  title: "From balawa leaves to an ibe",
  intro: "Balawa can name a pandanus plant and, in an older craft use, a coarse mat woven from its leaves. Context tells you whether you are seeing the material or the finished object.",
  cards: [
    {word: "balawa / ibe", question: "If someone cuts balawa leaves for weaving, which part of the story is balawa naming?", options: ["The plant supplying leaves", "Every mat in Fiji"], correct: "The plant supplying leaves", incorrectHint: "The cutting happens before any mat is woven.", answer: "The pandanus plant supplies the leaves. Ibe is the general word for a mat; balawa can also be used for a particular coarse mat made from those leaves.", clues: ["ibe"]},
    {word: "balawa / voivoi", question: "Are most Fiji village mats made from balawa simply because it is a pandanus?", options: ["No, voivoi is more commonly cultivated for mats", "Yes, balawa is the only mat plant"], correct: "No, voivoi is more commonly cultivated for mats", incorrectHint: "Different pandanus plants supply different weaving materials.", answer: "A Fiji craft account says balawa is sometimes used for large coarse mats, while voivoi is much more commonly cultivated for mat weaving. The material can help distinguish the kinds of mats.", clues: ["voivoi", "ibe"]}
  ],
  link: {label: "Read about Fiji mat materials", href: "https://www.ichlinks.com/archive/materials/publicationsV.do?ichDataUid=13888563005083845858&nation=FJ"}
};

const bambooInFiji = {
  title: "Which bitu, and what for?",
  intro: "Bitu is bamboo. Fiji has several kinds, and people choose particular bamboo for particular work.",
  cards: [
    {word: "bitu dina / bitu ni Valagi", question: "Which name does Fiji's Forestry Ministry use for its indigenous bamboo?", options: ["bitu dina", "bitu ni Valagi"], correct: "bitu dina", incorrectHint: "Dina is part of the name of the indigenous kind in the ministry account.", answer: "Bitu dina. The ministry identifies it as Schizostachyum glaucifolium; it names bitu ni Valagi as Bambusa vulgaris, used locally after its introduction. Bitu alone does not identify a species.", clues: ["bitu", "dina"]},
    {word: "bitu ni Valagi", question: "In the Vunidawa project, was this bitu used for furniture and weaving or only for fishing?", options: ["Furniture and weaving", "Only fishing"], correct: "Furniture and weaving", incorrectHint: "Think about what can be made from a bamboo cane.", answer: "Furniture and weaving. The ministry describes teaching young people in Vunidawa to use bitu ni Valagi for both. A bamboo name can tell a craft worker more than the English word ‘bamboo’ alone.", clues: ["bitu"]}
  ],
  link: {label: "Read Fiji's account of bitu species and uses", href: "https://www.fiji.gov.fj/minister-fisheries-and-forestry-alitia-bainivalus-speech-at-world-bamboo-day/"}
};

const nightAndDay = {
  title: "Where does bogi begin?",
  intro: "Bogi is night. A useful contrast is siga, day, which appears beside it in everyday Fijian writing.",
  cards: [
    {word: "siga / bogi", question: "A Te Papa learning list gives siga and bogi together. Which one takes you into the dark part of the day?", options: ["bogi", "siga"], correct: "bogi", incorrectHint: "Siga is day.", answer: "Bogi is night; siga is day. The pair helps locate a time without treating bogi as a clock hour.", clues: ["siga"]},
    {word: "ena siga kei na bogi", question: "In a Fiji government account of health workers' work ena siga kei na bogi, did they work only at night?", options: ["No, both day and night", "Yes, only at night"], correct: "No, both day and night", incorrectHint: "Kei na joins bogi to siga here.", answer: "No. Ena siga kei na bogi means ‘during the day and at night’ in this context. The phrase stresses work across both parts of the day.", clues: ["siga", "bogi"]}
  ],
  link: {label: "See siga kei na bogi in a Fiji government statement", href: "https://www.pmoffice.gov.fj/prime-minister-hon-josaia-voreqe-bainimaramas-statement-on-fijis-fifth-covid-19-case-25-03-2020/"}
};

const manyBure = {
  title: "A bure can have very different jobs",
  intro: "Bure can name a traditional house. A following word or the setting may specify the kind of building; an older counting use is different again.",
  cards: [
    {word: "bure / bure kalou", question: "Would bure kalou name any ordinary family house?", options: ["No, it names a spirit house", "Yes, every bure is a spirit house"], correct: "No, it names a spirit house", incorrectHint: "The second word narrows the kind of bure.", answer: "No. Bure kalou names a traditional spirit house. Bure by itself can name a traditional house without that specific purpose.", clues: ["bure", "kalou"]},
    {word: "bure ni sa", question: "In an account of older village life, who slept in the bure ni sa?", options: ["Young unmarried men and sometimes visitors", "Only the village chief"], correct: "Young unmarried men and sometimes visitors", incorrectHint: "The account describes a communal sleeping place.", answer: "Young unmarried men and sometimes visitors. This historical communal house had a different role from a bure kalou.", clues: ["bure"]},
    {word: "bure", question: "If three bure of war clubs are presented in traditional counting, how many clubs is that?", options: ["30 clubs", "3 clubs"], correct: "30 clubs", incorrectHint: "One bure counts ten clubs in the recorded system.", answer: "Thirty clubs. One bure can count ten war clubs; this is a separate counting sense, not three houses.", clues: ["bure"]}
  ],
  link: {label: "Read about bure as a counting unit", href: "https://www.fijitimes.com.fj/keeping-alive-a-unique-way-of-life/"}
};

const sweatAndHeat = {
  title: "Buno, bunobunoa, or bunokata?",
  intro: "These related forms take you from sweat to a sweaty state and to a heat rash. Look at the situation before choosing one.",
  cards: [
    {word: "buno", question: "If someone speaks of perspiration itself, which shorter form is relevant?", options: ["buno", "bunokata"], correct: "buno", incorrectHint: "The longer word names a skin condition.", answer: "Buno can mean sweat or the action of sweating. Its exact role needs the surrounding Fijian phrase.", clues: ["buno"]},
    {word: "bunobunoa", question: "Could bunobunoa describe close, humid weather as well as a sweaty person?", options: ["Yes", "No, only a person's skin"], correct: "Yes", incorrectHint: "The historical entry gives both person and weather settings.", answer: "Yes. Bunobunoa is used for a person perspiring and for oppressive, sultry weather. Context distinguishes them.", clues: ["buno"]},
    {word: "bunokata", question: "If someone has prickly heat, is that merely another name for sweat?", options: ["No, it names a heat rash", "Yes, it is only liquid sweat"], correct: "No, it names a heat rash", incorrectHint: "Think of a skin condition rather than the moisture.", answer: "Bunokata names prickly heat or heat rash. It is related to heat and sweat, but does not mean the same thing as buno.", clues: ["buno"]}
  ],
  link: {label: "Read a lexical study of buno", href: "https://openresearch-repository.anu.edu.au/bitstreams/61b3d7a6-0816-46d2-9a1e-5907b6a2dca1/download"}
};

const coconutFlowerSheath = {
  title: "A torch before there was a torch?",
  intro: "Bawara names the sheath around a coconut flower cluster. In older accounts, people dried this plant part and used it as a torch.",
  cards: [
    {word: "bawara / niu", question: "Does bawara name the hard shell around a mature coconut?", options: ["No, it is around the flower cluster", "Yes, it is the nut's shell"], correct: "No, it is around the flower cluster", incorrectHint: "Look at the palm before the fruit has formed.", answer: "No. Bawara is the sheath associated with the coconut flower cluster, not the hard shell around a mature nut.", clues: ["niu"]},
    {word: "bawara", question: "Why would someone keep a dried bawara after the flowers opened?", options: ["To use it as a torch", "To turn it back into a coconut"], correct: "To use it as a torch", incorrectHint: "Think about how a dry plant part can provide light.", answer: "Historical Fijian accounts describe using dried bawara as a torch. The word can lead from a plant part to a practical use without naming a new plant."}
  ],
  link: {label: "See bawara in a Fiji lexical record", href: "https://researchdata.edu.au/pg1-226-maps-cocos-nucifera/2009894"}
};

const pairedCoconuts = {
  title: "What is being counted with buku?",
  intro: "In a recorded traditional count, a buku niu is a pair of coconuts tied together by their husk fibres.",
  cards: [
    {word: "buku niu", question: "If you have four buku niu, how many coconuts are in the pairs?", options: ["Eight", "Four"], correct: "Eight", incorrectHint: "One buku niu is a pair.", answer: "Eight coconuts: four pairs of two. Buku counts the paired arrangement, not each fruit separately.", clues: ["niu"]},
    {word: "buku / i qali", question: "Would one buku niu and one i qali niu normally count the same number?", options: ["No: two versus ten", "Yes: both count ten"], correct: "No: two versus ten", incorrectHint: "Compare the pair with the larger bundle in the Fiji Times counting account.", answer: "No. In the cited traditional examples, buku niu counts two coconuts, while i qali groups ten. These are units tied to what is being counted, not interchangeable numbers.", clues: ["niu"]}
  ],
  link: {label: "Read a Fiji account of coconut counting", href: "https://www.fijitimes.com.fj/keeping-alive-a-unique-way-of-life/"}
};

const iviBread = {
  title: "The ingredient or the food?",
  intro: "Bila names a prepared starchy food or traditional bread. An older recipe made it with ivi nuts, which are a separate ingredient.",
  cards: [
    {word: "ivi / bila", question: "If someone has gathered ivi from the forest, have they already made bila?", options: ["No, ivi is an ingredient", "Yes, ivi and bila are the same prepared food"], correct: "No, ivi is an ingredient", incorrectHint: "One is the nut; the other is the food made from it.", answer: "No. Ivi is the edible seed; bila is a prepared food that could historically be made with it. Collection and cooking are different stages.", clues: ["ivi"]},
    {word: "bila", question: "Must every bila be made only from ivi because one older account mentions ivi?", options: ["No, other starchy ingredients are recorded", "Yes, the name forbids other ingredients"], correct: "No, other starchy ingredients are recorded", incorrectHint: "A food name need not fix one recipe for every place and time.", answer: "No. The older source records an ivi preparation, while a later lexical account records bila from other starches. Ask about the actual ingredients before assuming a single recipe."}
  ],
  link: {label: "See ivi prepared as food in Fiji", href: "https://www.fijitimes.com.fj/mele-makes-ends-meet/"}
};

const spearOrTitle = {
  title: "A spear, or part of a title?",
  intro: "Bale appears in more than one setting. An older entry names a type of spear, while turaga bale is a phrase about a high chief.",
  cards: [
    {word: "turaga bale", question: "If the whole phrase is turaga bale, are you being shown a weapon?", options: ["No, it refers to a high chief", "Yes, it must be a spear"], correct: "No, it refers to a high chief", incorrectHint: "Read turaga together with bale.", answer: "No. In this phrase turaga bale refers to a high or noble chief. The phrase matters; it does not make every use of bale a title.", clues: ["turaga"]},
    {word: "bale", question: "In an older list of weapons, which recorded meaning of bale belongs there?", options: ["A type of spear", "A chief's rank"], correct: "A type of spear", incorrectHint: "The older list concerns weapons, not forms of address.", answer: "A type of traditional spear. This historical sense is separate from bale inside turaga bale; a current-use phrase for the weapon still needs checking."}
  ],
  link: {label: "Read the Fiji glossary entry for turaga bale", href: "https://openresearch-repository.anu.edu.au/server/api/core/bitstreams/748b5a0b-a971-4f0a-b814-4532a68b4dd3/content"}
};

const alignmentOrBazaar = {
  title: "Two settings for basa",
  intro: "A historical entry uses basa for being aligned or level with something. A separate Fiji use names a community fundraising bazaar.",
  cards: [
    {word: "basa", question: "Two edges meet evenly. Which basa sense could describe their position?", options: ["Aligned or level", "A fundraising event"], correct: "Aligned or level", incorrectHint: "Look at the position of the edges.", answer: "Aligned or level. A complete Fijian phrase is still needed before assigning this use a Tuvavosa role."},
    {word: "basa", question: "At a community event raising funds for a school, what could basa name?", options: ["The bazaar", "The level of a wall"], correct: "The bazaar", incorrectHint: "The question is about the event, not the position of an object.", answer: "A community fundraising bazaar. This is a distinct use recorded in research on Fiji; the shared spelling does not mean the two senses are interchangeable."}
  ],
  link: {label: "Read about Fiji community bazaars", href: "https://www.sidestone.com/openaccess/9789088902710.pdf"}
};

const discardedThings = {
  title: "Which kind of benu?",
  intro: "Benu can refer to discarded food and to rubbish more generally. The thing being thrown away helps narrow the meaning.",
  cards: [
    {word: "benu", question: "After a meal, which use of benu fits the scraps left for disposal?", options: ["Food remains", "A new meal"], correct: "Food remains", incorrectHint: "These are leftovers being discarded.", answer: "Food scraps or other discarded food remains. This is the narrower sense recorded in an older source."},
    {word: "benu / benubenu", question: "Can benu in a discussion of general rubbish be assumed to mean animal dung?", options: ["No, the forms and contexts differ", "Yes, always"], correct: "No, the forms and contexts differ", incorrectHint: "The historical source gives benubenu separately for dung.", answer: "No. Benu can cover discarded waste more broadly; the related benubenu is recorded for dung. The full situation tells you what kind of waste is meant.", clues: ["benu"]},
    {word: "viritaka laivi na benu", question: "What does laivi add to viritaka na benu?", options: ["The rubbish is thrown away", "The rubbish is thrown here"], correct: "The rubbish is thrown away", incorrectHint: "The owner's contrast distinguishes throwing from throwing away.", answer: "Viritaka na benu is 'throw the rubbish'; viritaka laivi na benu makes 'throw away the rubbish' explicit. For direction, compare viritaka i keya ('throw it there') and viritaka mai ke ('throw it here')."}
  ],
  link: {label: "Read a Fijian comparative record for benu", href: "https://acd.clld.org/cognatesets/30413"}
};

const twoBulibuli = {
  title: "What is being presented?",
  intro: "Bulibuli has two recorded historical senses: a ceremonial food presentation and a kind of club. The surrounding setting decides which is intended.",
  cards: [
    {word: "bulibuli", question: "During a chief's installation, a heap of food is prepared. Which sense of bulibuli fits?", options: ["The food presentation", "A weapon"], correct: "The food presentation", incorrectHint: "The source places this use in an installation ceremony.", answer: "The ceremonial food presentation. This historical use is about the offering, not the shape of a weapon."},
    {word: "bulibuli", question: "A museum displays a wooden object with a rounded, knobbed head. Which sense fits?", options: ["A type of club", "A heap of food"], correct: "A type of club", incorrectHint: "The object's shape and material are clues.", answer: "A traditional club. Auckland Museum catalogues a bulibuli as an object; a museum label and a ceremony can therefore use the same spelling for different things."}
  ],
  link: {label: "See a bulibuli club in Auckland Museum", href: "https://www.aucklandmuseum.com/collection/object/74848"}
};

const pointedEnd = {
  title: "Where is the buku-na?",
  intro: "An older entry uses buku-na for a raised or pointed end, such as on a shell. Some dialects extend it to a tail.",
  cards: [
    {word: "buku-na", question: "If someone points to the tip of a shell, which part of the recorded meaning is relevant?", options: ["Its raised or pointed end", "Two whole coconuts"], correct: "Its raised or pointed end", incorrectHint: "This is a part of one object.", answer: "The raised or pointed end. The spelling buku-na here has an attached -na; do not confuse it with the separate counting word buku.", clues: ["buku"]},
    {word: "buku-na", question: "Could an older regional use point to an animal's tail rather than a shell's tip?", options: ["Yes, in some dialects", "No, the word can only name shells"], correct: "Yes, in some dialects", incorrectHint: "The recorded meaning includes a regional extension.", answer: "Yes. The historical source reports a tail sense in some dialects. Ask which local variety is being spoken before applying that sense generally."}
  ]
};

const valleyOrCondition = {
  title: "A place, or an unhealthy state?",
  intro: "Two historical entries spell this word buca. One describes low land between higher ground; another describes diseased skin or flesh.",
  cards: [
    {word: "buca", question: "On a map, hills rise on both sides of a broad low area. Which buca sense fits?", options: ["A valley or low plain", "Diseased skin"], correct: "A valley or low plain", incorrectHint: "The setting is a landscape.", answer: "A valley or low plain. The other recorded sense applies to an unhealthy condition, not a landform."},
    {word: "buca", question: "If the discussion is about an unhealthy patch of skin, should you picture a valley?", options: ["No, this is the condition sense", "Yes, always"], correct: "No, this is the condition sense", incorrectHint: "The same spelling can have separate meanings.", answer: "No. An older source records a diseased-state sense for skin or flesh. A full current Fijian phrase is still needed before assigning its grammatical role."}
  ]
};

const workTogether = {
  title: "What sort of cakacaka?",
  intro: "Cakacaka can name work in general, but nearby words tell you who works together or what kind of work is meant.",
  cards: [
    {word: "sa cakacaka vata", question: "In a Fiji health statement, what does vata add when two departments sa cakacaka vata?", options: ["They work together", "They stop work"], correct: "They work together", incorrectHint: "Vata brings the workers into one effort.", answer: "They are working together. Cakacaka names the work; vata tells us it is shared in this context.", clues: ["vata", "cakacaka"]},
    {word: "cakacaka ni liga", question: "At a craft sale, would cakacaka ni liga point to the seller's working hours or to handmade things?", options: ["Handmade things", "Only working hours"], correct: "Handmade things", incorrectHint: "Liga is the hand; the Fiji Arts Council account discusses work for sale.", answer: "Handmade work or handicrafts. Cakacaka can also name what has been made, while ni liga narrows the kind of work.", clues: ["liga"]}
  ],
  link: {label: "See cakacaka vata in a Fiji health statement", href: "https://www.fiji.gov.fj/itaukei-statement-by-permanent-secretary-for-health-medical-services-dr-james-fong-28-03-22/"}
};

const reefAndGleaning = {
  title: "The reef and the visit to it",
  intro: "Cakau names a reef. Vakacakau names going onto a reef to gather food there in the recorded use.",
  cards: [
    {word: "cakau", question: "On a coastal map, does cakau mark the reef or a canoe?", options: ["The reef", "A canoe"], correct: "The reef", incorrectHint: "This is a sea feature, not a vessel.", answer: "The reef. Its position matters to anyone finding a route or a place to gather food."},
    {word: "vakacakau", question: "Does vakacakau mean every trip across the water?", options: ["No, it refers to going onto the reef to gather food", "Yes, any sea journey"], correct: "No, it refers to going onto the reef to gather food", incorrectHint: "The recorded action has a place and a purpose.", answer: "No. In the recorded use it is reef gleaning: going onto the cakau to gather food, including shellfish. The word gives more than a direction of travel.", clues: ["cakau"]},
    {word: "cakau / vakacakau", question: "Which word would name the place itself, before anyone starts gathering?", options: ["cakau", "vakacakau"], correct: "cakau", incorrectHint: "One names the reef; the other names the activity.", answer: "Cakau names the reef itself. Vakacakau refers to the food-gathering activity there; it is not another name for the reef.", clues: ["cakau", "vakacakau"]}
  ],
  link: {label: "Read a Fiji study of reef gleaning", href: "https://library.sprep.org/sites/default/files/2021-02/conservation-farming-development-fiji.pdf"}
};

const outriggerCanoe = {
  title: "Part of the canoe, or the whole craft?",
  intro: "Cama is the outrigger support or float. Camakau names a Fijian sailing canoe with one outrigger.",
  cards: [
    {word: "cama", question: "On a camakau, is the cama the supporting outrigger or the entire canoe?", options: ["The outrigger part", "The entire canoe"], correct: "The outrigger part", incorrectHint: "The longer name refers to the craft as a whole.", answer: "The supporting outrigger part. Camakau names the complete sailing canoe; knowing the part helps you recognize the whole craft.", clues: ["camakau"]},
    {word: "camakau / drua", question: "Which traditional Fijian craft has one outrigger rather than two joined hulls?", options: ["camakau", "drua"], correct: "camakau", incorrectHint: "Tourism Fiji describes the drua as double-hulled.", answer: "Camakau. It is a single-hulled canoe with an outrigger; a drua is a double-hulled sailing craft. The two should not be treated as the same canoe.", clues: ["drua", "camakau"]},
    {word: "camakau", question: "In Te Papa's historical photograph, what could the crew shift to change direction?", options: ["The sail and rig", "The island"], correct: "The sail and rig", incorrectHint: "Either end of the canoe could become its bow.", answer: "The sail and rig. Te Papa explains that the crew could shift them to the opposite end, changing direction without turning the entire hull around."}
  ],
  link: {label: "See a Fiji camakau in Te Papa's collection", href: "https://collections.tepapa.govt.nz/object/211367"}
};

const woodenDrum = {
  title: "What does a lali do?",
  intro: "Lali names a Fijian wooden drum; some entries also extend the word to a bell. The sound can signal people or accompany a performance.",
  cards: [
    {word: "lali", question: "A museum object is carved from wood and classified as a drum. Which lali sense are you seeing?", options: ["The wooden drum", "A modern bell"], correct: "The wooden drum", incorrectHint: "The material and museum classification identify the object.", answer: "The wooden drum. The bell extension is a separate use and does not change what this object is."},
    {word: "lali / meke", question: "In a meke, is the lali merely a name for the dancers?", options: ["No, it supports the chanting and dance with rhythm", "Yes, it means the dancers"], correct: "No, it supports the chanting and dance with rhythm", incorrectHint: "Listen for the instrument behind the performance.", answer: "No. Te Papa describes performers chanting with the lali to support the dancers in a meke. Lali names the instrument, not the people dancing.", clues: ["meke"]}
  ],
  link: {label: "Read Te Papa's account of lali in meke", href: "https://blog.tepapa.govt.nz/2013/10/10/lets-meke-fiji-language-week-2013/"}
};

const moonAndMonth = {
  title: "Look up, or look at the calendar?",
  intro: "Vula can mean the moon or a month. The rest of the expression tells you whether the speaker is pointing to the sky or to a stretch of time.",
  cards: [
    {word: "vula", question: "In Te Papa's drawing list, with clouds, mountains and stars, what would you draw for vula?", options: ["The moon", "A page of dates"], correct: "The moon", incorrectHint: "The list asks learners to draw things in the world around them.", answer: "The moon. Vula is the visible object in the sky in that learning activity."},
    {word: "Vula i Nuqa Levu", question: "In Fiji's traditional calendar, is this a moon to draw or the name of a seasonal month?", options: ["A seasonal month", "Only the moon's shape"], correct: "A seasonal month", incorrectHint: "The government calendar names periods by seasonal activities and fish.", answer: "A seasonal month. Vula can mark a month as well as the moon, and Vula i Nuqa Levu is one named period in the traditional calendar. Its fit with Gregorian months is approximate.", clues: ["Vula i Nuqa Levu", "nuqa"]}
  ],
  link: {label: "Explore Fiji's traditional month names", href: "https://www.ndmo.gov.fj/wp-content/uploads/2024/04/CBDRM-Training-Manual.pdf"}
};

const eveningOrMeal = {
  title: "The time or the meal?",
  intro: "Yakavi points to late afternoon or evening. Vakayakavi can name a meal eaten then, so the added form changes what you are talking about.",
  cards: [
    {word: "e na yakavi ni Siga Tabu", question: "Does this phrase place an event on Sunday evening or name a dish?", options: ["It places an event in time", "It names a dish"], correct: "It places an event in time", incorrectHint: "Yakavi names the part of the day here.", answer: "It places the event in the late part of Sunday. The Fiji Times uses the phrase in an account of what happened then.", clues: ["yakavi", "siga"]},
    {word: "yakavi / vakayakavi", question: "If people have already sat down to eat vakayakavi, are you speaking only about the time?", options: ["No, about the evening meal", "Yes, only a clock time"], correct: "No, about the evening meal", incorrectHint: "The longer word appears with eating in Fijian accounts.", answer: "No. Vakayakavi can refer to the evening meal, while yakavi names the late part of the day. The two are connected by time but do different jobs.", clues: ["yakavi"]}
  ],
  link: {label: "Read yakavi and vakayakavi in a Fiji account", href: "https://www.fijitimes.com.fj/lolo-ga-kei-na-masu/"}
};

const windFromEast = {
  title: "Which way is the cagi coming from?",
  intro: "Cagi can mean wind or breeze. When direction is added, it becomes a clue about movement and shelter.",
  cards: [
    {word: "cagi mai na tokalau", question: "In a Fiji Times account, which direction does the cagi come from?", options: ["From the east", "From the west"], correct: "From the east", incorrectHint: "Tokalau names the easterly direction in the account.", answer: "From the east. Cagi names the wind, while mai na tokalau tells where it comes from; the story then explains why people looked for shelter.", clues: ["tokalau"]},
    {word: "cagi", question: "When people move to a more sheltered place, which property of cagi matters most to them?", options: ["Its force and direction", "Its colour"], correct: "Its force and direction", incorrectHint: "The story is about avoiding the wind's effect.", answer: "Its force and direction. In the account, people choose a place where the easterly wind will affect them less. Cagi is more than a word on a weather chart here."}
  ],
  link: {label: "Read the Fiji Times account of cagi from the east", href: "https://www.fijitimes.com.fj/in-the-path-of-the-sun/"}
};

const speakerAndOthers = {
  title: "Who is included?",
  intro: "Fijian pronouns make some distinctions that English 'we' leaves open. Work out who is speaking, who is listening, and who else is included.",
  cards: [
    {word: "au", question: "In Au sa lako, who does au refer to?", options: ["The speaker", "The listener"], correct: "The speaker", incorrectHint: "Au points back to the person saying the sentence.", answer: "The speaker. Au means 'I' here. Au can also mean 'me' as an object; yau can mean 'me' too. Read the whole phrase to tell which role a form has.", clues: ["yau", "sa", "lako"]},
    {word: "au / iko", question: "If I address just you, which form points to you rather than to me?", options: ["iko", "au"], correct: "iko", incorrectHint: "Au points to the speaker.", answer: "Iko points to one listener; au points to the speaker. English 'I' and 'you' separate the same two people, but Fijian also distinguishes a single listener from a group.", clues: ["iko", "kemuni"]}
  ]
};

const oneListener = {
  title: "One listener or several?",
  intro: "Iko addresses one person. Kemuni addresses a group in the meaning recorded here.",
  cards: [
    {word: "iko", question: "You are speaking to one friend. Which recorded pronoun fits that listener?", options: ["iko", "kemuni"], correct: "iko", incorrectHint: "Count the listeners first.", answer: "Iko, for one person being addressed. Kemuni is recorded here for more than one.", clues: ["kemuni"]},
    {word: "kemuni", question: "Now the audience is several friends. Which form changes with the number of listeners?", options: ["kemuni", "iko"], correct: "kemuni", incorrectHint: "The question now addresses the group.", answer: "Kemuni addresses more than one person here. The change is in the pronoun even though English still says 'you'.", clues: ["iko"]}
  ]
};

const heSheThey = {
  title: "One person, or a group?",
  intro: "Koya points to one person without saying whether the person is male or female. Era points to several people.",
  cards: [
    {word: "koya", question: "A story has one person whose gender has not been stated. Can koya still point to that person?", options: ["Yes", "Only if the person is male"], correct: "Yes", incorrectHint: "Do not import English he/she into the Fijian form.", answer: "Yes. Koya can be translated 'he', 'she', 'him' or 'her' according to its role and context. The word itself does not choose a gender."},
    {word: "era / koya", question: "If the story switches from one person to several people, which pronoun changes?", options: ["era", "koya"], correct: "era", incorrectHint: "Koya refers to one person in this contrast.", answer: "Era points to the group; koya to a single person. In the photographed phrase Era lade e na marau, era identifies the people who jumped for joy.", clues: ["era"]}
  ]
};

const exclusiveWe = {
  title: "A small 'we' or a larger one?",
  intro: "Keitou and keimami both leave out the listener. They differ in the size of the group being referred to.",
  cards: [
    {word: "keitou", question: "Three of us are telling you about our trip, and you did not go. Which 'we' fits the small group?", options: ["keitou", "kedaru"], correct: "keitou", incorrectHint: "Kedaru includes the listener and refers to two.", answer: "Keitou. It includes the speaker and a small group of others, but not the person listening. The same form can also be used for 'us' when a sentence calls for that role.", clues: ["kedaru"]},
    {word: "keimami", question: "A larger group speaks to someone outside it. Which form suits that 'we'?", options: ["keimami", "keitou"], correct: "keimami", incorrectHint: "The group here is larger than the small group marked by keitou.", answer: "Keimami is the larger exclusive group. Both pronouns leave out the listener; neither is interchangeable with inclusive 'we'.", clues: ["keitou", "keda"]}
  ]
};

const writingMarks = {
  title: "The mark or the whole system?",
  intro: "Vakavakadigo names punctuation as a system. Koma and ceguleka are two Fijian names for one particular mark, the comma.",
  cards: [
    {word: "vakavakadigo", question: "Would a comma alone be all of vakavakadigo?", options: ["No, it is one of several marks", "Yes, the two words mean exactly the same thing"], correct: "No, it is one of several marks", incorrectHint: "Think of a class and one member of it.", answer: "No. Vakavakadigo covers the marks that organise writing; the comma is just one member of that set.", clues: ["koma", "digo"]},
    {word: "koma / ceguleka", question: "A writer changes the label from koma to ceguleka. Has the printed mark changed?", options: ["No, both name ,", "Yes, one is ;"], correct: "No, both name ,", incorrectHint: "Compare the actual signs, not just their names.", answer: "No. Both words name the comma (,). The paired names are an alternate naming choice, not two different marks.", clues: ["koma", "ceguleka"]},
    {word: "koma / digo", question: "Which mark can divide items inside a continuing sentence without ending it?", options: ["koma (,) ", "digo (.)"], correct: "koma (,) ", incorrectHint: "A full stop closes the sentence.", answer: "Koma, the comma. Digo is the full stop and normally closes a statement; vakavakadigo includes both.", clues: ["digo"]}
  ]
};

const twoMiddleStops = {
  title: "Two marks in the middle of writing",
  intro: "Simikoloni names ; and koloni names :. Both can appear inside a larger sentence, but they guide the reader differently.",
  cards: [
    {word: "simikoloni", question: "Two complete but closely related statements are joined on one line. Which mark can separate them?", options: ["simikoloni (;) ", "koloni (:)"], correct: "simikoloni (;) ", incorrectHint: "The colon usually points forward to an explanation or list.", answer: "A simikoloni (;). It gives a stronger separation than a comma while keeping the linked statements together.", clues: ["koma", "koloni"]},
    {word: "koloni", question: "A sentence announces a list and then gives it. Which mark can introduce what follows?", options: ["koloni (:) ", "simikoloni (;)"], correct: "koloni (:) ", incorrectHint: "Look for a mark that says 'here it comes'.", answer: "A koloni (:). It introduces the list or explanation that follows; a semicolon normally separates material already on the same level.", clues: ["simikoloni"]}
  ]
};

const strongEndMark = {
  title: "A strong ending, not a question",
  intro: "Icegukurau and its shorter name kurau both refer to the exclamation mark (!). An icegutaro is a different mark (?).",
  cards: [
    {word: "icegukurau / kurau", question: "If the writer shortens the Fijian name, does ! become a new mark?", options: ["No, kurau still names !", "Yes, it becomes ?"], correct: "No, kurau still names !", incorrectHint: "Only the name is shorter.", answer: "No. Kurau is the shorter name for the same exclamation mark (!).", clues: ["icegukurau", "kurau"]},
    {word: "icegukurau / icegutaro", question: "Which mark fits a strong exclamation rather than a direct question?", options: ["icegukurau (!) ", "icegutaro (?)"], correct: "icegukurau (!) ", incorrectHint: "Icegutaro ends a question.", answer: "Icegukurau (!). Icegutaro (?) asks; choosing one changes how the written line is heard.", clues: ["icegutaro"]}
  ]
};

const quoteLevels = {
  title: "One pair of quotes inside another",
  intro: "Komalili names single quotation marks; kamalilirua names double quotation marks.",
  cards: [
    {word: "komalili", question: "If a quotation is placed inside another quotation, which smaller pair could mark the inner words?", options: ["‘ ’", "( )"], correct: "‘ ’", incorrectHint: "Parentheses enclose an aside, not a quotation level.", answer: "Komalili: ‘ ’. In one common style, single marks enclose a quotation inside a double-marked quotation. A publication may reverse the outer and inner styles.", clues: ["kamalilirua", "ikovu"]},
    {word: "kamalilirua", question: "Which named pair has two strokes on each side and commonly marks the outer spoken quotation?", options: ["“ ”", "‘ ’"], correct: "“ ”", incorrectHint: "The name refers to the double pair.", answer: "Kamalilirua: “ ”. The important contrast is one stroke versus two; local house style decides which level is outermost.", clues: ["komalili"]}
  ]
};

const linesAndSlash = {
  title: "A range, a break, or an alternative?",
  intro: "These three marks may look like short strokes, but they do different work: itoqaleka (–), itoqabalavu (—), and itoqakala (/).",
  cards: [
    {word: "itoqaleka", question: "Between two page numbers to show a range, which stroke is usually used?", options: ["en dash (–)", "slash (/ )"], correct: "en dash (–)", incorrectHint: "A slash often separates alternatives.", answer: "Itoqaleka, the en dash (–), can join the ends of a range such as pages 2–5. It is shorter than the em dash.", clues: ["itoqabalavu"]},
    {word: "itoqabalavu", question: "A writer wants to interrupt a sentence with a strong aside. Which longer stroke fits?", options: ["em dash (—)", "en dash (–)"], correct: "em dash (—)", incorrectHint: "The en dash is the shorter range mark.", answer: "Itoqabalavu, the em dash (—). It can frame an interruption or shift; it is not the mark for a number range.", clues: ["itoqaleka"]},
    {word: "itoqakala", question: "A form offers two alternatives on one line, yes/no. Which mark divides them?", options: ["slash (/)", "em dash (—)"], correct: "slash (/)", incorrectHint: "The mark leans rather than running across the line.", answer: "Itoqakala, the slash (/). In yes/no it separates alternatives; the dashes have other jobs.", clues: ["itoqaleka", "itoqabalavu"]}
  ]
};

const woodenHeadrest = {
  title: "Why is a kali raised?",
  intro: "A kali is a Fijian wooden headrest, not a soft pillow. Its lifted support makes sense alongside the care given to buiniga hair.",
  cards: [
    {word: "kali", question: "A museum lists a Fijian object as wood, with raised supports. Is kali the headrest or a woven sleeping mat?", options: ["The headrest", "The sleeping mat"], correct: "The headrest", incorrectHint: "Look at what holds the head above the sleeping surface.", answer: "The headrest. Te Papa records a wooden kali made in Fiji; its shape raises and supports the head."},
    {word: "kali / buiniga", question: "Why might a raised kali suit someone with a carefully shaped buiniga?", options: ["It keeps the hair from being pressed flat", "It is used as a hair comb"], correct: "It keeps the hair from being pressed flat", incorrectHint: "Think about what happens to hair against a flat pillow.", answer: "It keeps the hair away from the sleeping surface. Te Papa connects the raised Fijian headrest with preserving a buiniga hairstyle.", clues: ["buiniga"]}
  ],
  link: {label: "See Te Papa's Fijian kali", href: "https://collections.tepapa.govt.nz/object/202340"}
};

const potResin = {
  title: "From tree resin to water vessel",
  intro: "Makadre is resin from the dakua tree. Historically, Fijian potters used it on some water vessels.",
  cards: [
    {word: "makadre", question: "When was makadre rubbed onto a water vessel in the recorded pottery method?", options: ["After firing, while the pot was still hot", "Before the clay was shaped"], correct: "After firing, while the pot was still hot", incorrectHint: "The resin was applied to a finished, heated surface.", answer: "After firing, while the vessel was still hot. The resin helped seal and colour its surface."},
    {word: "makadre", question: "Why was this resin less suitable for a pot put back over the cooking fire?", options: ["It melts with heat", "It makes clay impossible to shape"], correct: "It melts with heat", incorrectHint: "The difference is what happens at the fire after the pot is made.", answer: "Makadre can melt over a cooking fire. A pottery study distinguishes resin-treated water containers from cooking pots waterproofed with other substances."}
  ],
  link: {label: "Read a study of Fijian pottery", href: "https://lir.byuh.edu/index.php/pacific/article/download/2419/2345/4606"}
};

const houseFoundation = {
  title: "A foundation in land and in language",
  intro: "Yavu names the base of a house site. In Tuvavosa it also names the meaningful base around which a phrase is built.",
  cards: [
    {word: "yavu", question: "At an ancestral village site, would a yavu be the ground of a former house or its thatched roof?", options: ["The house foundation or site", "Only the roof"], correct: "The house foundation or site", incorrectHint: "The house may be gone while the base remains.", answer: "The foundation or house site. Research in Fiji describes a yavu as the earth-and-stone base of a house, sometimes retaining ancestral significance.", clues: ["vale"]},
    {word: "yavu", question: "In na vale levu, which word is the yavu that levu describes?", options: ["vale", "na"], correct: "vale", incorrectHint: "Na opens the phrase; the house is what is described.", answer: "Vale. Here yavu is a Tuvavosa term for the central meaningful base, while na is the mata and levu adds a description. This grammatical use should not be confused with the physical house foundation.", clues: ["vale", "mata", "levu"]}
  ],
  link: {label: "Read about the meaning of yavu at a Fiji village site", href: "https://www.frontiersin.org/journals/climate/articles/10.3389/fclim.2022.1034765/full"}
};

const lightSources = {
  title: "What makes the light?",
  intro: "Cina can be a lamp or torch. Bawara names the coconut flower sheath once used as material for a torch.",
  cards: [
    {word: "cina", question: "If a visitor asks for a light, does cina tell you by itself whether the source is a lamp or a hand torch?", options: ["No, the setting decides", "Yes, it must be a lamp"], correct: "No, the setting decides", incorrectHint: "The word is recorded for both objects.", answer: "No. Cina is recorded for both lamp and torch; the surrounding situation tells you which one is meant."},
    {word: "cina / bawara", question: "In an older coconut-sheath torch, which word names the plant material rather than the light-giving object?", options: ["bawara", "cina"], correct: "bawara", incorrectHint: "One names a coconut flower sheath; the other names a lamp or torch.", answer: "Bawara is the sheath material. A cina may be a torch, but not every cina is made from bawara.", clues: ["bawara"]}
  ],
  link: {label: "Check cina as lamp or torch", href: "https://www.unitec.ac.nz/umisc/jmctest/fijian_english_dictionary/fijian_eng_dict.html"}
};

const bagAndNet = {
  title: "A bag word at the shore",
  intro: "Taga can name a bag or a small net. The object being carried and the action at low tide help you select the sense.",
  cards: [
    {word: "taga", question: "Someone puts belongings in a taga for a trip. Which sense fits?", options: ["A bag or pouch", "The action of fishing"], correct: "A bag or pouch", incorrectHint: "The person is carrying belongings, not catching fish.", answer: "A bag or pouch. The same word also has a recorded small-net sense; the contents and setting make the difference."},
    {word: "taga at low tide", question: "In an older account of fishing at low tide, what does taga point to?", options: ["Fishing with a small net", "Storing clothes in a bag"], correct: "Fishing with a small net", incorrectHint: "The setting is the shore at low tide.", answer: "Fishing with a small taga net. The older source records both the net and an action using it; current community usage still needs checking before applying the action sense broadly.", clues: ["lawa"]}
  ],
  link: {label: "Read the historical taga entries", href: "https://upload.wikimedia.org/wikipedia/commons/8/80/A_Fijian_and_English_and_an_English_and_Fijian_dictionary%2C_with_examples_of_common_and_peculiar_modes_of_expression_and_uses_of_words%2C_also%2C_containing_brief_hints_on_native_customs_%28IA_fijianenglishand00hazl%29.pdf"}
};

const ladyAndTitle = {
  title: "Marama in different settings",
  intro: "Marama can refer to a woman or lady. In some community contexts it is also connected with a woman's status or title.",
  cards: [
    {word: "marama", question: "Does marama by itself identify one particular woman?", options: ["No, context identifies her", "Yes, it is one person's name"], correct: "No, context identifies her", incorrectHint: "The word can refer to many women.", answer: "No. Marama is a word for a woman or lady, not a personal name; context tells you which person is meant."},
    {word: "Marama ni Yavusa", question: "Why does this longer expression need more care than simply translating marama as 'woman'?", options: ["It refers to a role within a yavusa", "It means every woman in Fiji"], correct: "It refers to a role within a yavusa", incorrectHint: "The added words locate a social role.", answer: "It is used for women who hold chiefly titles in their communities. Marama can participate in a title or role; the whole expression and local tradition matter.", clues: ["yavusa"]}
  ],
  link: {label: "Read about Marama ni Yavusa", href: "https://www.fijitimes.com.fj/women-chiefs-to-be-recognised/"}
};

const independentSpeaker = {
  title: "Where does yau fit?",
  intro: "Yau and au both refer to the speaker. O yau can stand independently, but yau can also refer to the speaker as an object. The phrase tells you which use you are seeing.",
  cards: [
    {word: "o yau", question: "If someone asks who is responsible and the answer is just 'I am', which recorded Fijian expression can stand on its own?", options: ["o yau", "au sa lako"], correct: "o yau", incorrectHint: "The other phrase makes a statement about the speaker's going.", answer: "O yau can stand as an independent answer identifying the speaker. Yau is not a different person from au; it is a fuller pronoun form in this use.", clues: ["au", "mata"]},
    {word: "au / yau", question: "If you find yau in a phrase, must it always mean 'I' rather than 'me'?", options: ["No", "Yes"], correct: "No", incorrectHint: "The founder also records yau referring to the speaker as an object.", answer: "No. Yau can mean 'me' in an object use. Au can also mean 'me'; do not assign either form a permanent English subject or object label without the phrase.", clues: ["au", "isosomi"]}
  ],
  link: {label: "Read a linguistic discussion of o yau", href: "https://citeseerx.ist.psu.edu/document?doi=c8ff515f21f50a50ec3959061eeaa97a0c03b56c&repid=rep1&type=pdf"}
};

const hourAndMinute = {
  title: "How much time?",
  intro: "Aua and auwa are spellings for an hour. Keep this time word separate from au, the pronoun for the speaker.",
  cards: [
    {word: "aua / auwa", question: "Someone writes auwa instead of aua. Has the sixty-minute unit changed?", options: ["No, both name an hour", "Yes, auwa names a minute"], correct: "No, both name an hour", incorrectHint: "The founder supplies these as spellings of the same time word.", answer: "No. Aua and auwa both name an hour. The spelling preference still needs checking; the meaning is the same.", clues: ["aua", "auwa"]},
    {word: "aua / miniti", question: "If sixty miniti have passed, how many aua is that?", options: ["One", "Sixty"], correct: "One", incorrectHint: "A miniti is a minute, while an aua is an hour.", answer: "One aua: sixty miniti make an hour. Compare the two time words rather than confusing aua with the pronoun au.", clues: ["miniti", "au"]}
  ],
  link: {label: "See aua in the Unitec Fijian vocabulary", href: "https://www.unitec.ac.nz/umisc/jmctest/fijian_english_dictionary/fijian_eng_dict.html"}
};

const thirdPersonNumber = {
  title: "How many people are 'they'?",
  intro: "Fijian can mark two, a small group, and a larger group where English simply says 'they'.",
  cards: [
    {word: "rau", question: "A story now follows exactly two people. Which form points to those two?", options: ["rau", "ira"], correct: "rau", incorrectHint: "Ira is the larger-group form.", answer: "Rau refers to the two of them. It is a pronoun for people in the story, not the numeral rua used to count objects.", clues: ["rua", "ira"]},
    {word: "iratou", question: "The story changes to a few people, more than the pair. Which full pronoun fits that small group?", options: ["iratou", "rau"], correct: "iratou", incorrectHint: "Rau refers to the pair.", answer: "Iratou refers to a small group of them. The related shorter subject form ratou can appear in another sentence position; do not treat it as a different group.", clues: ["rau", "ira"]},
    {word: "ira", question: "Now the speaker means a larger group rather than a pair or a few. Which form fits?", options: ["ira", "rau"], correct: "ira", incorrectHint: "A pair is rau.", answer: "Ira is the larger-group 'they/them' form. The independent pronouns distinguish group size more finely than English 'they'.", clues: ["rau", "iratou"]}
  ],
  link: {label: "See the Fijian pronoun number table", href: "https://link.springer.com/article/10.1007/s11049-019-09442-1"}
};

const inclusiveGroup = {
  title: "Does 'we' include you?",
  intro: "Kedatou and keda both include the listener. The group size changes; keimami leaves the listener out.",
  cards: [
    {word: "kedatou", question: "A few of us, including you, are planning together. Which full pronoun fits?", options: ["kedatou", "keimami"], correct: "kedatou", incorrectHint: "Keimami excludes the listener.", answer: "Kedatou: the speaker, the listener, and a small group. Datou is a shorter form used in another position; it does not make a new group.", clues: ["datou", "keimami"]},
    {word: "keda", question: "A whole village speaks as 'we' and includes you. Which full form suits the larger group?", options: ["keda", "kedatou"], correct: "keda", incorrectHint: "The group is larger than the small group indicated by kedatou.", answer: "Keda. It can also mean 'us' when the larger inclusive group is the object in a sentence. Da is the related short subject form.", clues: ["da", "kedatou"]},
    {word: "keda / keimami", question: "If we tell you about a plan that you are part of, can we choose keimami without changing who is included?", options: ["No", "Yes"], correct: "No", incorrectHint: "One form includes the listener and the other does not.", answer: "No. Keda includes you; keimami excludes you. English 'we' alone does not make that boundary visible.", clues: ["keimami"]}
  ],
  link: {label: "See inclusive and exclusive Fijian pronouns", href: "https://link.springer.com/article/10.1007/s11049-019-09442-1"}
};

const enclosingMarks = {
  title: "An aside or an editorial note?",
  intro: "Ikovu is ( ); ikovurivi is [ ]. The two shapes can separate different kinds of added information.",
  cards: [
    {word: "ikovu", question: "A writer adds a brief aside in the same voice. Which named pair can enclose it?", options: ["ikovu ( )", "ikovurivi [ ]"], correct: "ikovu ( )", incorrectHint: "Square brackets often signal an insertion or editorial clarification.", answer: "Ikovu, the round parentheses. The information inside is supplementary to the surrounding line.", clues: ["ikovurivi"]},
    {word: "ikovurivi", question: "An editor inserts a clarification inside somebody else's quoted words. Which pair can show that intervention?", options: ["ikovurivi [ ]", "ikovu ( )"], correct: "ikovurivi [ ]", incorrectHint: "The square shape is useful for an editorial addition.", answer: "Ikovurivi, square brackets. They help distinguish an editor's addition from the original quotation; round parentheses have a different ordinary use.", clues: ["ikovu", "komalili"]}
  ]
};

const underscoreMark = {
  title: "A line below, not across",
  intro: "Itoqaruku is the underscore (_). It sits low on the writing line, unlike either dash.",
  cards: [
    {word: "itoqaruku", question: "In a file name where spaces are avoided, which mark can join two words while remaining below the letters?", options: ["underscore (_)", "em dash (—)"], correct: "underscore (_)", incorrectHint: "Look for the mark under the writing line.", answer: "Itoqaruku, the underscore. It is often used in file names and identifiers where a visible word separator is needed.", clues: ["itoqabalavu"]},
    {word: "itoqaruku / itoqakala", question: "A web path divides folders with /, while a file name may join words with _. Which Fijian name belongs to _?", options: ["itoqaruku", "itoqakala"], correct: "itoqaruku", incorrectHint: "Itoqakala names the slash.", answer: "Itoqaruku names _. Itoqakala names /. The two marks even behave differently in file paths, so swapping them can change what a computer reads.", clues: ["itoqakala"]}
  ]
};

const everydayBread = {
  title: "Which bread is meant?",
  intro: "Madrai commonly names bread. Fiji also has bila, a traditional bread made from ivi nuts or other starchy foods.",
  cards: [
    {word: "madrai", question: "At a bakery, someone waits for newly baked madrai. What are they waiting to buy?", options: ["Bread", "A fishing net"], correct: "Bread", incorrectHint: "The setting is a bakery.", answer: "Bread. A Fiji Times account recalls children buying fresh madrai from a bakery near their village."},
    {word: "madrai / bila", question: "If a recipe starts with ivi nuts for a traditional bread, which related dictionary word should you explore?", options: ["bila", "pae"], correct: "bila", incorrectHint: "Pae is a pie.", answer: "Bila. It names a traditional Fijian bread, whereas the bakery scene uses madrai for everyday bread. A word can travel between food traditions; the ingredients and occasion tell you what is on the plate.", clues: ["bila"]}
  ],
  link: {label: "Read a Fiji account of a village bakery", href: "https://www.fijitimes.com.fj/matai-ni-vale-ni-madrai/"}
};

const cabbageChoices = {
  title: "Which kaveti?",
  intro: "Kaveti is cabbage. A longer name can narrow the variety without replacing the vegetable word.",
  cards: [
    {word: "kaveti", question: "In a garden list, does kaveti name a leafy vegetable or a fruit tree?", options: ["A leafy vegetable", "A fruit tree"], correct: "A leafy vegetable", incorrectHint: "Think of cabbage leaves.", answer: "A leafy vegetable: cabbage. The owner supplied this spelling, and a Fiji school gardening guide uses it for cabbage."},
    {word: "kaveti ni Jaina", question: "What does ni Jaina add to kaveti in the school garden guide?", options: ["It specifies Chinese cabbage", "It means any cabbage has become a cake"], correct: "It specifies Chinese cabbage", incorrectHint: "The phrase narrows the kind of cabbage.", answer: "Chinese cabbage. The whole phrase distinguishes that garden crop from cabbage in general; ni Jaina is a naming clue, not a new meaning for kaveti alone.", clues: ["ni"]}
  ],
  link: {label: "See kaveti ni Jaina in a Fiji garden guide", href: "https://www.nutritionandhealthfiji.com/uploads/5/7/2/8/57283159/_our_school_gardens_guide.pdf"}
};

const fernAtMarket = {
  title: "Which greens are ota?",
  intro: "Ota is an edible freshwater fern. Its young fronds are sold as greens; rourou instead comes from dalo leaves.",
  cards: [
    {word: "ota / rourou", question: "Two cooked greens are on a market stall. Which one comes from a fern rather than a taro plant?", options: ["ota", "rourou"], correct: "ota", incorrectHint: "Rourou is the leaf side of dalo.", answer: "Ota is the fern; rourou is made from taro leaves. Both may be eaten as greens, but they are not the same plant.", clues: ["rourou", "dalo"]},
    {word: "ota", question: "Why are the tender fronds blanched rather than treated like a starchy root?", options: ["To keep the fern greens tender and crisp", "Because ota is a kind of dalo corm"], correct: "To keep the fern greens tender and crisp", incorrectHint: "Tourism Fiji describes the fronds being stripped and briefly cooked.", answer: "The tender ota fronds are washed and blanched so they remain crisp. The word points to an edible fern shoot, not a root crop."}
  ],
  link: {label: "See ota in a Fiji food market", href: "https://www.fiji.travel/things-to-do/local-eats/unusual-fijian-foods"}
};

const fuelAndFlame = {
  title: "Wood ready to burn, or fire burning?",
  intro: "Buka can name firewood or fire. Bukawaqa points more specifically to a fire that is actively burning.",
  cards: [
    {word: "buka", question: "A family stacks wood at the beach before lighting it. Can that fuel already be called buka?", options: ["Yes", "Only after it catches"], correct: "Yes", incorrectHint: "Buka also names firewood.", answer: "Yes. Buka can refer to the fuel before it burns; context also allows a fire sense.", clues: ["bukawaqa"]},
    {word: "bukawaqa", question: "The flames are rising and more wood is added. Which form makes the burning state clearer?", options: ["bukawaqa", "buka alone"], correct: "bukawaqa", incorrectHint: "The longer recorded word is the more specific live-fire label.", answer: "Bukawaqa. A Fiji Bible Week text distinguishes a burning bukawaqa from the buka added to feed it.", clues: ["buka"]},
    {word: "buka / bukawaqa", question: "If the fire goes out but a pile of fuel remains, has every bit of buka vanished?", options: ["No, the firewood may remain", "Yes, buka can only mean flames"], correct: "No, the firewood may remain", incorrectHint: "The shorter word has a fuel sense too.", answer: "No. Buka can still be the unburnt wood. Bukawaqa names the fire in action; the distinction helps you follow what is happening in the scene.", clues: ["bukawaqa"]}
  ],
  link: {label: "Read a Fijian account of a beach fire", href: "https://biblemonth.bible.org.fj/wp-content/uploads/2022/06/2022-Fijian-Bible-Week.pdf"}
};

const healthAndName = {
  title: "Healthy, flourishing, or a species name?",
  intro: "Bulabula can describe health or flourishing. It also appears in the scientific name of one Fijian banded iguana.",
  cards: [
    {word: "tiko bulabula", question: "In a discussion of people's wellbeing, what does bulabula contribute to this expression?", options: ["Being healthy", "Being a type of bread"], correct: "Being healthy", incorrectHint: "The topic is people's health.", answer: "Tiko bulabula is used for living in good health. Bula is related to life and health, but bulabula in this phrase describes a healthy condition.", clues: ["bula"]},
    {word: "Brachylophus bulabula", question: "If bulabula is part of this iguana's scientific name, does it prove that every individual iguana is healthy?", options: ["No, it is a species name", "Yes, the name diagnoses each animal"], correct: "No, it is a species name", incorrectHint: "A scientific name identifies a kind of animal, not its medical condition.", answer: "No. Researchers chose bulabula as the name of a Fijian banded-iguana lineage. The familiar word travels into science, but the species name is not a health report on every animal.", clues: ["bula"]}
  ],
  link: {label: "Read the research that named the iguana", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2607380/"}
};

const playOrMatch = {
  title: "Playing, or the game itself?",
  intro: "Qito can refer to play and to a game or sport. The surrounding words reveal which use is meant.",
  cards: [
    {word: "qito rakavi", question: "In a Fiji sports report, which sport does rakavi specify after qito?", options: ["Rugby", "Fishing"], correct: "Rugby", incorrectHint: "Rakavi narrows the kind of sport.", answer: "Rugby. Qito is the broader play or sport word; rakavi tells you which game the report concerns.", clues: ["qito"]},
    {word: "me ratou na qito", question: "When a coach urges players to perform well, does qito here name a game as an object or what the players do?", options: ["What the players do", "A named playing field"], correct: "What the players do", incorrectHint: "The coach is telling the team how to act.", answer: "What they do: play. The Fiji Times uses me ratou na qito in advice to players, while na qito in a sports report can name the game itself."}
  ],
  link: {label: "Read qito in Fiji rugby reporting", href: "https://www.fijitimes.com.fj/qito-se-o-vakacegui/"}
};

const oneAndEleven = {
  title: "One, then one more than ten",
  intro: "Dua counts one. In a longer number, it can contribute the extra one after ten.",
  cards: [
    {word: "e dua na ika", question: "How many fish does this recorded counting phrase indicate?", options: ["One", "Two"], correct: "One", incorrectHint: "Dua is the number one.", answer: "One fish. The phrase shows the number with na and ika, rather than leaving dua as a word on a number chart.", clues: ["na", "ika"]},
    {word: "tini ka dua", question: "If tini is ten, what does the added dua make in this recorded number?", options: ["Eleven", "Twenty"], correct: "Eleven", incorrectHint: "Start at ten and add one.", answer: "Eleven. The longer expression retains dua's one while ka joins it to ten.", clues: ["tini"]}
  ],
  link: {label: "See Fijian number examples", href: "https://www.fijiguide.com/culture/language/useful-words-and-phrases/"}
};

const twoAndDual = {
  title: "Counting two and referring to two",
  intro: "Rua counts two things. Rau is a pronoun meaning 'the two of them'; one word does not simply replace the other.",
  cards: [
    {word: "e rua na ika", question: "Which word gives the number of fish in this phrase?", options: ["rua", "ika"], correct: "rua", incorrectHint: "Ika tells you what is being counted.", answer: "Rua gives the count: two fish. Ika names the fish, and na introduces it in the counting phrase.", clues: ["ika", "na"]},
    {word: "rua / rau", question: "A story says 'the two of them' and no longer counts fish. Which form refers to the people?", options: ["rau", "rua"], correct: "rau", incorrectHint: "Rua is the numeral; the pronoun has a different order of vowels.", answer: "Rau. The swapped vowels matter: rua is the number two, while rau points to two people already in the story.", clues: ["rau"]}
  ],
  link: {label: "See e rua na ika in a Fijian phrase guide", href: "https://www.fijiguide.com/culture/language/useful-words-and-phrases/"}
};

const threeAndGroup = {
  title: "A count of three and a group of 'we'",
  intro: "Tolu is three. Keitou is a pronoun for a small 'we' that excludes the listener; counting and including people are separate decisions.",
  cards: [
    {word: "tolu", question: "In the sequence dua, rua, tolu, what count does tolu complete?", options: ["Three", "Four"], correct: "Three", incorrectHint: "It follows two.", answer: "Three. Te Papa's Fijian number activity lists tolu as the third count.", clues: ["dua", "rua"]},
    {word: "tolu / keitou", question: "Three friends tell you 'we went', but you stayed behind. Which pronoun makes their membership clear?", options: ["keitou", "kedatou"], correct: "keitou", incorrectHint: "Kedatou includes the listener.", answer: "Keitou for a small group that excludes you. Tolu counts exactly three; keitou marks a small speaker group and whether you are in it, rather than functioning as the numeral itself.", clues: ["keitou", "kedatou"]}
  ],
  link: {label: "Try Te Papa's Fijian counting activity", href: "https://www.tepapa.govt.nz/assets/76067/1693189257-fijian_language_activity_book_a4_0.pdf"}
};

const tenAndCompound = {
  title: "Ten on its own and inside a number",
  intro: "Tini counts ten. Another ten element, sagavulu, appears in longer numbers rather than replacing tini in every position.",
  cards: [
    {word: "tini", question: "At the end of counting from dua upward, which word is ten by itself?", options: ["tini", "rua"], correct: "tini", incorrectHint: "Rua is only two.", answer: "Tini is ten. The distinct form matters before you learn numbers built beyond ten.", clues: ["dua", "rua"]},
    {word: "ruasagavulu", question: "In the recorded form for twenty, which piece signals two tens?", options: ["rua with sagavulu", "tini ka dua"], correct: "rua with sagavulu", incorrectHint: "Tini ka dua is eleven.", answer: "Rua with sagavulu makes twenty. Tini is ten on its own, while sagavulu is used within this larger number.", clues: ["rua", "sagavulu"]}
  ],
  link: {label: "Read a Fijian numeral list", href: "https://fsi-languages.yojik.eu/languages/PeaceCorps/Fijian/ED131693.pdf"}
};

const birthAndCalendar = {
  title: "Born, birthday, or Christmas?",
  intro: "Sucu means to be born. Siga ni sucu adds a day, and context determines whether it means a person's birthday or Christmas Day.",
  cards: [
    {word: "siga ni sucu", question: "A form asks for your personal date of birth. Which meaning of this phrase fits?", options: ["Your birthday", "A public holiday for everyone"], correct: "Your birthday", incorrectHint: "The form asks about your own birth.", answer: "Your birthday or date of birth. A Fiji government form asks for a person's siga ni sucu alongside their name and contact details.", clues: ["siga", "ni"]},
    {word: "Siga ni Sucu", question: "A newspaper writes about celebrations in late December. Could the same words now point to Christmas?", options: ["Yes", "No, always one person's birthday"], correct: "Yes", incorrectHint: "Look at the calendar and public setting.", answer: "Yes. Siga ni Sucu can refer to Christmas Day in that context. The shared sucu idea is birth, but the occasion must be read from the whole setting."}
  ],
  link: {label: "See siga ni sucu on a Fiji government form", href: "https://www.fiji.gov.fj/getattachment/5cdbb97e-20ae-4820-8dd9-0c73fd830891/HELP-FOR-HOMES---APPLICATION-FOR-A-GRANT.aspx"}
};

const walkingJourneys = {
  title: "A few steps or a long walk?",
  intro: "Taubale is travel on foot. The distance and destination come from the rest of the account.",
  cards: [
    {word: "taubale yani ki tuba", question: "In an account of a parked car, did Saiasi drive away or move out on his feet?", options: ["He moved on his feet", "He drove away"], correct: "He moved on his feet", incorrectHint: "The vehicle had already stopped.", answer: "He walked out. Taubale names the walking, while yani ki tuba gives the direction in this recorded account.", clues: ["lako"]},
    {word: "taubaletaka kina sivia e dua na drau tolusagavulu vakacaca na maile", question: "What makes the second recorded walk much more than a few steps?", options: ["The distance: over 130 miles", "The walker changed shoes"], correct: "The distance: over 130 miles", incorrectHint: "Look at the quantity following the walking form.", answer: "The distance. In this historical account, the walk exceeded 130 miles. The longer form and distance show how much ground was covered; do not assume taubale itself means a long journey.", clues: ["dua", "tolu"]}
  ],
  link: {label: "Read the account of a long walk in Fiji", href: "https://www.fijitimes.com.fj/na-loloma-e-sega-ni-vakaiyalayala/"}
};

const greetingAndLife = {
  title: "A greeting with life in it",
  intro: "Bula is heard as a greeting, but its meanings also touch on life and health. The situation decides which one is foremost.",
  cards: [
    {word: "Bula!", question: "When someone welcomes a visitor with Bula!, is a medical diagnosis being made?", options: ["No, it is a greeting", "Yes, it confirms the visitor is healthy"], correct: "No, it is a greeting", incorrectHint: "The encounter is a welcome.", answer: "No. It greets the visitor, while carrying a wish associated with life and good health. Fiji's tourism guide records both layers."},
    {word: "bula / bulabula", question: "A conversation turns from greeting to a person's continuing wellbeing. Which related word especially describes being healthy?", options: ["bulabula", "pae"], correct: "bulabula", incorrectHint: "Pae names a pie.", answer: "Bulabula can describe a healthy state. Bula is also a greeting and can mean life; the repeated form is useful in a health phrase such as tiko bulabula.", clues: ["bulabula"]}
  ],
  link: {label: "See Tourism Fiji's explanation of bula", href: "https://specialist.fiji.travel/lessons/introduction-to-fiji-culture-traditions"}
};

const carryingAndFootwear = {
  title: "Carrying on a back, or wearing on feet?",
  intro: "Vava is recorded for carrying a person on one's back. Ivava is a different whole word for footwear.",
  cards: [
    {word: "vava", question: "A baby is carried against an adult's back. Which meaning of vava fits?", options: ["Carry a person on the back", "Put shoes on"], correct: "Carry a person on the back", incorrectHint: "The person being carried is on the back.", answer: "To carry a person on the back, especially a child in the recorded description."},
    {word: "vava / ivava", question: "A school list asks children to bring ivava. Does that mean they should carry someone on their backs?", options: ["No, it refers to footwear", "Yes, it is the same action"], correct: "No, it refers to footwear", incorrectHint: "The added i- belongs to another recorded whole word.", answer: "No. Ivava refers to shoes or footwear; vava here is the carrying action. Their similar shape is a clue to inspect, not a licence to guess that they mean the same thing.", clues: ["ivava", "i-"]}
  ],
  link: {label: "See vava in a Pacific comparative wordlist", href: "https://pollex.eva.mpg.de/entry/fafa.1/"}
};

const waveAtReef = {
  title: "What moves beyond the reef?",
  intro: "Biau names a wave; cakau names the reef. A wave may break near a reef, but the two words name different things.",
  cards: [
    {word: "vuso ni biau", question: "In a Fiji Times description of white foam behind the reef, what is producing the foam?", options: ["The waves", "The forest"], correct: "The waves", incorrectHint: "Biau is the moving water.", answer: "The waves. Vuso ni biau evokes their foam; the phrase gives biau a visible coastal scene.", clues: ["ni", "cakau"]},
    {word: "biau / cakau", question: "Which word names the fixed reef, rather than the water breaking near it?", options: ["cakau", "biau"], correct: "cakau", incorrectHint: "Biau moves across the water.", answer: "Cakau is the reef. Biau is the wave. A navigator may have to watch both, but knowing one does not tell you the other's meaning.", clues: ["cakau"]}
  ],
  link: {label: "Read the coastal description in the Fiji Times", href: "https://www.fijitimes.com.fj/liwava-na-seda-na-cagi-ni-sauca/"}
};

window.NAISEMA_WORD_PLAY = {
  bobula: bondage, bobulataka: bondage,
  vale: [possession, houseOrder], valenisili: houses, valenikana: houses, valenivolavola: houses,
  vosa: speech, veivosaki: speech,
  dogo: mangroves, veidogo: mangroves,
  keirau: twoPeople, kedaru: twoPeople,
  dalo: taro, rourou: taro,
  digo: marks, icegutaro: marks,
  keke: loans, bisikete: loans,
  bati: possession, kete: stomachMarker, niu: coconuts, veiniu: coconuts, veiniuniu: coconuts,
  lako: [predicate, journeyNoun, movement], ilakolako: journeyNoun, veilakoyaki: movement, cici: movement, veiciciyaki: movement,
  veivakamocetaki: farewell, veivosataki: speech,
  beitaka: accusation, raica: seeing, gunu: drinking,
  qari: shoreCrabs, lairo: shoreCrabs, ura: prawnOrLobster, urau: prawnOrLobster,
  kanace: mullets, koto: mullets, apolo: appleOrder, lawa: netOrRule,
  sa: saInquiry, na: naInquiry,
  bewa: bananaCount, bose: villageMeetings, bilo: drinkingCup, bai: fenceBoundary,
  balabala: treeFern, balawa: pandanusMat, bitu: bambooInFiji, bogi: nightAndDay,
  bure: manyBure, buno: sweatAndHeat, bunobunoa: sweatAndHeat, bunokata: sweatAndHeat,
  bawara: coconutFlowerSheath, buku: pairedCoconuts, bila: iviBread,
  bale: spearOrTitle, basa: alignmentOrBazaar, benu: discardedThings,
  bulibuli: twoBulibuli, "buku-na": pointedEnd, buca: valleyOrCondition,
  cakacaka: workTogether, cakau: reefAndGleaning, vakacakau: reefAndGleaning,
  cama: outriggerCanoe, camakau: outriggerCanoe, lali: woodenDrum,
  vula: moonAndMonth, yakavi: eveningOrMeal, cagi: windFromEast,
  au: speakerAndOthers, iko: [speakerAndOthers, oneListener], kemuni: oneListener,
  koya: heSheThey, era: heSheThey, keitou: exclusiveWe, keimami: exclusiveWe,
  vakavakadigo: writingMarks, koma: writingMarks, ceguleka: writingMarks,
  simikoloni: twoMiddleStops, koloni: twoMiddleStops,
  icegukurau: strongEndMark, kurau: strongEndMark,
  komalili: quoteLevels, kamalilirua: quoteLevels,
  itoqaleka: linesAndSlash, itoqabalavu: linesAndSlash, itoqakala: linesAndSlash,
  kali: woodenHeadrest, makadre: potResin, yavu: houseFoundation,
  cina: lightSources, taga: bagAndNet, marama: ladyAndTitle,
  yau: independentSpeaker, aua: hourAndMinute, auwa: hourAndMinute,
  rau: thirdPersonNumber, iratou: thirdPersonNumber,
  ira: thirdPersonNumber, kedatou: inclusiveGroup, keda: inclusiveGroup,
  ikovu: enclosingMarks, ikovurivi: enclosingMarks, itoqaruku: underscoreMark,
  madrai: everydayBread, kaveti: cabbageChoices, ota: fernAtMarket,
  buka: fuelAndFlame, bukawaqa: fuelAndFlame, bulabula: healthAndName,
  qito: playOrMatch, dua: oneAndEleven, rua: twoAndDual,
  tolu: threeAndGroup, tini: tenAndCompound,
  sucu: birthAndCalendar, taubale: walkingJourneys,
  bula: greetingAndLife, vava: carryingAndFootwear, biau: waveAtReef
};

