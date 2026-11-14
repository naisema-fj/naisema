// Checked, word-specific questions that stay inside the entry the reader opened.
(() => {
  const card = (question, options, correct, answer, clues = []) => ({ question, options, correct, answer, clues });
  const play = (title, intro, word, cards, link) => ({ title, intro, cards: cards.map(item => ({ word, ...item })), ...(link ? { link } : {}) });
  const crops = { label: "Explore Fiji's home-gardening guide", href: "https://www.agriculture.gov.fj/documents/booklets/GrowyourownFood.pdf" };
  const additions = {
    baigani: play("The crop behind the name", "Baigani is eggplant or aubergine. Fiji's food-growing guide groups it with transplanted vegetables, rather than starchy staples.", "baigani", [
      card("A grower raises baigani seedlings before moving them into the garden. Is that the guide's approach for this crop or for tavioka?", ["Baigani", "Tavioka"], "Baigani", "Baigani is listed among transplanted vegetables. Tavioka is listed among starchy crops planted from cuttings.", ["tavioka"]),
      card("If a market table has baigani and kumala, which one is the eggplant?", ["Baigani", "Kumala"], "Baigani", "Kumala is sweet potato. The two names point to different plants and different parts of a meal.", ["kumala"])
    ], crops),
    tavioka: play("Cassava in a Fiji garden", "Tavioka names cassava. The Fiji guide groups it with starchy staples and lists cuttings as planting material.", "tavioka", [
      card("A family plants tavioka from stem cuttings. Which crop is it growing: cassava or sweet potato?", ["Cassava", "Sweet potato"], "Cassava", "Tavioka is cassava; kumala is sweet potato, whose vine cuttings are used for planting.", ["kumala"]),
      card("The guide names tavioka and uvi as resilient starchy crops. Does that make them two names for the same plant?", ["No", "Yes"], "No", "Tavioka is cassava and uvi is yam. They share a food-crop group without becoming synonyms.", ["uvi"])
    ], crops),
    uvi: play("Which root crop?", "Uvi is yam. Fiji's food guide lists it beside tavioka and kumala but keeps the three crop names separate.", "uvi", [
      card("A recipe asks for uvi. Would replacing it with tavioka keep the same crop name?", ["No", "Yes"], "No", "Uvi names yam; tavioka names cassava. A cook may substitute ingredients, but the words do not name one crop.", ["tavioka"]),
      card("The garden guide gives cuttings or toppings for planting uvi. Does that instruction identify baigani seedlings?", ["No", "Yes"], "No", "The guide treats uvi as a starchy crop; baigani is an eggplant raised as a transplanted vegetable.", ["baigani"])
    ], crops),
    kumala: play("Sweet potato has its own name", "Kumala names sweet potato. A Fiji crop guide recommends planting healthy vine cuttings and describes several cultivated varieties.", "kumala", [
      card("If a grower sets healthy vine cuttings for kumala, is the crop sweet potato or cassava?", ["Sweet potato", "Cassava"], "Sweet potato", "Kumala is sweet potato; tavioka is cassava. The crop guide describes planting kumala from its vine.", ["tavioka"]),
      card("Does kumala identify just one named variety, such as Vulatolu?", ["No", "Yes"], "No", "Kumala is the crop name. Vulatolu is one variety listed in Fiji's crop guide, so the broader word does not identify a cultivar by itself.", ["nauni"])
    ], { label: "See kumala varieties and planting advice", href: "https://www.agriculture.gov.fj/documents/booklets/cropguide.pdf" }),
    dovu: play("From cane field to sugar", "Dovu is sugarcane. Fiji's public reports use musu dovu for cane cutting, an activity tied to the sugar industry.", "dovu", [
      card("In the recorded phrase musu dovu, what is being cut?", ["Sugarcane", "Cassava"], "Sugarcane", "Dovu is the cane crop; tavioka is cassava. The Fiji Corrections Service uses musu dovu for its cane-cutting programme.", ["tavioka"]),
      card("A report discusses the price paid per tonne of dovu. Does dovu name the harvested cane or the white sugar on a table?", ["The cane", "The table sugar"], "The cane", "The report measures harvested sugarcane by weight. Dovu names the plant and its stalks, not every sweet food.", ["kakana"])
    ], { label: "See musu dovu in a Fiji cane-growing report", href: "https://www.corrections.gov.fj/operation-musu-dovu-starts/" }),
    dewaleka: play("Look at the ending", "Dewaleka is the short dewa family: -a or -i in the recorded forms. A whole predicate decides which ending is actually used.", "dewaleka", [
      card("In mokuta and mokuti, which part is the short ending?", ["-a or -i", "moku"], "-a or -i", "Moku is the base. The recorded short forms end with -a and -i; the preceding t belongs to the connecting material.", ["moku", "koso dewa"]),
      card("Would mokulaka be another example of dewaleka just because it begins with moku?", ["No", "Yes"], "No", "Mokulaka carries the longer -aka family. Compare dewabalavu and check what the full phrase means before choosing a form.", ["dewabalavu", "moku"])
    ]),
    dewabalavu: play("A longer ending can change the relationship", "Dewabalavu covers the longer -aka and -aki forms. The examples mokulaka and mokulaki should be read as complete forms.", "dewabalavu", [
      card("Which recorded form carries the longer dewa ending: mokulaki or mokuti?", ["mokulaki", "mokuti"], "mokulaki", "Mokulaki ends in -aki, from the longer family; mokuti belongs to the short -i family.", ["dewaleka", "moku"]),
      card("Can you replace -aka with -aki in any predicate and assume the same participant relationship?", ["No", "Yes"], "No", "The longer forms are not a free spelling choice. Their meaning and affected participant need the attested base and phrase.", ["dewa", "matavu"])
    ]),
    "koso dewa": play("Find the connecting consonant", "Koso dewa is the consonant between a base and its dewa ending. It varies by word; a list of consonants is not a rule for inventing forms.", "koso dewa", [
      card("In the recorded pair moku → mokuta, what stands between moku and the final -a?", ["t", "moku"], "t", "The t is the connecting consonant. The base is moku and -a is the short ending in this analysis.", ["moku", "dewaleka"]),
      card("If another base uses a different connecting consonant, may we write a new form by copying t from mokuta?", ["No", "Yes"], "No", "The consonant depends on the actual word and construction; find a recorded whole form before teaching it.", ["dewa", "vu"])
    ]),
    druadina: play("How much is repeated?", "Druadina is another name for druabalavu, where a longer stretch is repeated. The effect still depends on the particular word.", "druadina", [
      card("In the recorded boroboro example, is a longer stretch repeated than in a drualeka pattern?", ["Yes", "No"], "Yes", "The classification is about the span repeated, not a promise that every repeated word means 'many'.", ["drualeka", "druabalavu"]),
      card("Can a word's repeated shape alone prove a productive drua analysis?", ["No", "Yes"], "No", "Yavu drua names a base that already looks repeated. Check the lexical base before explaining a new formation.", ["yavu drua", "drua"])
    ]),
    "yavu drua": play("A repeated look can mislead", "Yavu drua is a whole base with a repeated-looking shape. Totoka is the recorded illustration, not an invitation to invent a shorter base.", "yavu drua", [
      card("Does totoka's visible pattern alone prove that a productive drua rule made it?", ["No", "Yes"], "No", "The source treats totoka as a lexical base. Its spelling is not enough to reconstruct a shorter word.", ["totoka", "drua"]),
      card("What would make a stronger word-building claim: a guessed split, or a checked base plus related attested forms?", ["A checked base and forms", "A guessed split"], "A checked base and forms", "Druadina describes a repeat process; yavu drua reminds us that a similar-looking base may already be a word in its own right.", ["druadina", "drua"])
    ]),
    draki: play("What is the weather doing?", "Draki names the weather or outdoor conditions. A fishing question asks whether the draki is suitable; a forecast can describe draki suasua, wet weather.", "draki", [
      card("In O na laki siwa ke vinaka na draki? (‘Will you go fishing if the weather is good?’), what does draki refer to?", ["The weather", "The fishing boat"], "The weather", "The recorded question makes the trip conditional on good weather. It does not name a boat.", ["vinaka"]),
      card("A Fiji forecast mentions draki suasua. Is that the same as saying cagi alone?", ["No", "Yes"], "No", "Draki concerns the weather conditions as a whole; cagi specifically names wind, one possible part of the weather.", ["cagi", "uca"])
    ], { label: "Read draki suasua in Fiji's climate advice", href: "https://www.met.gov.fj/media/climate_product_files/FSCRO_March_2026__final.pdf" }),
    bulumakau: play("Cattle in life and in food", "Bulumakau names cattle. Food context can select beef, while a list of living farm animals selects the animal sense.", "bulumakau", [
      card("In a public list of bulumakau, vuaka, ose and farm goods being sold, is bulumakau the living cattle or a prepared beef dish?", ["Living cattle", "A prepared dish"], "Living cattle", "The listed animals are being sold for a journey; bulumakau identifies the cattle among them.", ["vuaka", "manumanu"]),
      card("In a food discussion, can bulumakau refer to beef without changing its spelling?", ["Yes", "No"], "Yes", "The recorded animal and meat readings share a form. The surrounding phrase tells you which is meant, just as vuaka can name pig or pork.", ["vuaka", "kakana"])
    ], { label: "Read bulumakau beside vuaka in a Fijian account", href: "https://www.churchofjesuschrist.org/bc/content/shared/content/fijian/pdf/language-materials/31113_fij.pdf?lang=fij" }),
    akaude: play("The account and the money in it", "Akaude can name a bank account. A Fiji form writes akaude ni baqe, while ilavo is the money that may be kept in it.", "akaude", [
      card("In akaude ni baqe, what does baqe tell you about the akaude?", ["It is a bank account", "It is the cash amount"], "It is a bank account", "Baqe identifies the bank relationship. Akaude names the account; the phrase does not give a balance.", ["baqe", "ni"]),
      card("If money is paid into an akaude, does akaude itself tell you how much ilavo arrived?", ["No", "Yes"], "No", "Ilavo is money, and a figure would give its amount. Akaude is the account that can receive or hold it.", ["ilavo"])
    ], { label: "See akaude ni baqe in a Fiji public notice", href: "https://tltb.com.fj/wp-content/uploads/2024/09/Sausauvou-Vol-2-2024-Newsletter-FINAL.pdf" }),
    "taukeni nauni": play("Which relationship does the marker show?", "A noun-based taukeni phrase links one base to another. Nei, kei, mei and ni do different work in the recorded examples; the base and context matter.", "taukeni nauni", [
      card("In na vale nei Luke and na sere kei Lia, which marker is used with Luke's house?", ["nei", "kei"], "nei", "Nei marks the recorded house relationship; kei in the song example points toward Lia as its subject or addressee.", ["nei", "kei"]),
      card("The recorded na ulu ni vuaka links a body part to an animal. Would replacing ni with nei Luke keep that same related base?", ["No", "Yes"], "No", "Ni vuaka relates the head to a pig. Nei Luke would relate a phrase to the named person Luke; a new phrase needs its own meaning and context.", ["ni", "vuaka"])
    ]),
    "nauni taukeni kuri": play("Direct possession belongs to particular bases", "Some kin and body-related bases accept possessive material directly; others use a preposed owner form. Check the whole word.", "nauni taukeni kuri", [
      card("In na dakuikeirau, does -ikeirau attach within the nominal word or appear before it as neirau?", ["It attaches within the word", "It appears before as neirau"], "It attaches within the word", "The recorded dakuikeirau is a directly suffixed form. Na neirau dra is the contrasting preposed construction.", ["keirau", "taukeni nauni"]),
      card("The record accepts noqu qāvokavoka but rejects *qāvokavokaqu. Can every related body or kin base take a direct -qu?", ["No", "Yes"], "No", "Some bases use a preposed form such as noqu. The word class has to be checked base by base.", ["noqu", "taukeni kuri"])
    ], { label: "Explore a linguistic account of Fijian possession", href: "https://openresearch-repository.anu.edu.au/bitstreams/d0142aff-f4bb-4c2c-b7ef-f2e5a70134bc/download" }),
    balavu: play("Length can belong to time", "Balavu can describe physical length or height, and a Fiji public text also uses balavu ni gauna for a length of time.", "balavu", [
      card("In balavu ni gauna, is the length measured along a road or across time?", ["Across time", "Along a road"], "Across time", "Gauna means time. The public text discusses how long an order remains in force, not the length of an object.", ["gauna"]),
      card("If a person is balavu, does that by itself mean the person is broad or numerous?", ["No", "Yes"], "No", "Balavu can describe height; levu concerns size, amount, or largeness. A full phrase resolves the intended reading.", ["levu", "matanauni"])
    ], { label: "Read balavu ni gauna in a Fiji legal summary", href: "https://flrc.gov.fj/wp-content/uploads/2025/02/FLRC_DV-DP-Summary-Fijian-Translation.Nov2004.pdf" }),
    baravi: play("Where land meets the sea", "Baravi is coastal land or seashore. A Fiji building guide sets it beside bati ni uciwai, the edge of a river, as two places needing care.", "baravi", [
      card("A building guide asks whether a house is e baravi. Is it asking about a coastal site or the middle of a river?", ["A coastal site", "The middle of a river"], "A coastal site", "Baravi points to land along the shore; the same guide separately mentions a river's edge.", ["vale", "uciwai"]),
      card("Would bati ni uciwai and baravi name exactly the same kind of edge?", ["No", "Yes"], "No", "The first is the edge of a river; baravi is the seashore or coastal land. Both can matter for choosing a safe building site.", ["bati", "uciwai"])
    ], { label: "See the coastal and river-edge questions in Fiji's building guide", href: "https://www.mcttt.gov.fj/wp-content/uploads/2022/08/Guidelines-for-Improving-Building-Safety-iTaukei.pdf" }),
    gade: play("Going for a visit", "Gade suggests an outing for pleasure or a visit. Lako says someone goes without necessarily telling us why.", "gade", [
      card("A village report says visitors gade yani to see a local cave. Are they going for a visit or being described as commuters?", ["Going for a visit", "Commuting"], "Going for a visit", "The context is visitors entering the village to see a place. Gade carries the outing sense in that passage.", ["lako", "vanua"]),
      card("If a sentence says only that someone lako, can you infer the trip is a leisure gade?", ["No", "Yes"], "No", "Lako is a general going word. Gade adds the recreational or visiting purpose when context supports it.", ["lako"])
    ], { label: "Read gade in a Fiji village-visit report", href: "https://tab.gov.fj/2025/12/04/lewe-ni-koro-o-wailotua-vakarautaka-na-veiqaravi-vei-vulagi/" }),
    basi: play("A ride and its fare", "Basi is a bus. Fiji's public transport texts use vodo basi for riding one and discuss assistance with the fare.", "basi", [
      card("In vodo basi, which word names the vehicle rather than the action of boarding?", ["basi", "vodo"], "basi", "Basi is the bus. Vodo supplies the riding or boarding action in this recorded expression.", ["lako"]),
      card("A budget mentions ivodovodo ni Basi assistance. Is the help about passenger fares or about buying a whole bus?", ["Passenger fares", "Buying a bus"], "Passenger fares", "The budget explains a subsidy on people's bus travel costs. The bus and the fare are related, but they are not the same thing.", ["ilavo"])
    ], { label: "See bus-fare assistance in Fiji's budget guide", href: "https://www.finance.gov.fj/wp-content/uploads/2025/08/CitizensGuide-to-FY2025%20-2026-National-BudgetiTaukei.pdf" }),
    "uto-": play("Inside the word, around the word", "Uto- names the core of a matavosa: its yavu with any attached ikuri. A separate duru can sit around that core in the phrase.", "uto-", [
      card("In an analysis written yavu + ikuri, do the attached ikuri belong inside the uto- or in a separate surrounding duru?", ["Inside the uto-", "In a surrounding duru"], "Inside the uto-", "The core includes its base and attached word-building material. Duru is a distinct phrase element.", ["yavu", "ikuri", "duru"]),
      card("If an analysis identifies a mata before a matanauni, does that alone tell us the lexical core of the predicate?", ["No", "Yes"], "No", "Mata marks a phrase boundary or relation; uto- concerns the central word form inside a matavosa. They answer different questions.", ["mata", "matavosa", "matanauni"])
    ]),
    "lau-": play("Look for the affected participant", "Lau- can bring the affected person or thing forward while the actor is left unstated. Laukana is a recorded example with an eaten or edible reading.", "lau-", [
      card("In laukana, does the form itself name who did the eating?", ["No", "Yes"], "No", "The affected food is in focus; the eater is not named by the form. Context may add that information.", ["kakana", "dewa"]),
      card("If two people act on each other, is that the same relationship as lau- leaving an actor unstated?", ["No", "Yes"], "No", "Reciprocal vei- can express an exchanged action. Lau- in the cited construction focuses the affected participant instead.", ["vei-", "vuveisoli"])
    ], { label: "Read an older recorded laukana analysis", href: "https://upload.wikimedia.org/wikipedia/commons/8/80/A_Fijian_and_English_and_an_English_and_Fijian_dictionary%2C_with_examples_of_common_and_peculiar_modes_of_expression_and_uses_of_words%2C_also%2C_containing_brief_hints_on_native_customs_%28IA_fijianenglishand00hazl%29.pdf" }),
    gauna: play("A day is one measure of time", "Gauna can mean a time, period or occasion. A phrase such as balavu ni gauna asks about duration; siga names a day.", "gauna", [
      card("A form asks Vakaevei na balavu ni gauna e taura? (‘How long does it take?’). Is it asking for a duration or a place?", ["A duration", "A place"], "A duration", "Balavu ni gauna asks about the length of time an action takes.", ["balavu", "siga"]),
      card("If a notice says an answer takes five siga, which word supplies the day as a unit rather than time in general?", ["siga", "gauna"], "siga", "Gauna is the broader time word; siga counts days in the notice.", ["siga"])
    ], { label: "Read a Fiji form about processing time", href: "https://www.justice.gov.fj/wp-content/uploads/2024/08/Information-on-Change-of-Name-itaukei-Language.pdf" }),
    siga: play("Day, daylight and night", "Siga can identify a day or the light of day; bogi points to night. Context decides which siga sense is active.", "siga", [
      card("A Fiji form says the process takes five siga. Is it counting days or five flashes of sunlight?", ["Days", "Flashes of sunlight"], "Days", "Here siga is the day as a unit of time.", ["gauna", "bogi"]),
      card("If a story contrasts light during siga with darkness at bogi, which side is night?", ["bogi", "siga"], "bogi", "Siga can point to daylight in this contrast, while bogi names night.", ["bogi", "buto"])
    ], { label: "See siga counted in a Fiji public form", href: "https://www.justice.gov.fj/wp-content/uploads/2024/08/Information-on-Change-of-Name-itaukei-Language.pdf" }),
    kakana: play("Food in an ordinary meal or a feast", "Kakana is food. Magiti brings food into a feast or ceremonial presentation; mamau is the feeling of having eaten enough.", "kakana", [
      card("If a plate holds kakana, is mamau the food on the plate or the feeling after enough of it?", ["The feeling after eating", "The food on the plate"], "The feeling after eating", "Kakana names the food; mamau describes the satisfied person.", ["mamau"]),
      card("Does calling food magiti add a feast or presentation setting beyond the broad word kakana?", ["Yes", "No"], "Yes", "Magiti is the more situated food word. Kakana alone does not announce a feast.", ["magiti"])
    ]),
    mamau: play("Enough food, a particular feeling", "Mamau is being full and satisfied after eating. It is a state of the eater, not the name of the meal.", "mamau", [
      card("After a meal, which word names the satisfied state rather than the meal itself?", ["mamau", "kakana"], "mamau", "Kakana is food; mamau is how someone feels after enough food.", ["kakana"]),
      card("Someone can be marau about a visit without having eaten. Does that automatically make them mamau?", ["No", "Yes"], "No", "Marau is happiness or delight; mamau is fullness from food. The feelings can coincide but do not mean the same thing.", ["marau"])
    ]),
    makete: play("Going to the market", "Makete is a market. Ki na makete means ‘to the market’; sitoa is a shop.", "makete", [
      card("In Ki na makete (‘to the market’), is makete the destination or the item bought?", ["The destination", "The item bought"], "The destination", "Ki na introduces the destination; makete names the marketplace.", ["sitoa"]),
      card("Would sitoa give exactly the same setting as makete in every sentence?", ["No", "Yes"], "No", "Sitoa names a shop; makete names a market. Both involve trade, but the place differs.", ["sitoa"])
    ], { label: "See the market phrase in a Fijian lesson", href: "https://files.eric.ed.gov/fulltext/ED131693.pdf" }),
    sitoa: play("A shop is a place, not its stock", "Sitoa is a shop or store. Makete names a market, another kind of trading place.", "sitoa", [
      card("If someone names the sitoa, have they named the building or place, or every item on its shelves?", ["The shop", "Every item"], "The shop", "The word names the shop. The goods need their own words.", ["kakana", "makete"]),
      card("Does the spelling sitoa copy every letter of English store?", ["No", "Yes"], "No", "The borrowed shop word has been adapted to Fijian spelling and ends in a vowel.", ["vosa", "makete"])
    ]),
    raraba: play("Wide is a direction of measurement", "Raraba concerns breadth. Qiqo points toward narrowness; balavu concerns length or height.", "raraba", [
      card("A path has room for several people side by side. Which description addresses that width: raraba or balavu?", ["raraba", "balavu"], "raraba", "Raraba looks across the path. Balavu would say how long it is.", ["balavu"]),
      card("If the same path becomes too narrow for two people abreast, which word gives the opposite direction?", ["qiqo", "raraba"], "qiqo", "Qiqo is narrow; raraba is broad or wide.", ["qiqo"])
    ]),
    qiqo: play("A narrow route", "Qiqo describes narrowness, especially where a path or road has little room across. Its opposite is raraba.", "qiqo", [
      card("Two people cannot walk side by side on a qiqo path. Is the problem its width or its length?", ["Its width", "Its length"], "Its width", "Qiqo concerns little room across. Balavu would concern length.", ["raraba", "balavu"]),
      card("If a route is qiqo but also balavu, must it be short because it is narrow?", ["No", "Yes"], "No", "Width and length are separate. A narrow route can still run a long way.", ["balavu", "lekaleka"])
    ]),
    marau: play("Happiness is not fullness", "Marau describes happiness or delight. Mamau concerns being full after eating; rarawa points toward sadness.", "marau", [
      card("A visitor is glad to see a friend but has eaten nothing. Which feeling can still fit: marau or mamau?", ["marau", "mamau"], "marau", "Marau is the happy feeling; mamau requires the food-related sense of satisfaction.", ["mamau"]),
      card("If the story turns from joy to sorrow, which word marks the change away from marau?", ["rarawa", "totoka"], "rarawa", "Rarawa names sorrow. Totoka praises beauty, which is a different kind of judgment.", ["rarawa", "totoka"])
    ]),
    totoka: play("Beauty, goodness and a doubled-looking base", "Totoka praises what is pleasing or beautiful. Vinaka is a broader word for good; totoka is also treated as a whole yavu drua base.", "totoka", [
      card("If you praise a view because it looks beautiful, which word is the more specific choice?", ["totoka", "vinaka"], "totoka", "Vinaka can mean good in many ways; totoka focuses on beauty or pleasing appearance.", ["vinaka"]),
      card("Does totoka's doubled-looking shape prove that you may remove a piece to make its true base?", ["No", "Yes"], "No", "This word is recorded as a yavu drua, a lexical base already shaped that way. A visual pattern is not enough to invent a shorter form.", ["yavu drua", "drua"])
    ]),
    mate: play("The phrase tells which mate", "Mate can concern illness or death. A full phrase is needed before deciding which reading a speaker intends.", "mate", [
      card("In mate rerevaki (‘a feared disease’), is mate about an illness or the time of day?", ["An illness", "The time of day"], "An illness", "Rerevaki describes the disease as feared. The phrase is used in Fiji public health writing.", ["rerevaki"]),
      card("If a brief account says only mate, can we safely decide whether it means an illness or a death?", ["No", "Yes"], "No", "The same spelling has both readings. Ask for the whole phrase before treating one English gloss as fixed.", ["vuniwai"])
    ], { label: "Read mate rerevaki in a Fiji health guide", href: "https://www.health.gov.fj/wp-content/uploads/2025/08/2.-POWER-TO-LIFE-A-handbook-for-people-newly-diagnosed-with-HIV-in-Fiji-A5-020824-Itaukei-HRv1-1.pdf" }),
    qase: play("Age, respect and a whole phrase", "Qase can identify an older person. Turaga may be a chief or a respectful address; qase ni vuli names a teacher.", "qase", [
      card("If someone is called qase, does that word alone establish that they hold a chiefly title?", ["No", "Yes"], "No", "Qase points to age or seniority. A chiefly title must be established separately; turaga also has respectful uses.", ["turaga"]),
      card("In qase ni vuli, is the whole phrase simply any older person or a teaching role?", ["A teaching role", "Any older person"], "A teaching role", "The whole expression names a schoolteacher; its meaning cannot be read by stopping at qase.", ["qase ni vuli", "ni"])
    ]),
    lekaleka: play("Short in space or time", "Lekaleka can make a route short or a visit brief. Balavu points the other way.", "lekaleka", [
      card("If a trip covers little distance, which word fits the route: lekaleka or balavu?", ["lekaleka", "balavu"], "lekaleka", "Lekaleka describes its short length; balavu would describe a long one.", ["balavu", "lako"]),
      card("A visit is lekaleka. Is that about how long the visit lasts or how small the visitor is?", ["Its duration", "The visitor's size"], "Its duration", "The word can extend from length to a brief period. Gauna is the broader word for time.", ["gauna"])
    ]),
    buto: play("Darkness is not a clock", "Buto can name or describe darkness. Bogi is night, a time during which it is often dark.", "buto", [
      card("A room has no light at midday. Can it be buto even though it is not bogi?", ["Yes", "No"], "Yes", "Buto concerns darkness, not the hour. A place can be dark during the day.", ["bogi", "siga"]),
      card("In a story that begins at bogi, does bogi itself name the quality of darkness or the night-time setting?", ["The night-time setting", "The quality of darkness"], "The night-time setting", "Bogi identifies night; buto describes darkness. The two often coincide but are distinct words.", ["bogi"])
    ]),
    matanitu: play("A political level in a wider place", "Matanitu names a state or government. Vanua has a wider range of meanings, including land and the community connected with it.", "matanitu", [
      card("In a public document about a state decision, which word names the governing authority: matanitu or vanua?", ["matanitu", "vanua"], "matanitu", "Matanitu points to state authority; vanua can include land, place and its connected community.", ["vanua"]),
      card("In the community sequence matanitu, yasana, tikina and koro, which level is above yasana?", ["matanitu", "koro"], "matanitu", "Matanitu is the wider political level in that sequence. The levels help locate a place but do not replace its local relationships.", ["Yasana"])
    ]),
    vanua: play("More than a patch of soil", "Vanua may name land, a place, territory or people connected with it. The surrounding phrase decides how much is included.", "vanua", [
      card("If a speaker means the people and place connected through a shared territory, is nuku broad enough to carry all of that?", ["No", "Yes"], "No", "Nuku is sand. Vanua can have a wider place and community sense.", ["nuku", "tamata"]),
      card("Would matanitu always replace vanua in a phrase about ancestral land and community?", ["No", "Yes"], "No", "Matanitu names political authority; vanua can carry land and community relationships beyond that institution.", ["matanitu", "yavusa"])
    ]),
    toba: play("A bay along the coast", "Toba is a bay or sheltered inlet. Baravi is coastal land; waitui is sea water more broadly.", "toba", [
      card("A place is named na toba o Laucala. Are you being directed to a bay or to an inland mountain?", ["A bay", "An inland mountain"], "A bay", "Toba names a coastal inlet in this recorded place expression.", ["baravi"]),
      card("If a map shows a toba inside the shoreline, does waitui name only that sheltered inlet?", ["No", "Yes"], "No", "Waitui can name sea water or the sea more broadly; toba narrows the place to a bay.", ["waitui", "baravi"])
    ]),
    uciwai: play("The river and its edge", "Uciwai is a river or stream. Bati ni uciwai is its edge; waitui refers to sea water.", "uciwai", [
      card("In bati ni uciwai, which part names the river rather than its edge?", ["uciwai", "bati"], "uciwai", "Bati names the edge in this phrase; uciwai names the watercourse.", ["bati", "baravi"]),
      card("If a boat leaves the river for open salt water, which word is the sea-water side of the contrast?", ["waitui", "uciwai"], "waitui", "Uciwai identifies the river or stream; waitui identifies sea water or the sea.", ["waitui"])
    ], { label: "See bati ni uciwai in Fiji's building guide", href: "https://www.mcttt.gov.fj/wp-content/uploads/2022/08/Guidelines-for-Improving-Building-Safety-iTaukei.pdf" }),
    baqe: play("A bank, its accounts and its name", "Baqe is a bank. Akaude ni baqe names an account at one; Fiji's Reserve Bank has a longer institutional name.", "baqe", [
      card("In akaude ni baqe, which word names the bank rather than the customer's account?", ["baqe", "akaude"], "baqe", "Baqe names the institution; akaude is the account held with it.", ["akaude", "ni"]),
      card("Would Baqe ni Lavo Maroroi ni Matanitu ko Viti mean every ordinary branch bank?", ["No", "Yes"], "No", "That longer expression names Fiji's Reserve Bank. Baqe by itself is the broader word for a bank.", ["matanitu", "ilavo"])
    ]),
    bia: play("A drink and a purpose for possession", "Bia names beer. In Oqo na mequ bia, mequ identifies the drink as the speaker's to consume.", "bia", [
      card("In Oqo na mequ bia (‘This is my beer to drink’), does mequ tell us the beer is for the speaker to drink or to wear?", ["To drink", "To wear"], "To drink", "The attested mequ construction marks a consumable for the speaker. English 'my' alone hides that relationship.", ["taukeni gunu", "noqu"]),
      card("Would replacing bia with yaqona keep the same drink?", ["No", "Yes"], "No", "Bia is beer; yaqona is kava, a different beverage with different social settings.", ["yaqona"])
    ], { label: "See the bia example in a Fijian lesson", href: "https://files.eric.ed.gov/fulltext/ED131693.pdf" }),
    isele: play("A cutting tool", "Isele is a knife. The particular knife may be identified by its work, such as gardening; moto is a spear.", "isele", [
      card("Someone needs a blade for a gardening task. Which broad tool name can fit: isele or moto?", ["isele", "moto"], "isele", "Isele is a knife and can be a gardening knife in context. Moto names a spear.", ["moto"]),
      card("If a description calls an isele gata, which part names the tool and which gives its sharpness?", ["Isele names the tool", "Gata names the tool"], "Isele names the tool", "Gata can describe a sharp point or blade; isele names the knife.", ["gata"])
    ]),
    moto: play("The spear and its edge", "Moto is a spear. Isele is a knife; gata can describe a sharp point on either suitable tool.", "moto", [
      card("An older account names a moto among weapons. Is it naming a spear or a basket?", ["A spear", "A basket"], "A spear", "Moto names the spear; kato names a basket or box.", ["kato", "isele"]),
      card("If a moto is described as gata, does gata replace the name of the spear?", ["No", "Yes"], "No", "Gata adds the sharp quality. Moto still names the object.", ["gata"])
    ]),
    kato: play("A container for things, not a cup for a drink", "Kato can be a basket or box. Bilo is a cup or small drinking vessel.", "kato", [
      card("A person carries several pieces of produce in one container. Which word can name the basket: kato or bilo?", ["kato", "bilo"], "kato", "Kato can carry or hold goods; bilo is a drinking cup.", ["bilo", "kakana"]),
      card("Does kato by itself say whether this container is woven as a basket or made as a box?", ["No", "Yes"], "No", "The checked meaning covers both; the surrounding description or an image would identify the material and shape.")
    ]),
    benisini: play("Fuel with a borrowed name", "Benisini means petrol or gasoline used as motor fuel. Its spelling resembles English benzine, but the English solvent name is not a safe everyday translation.", "benisini", [
      card("A driver puts benisini in a motoka. Is the word naming the fuel or the car?", ["The fuel", "The car"], "The fuel", "Benisini is petrol; motoka is the vehicle using it.", ["motoka"]),
      card("Would an English label 'benzine solvent' safely explain every Fijian use of benisini?", ["No", "Yes"], "No", "Here benisini is the motor fuel. Similar-looking English technical terms can mislead a reader.", ["vosa"])
    ]),
    gata: play("Sharp describes the edge", "Gata can describe a sharp point or blade. It does not itself name the knife or spear that has the edge.", "gata", [
      card("If an isele is gata, which word gives the sharp quality?", ["gata", "isele"], "gata", "Isele identifies the knife; gata tells you its edge is sharp.", ["isele"]),
      card("Can a moto be gata without becoming an isele?", ["Yes", "No"], "Yes", "Sharpness can apply to a spear's point too. Moto and isele remain different tools.", ["moto", "isele"])
    ]),
    koli: play("A dog and its owner", "Koli is a dog. Manumanu is a wider animal word; noqu can tell whose dog is meant.", "koli", [
      card("If a story names a koli, have we learned that the animal is a dog or only that it is some manumanu?", ["A dog", "Only some animal"], "A dog", "Koli is the specific dog word; manumanu covers a wider range of animals.", ["manumanu"]),
      card("In the attested phrase na noqu koli, which word tells you the dog belongs to the speaker?", ["noqu", "koli"], "noqu", "Koli names the dog. Noqu expresses the owner's relationship to it.", ["noqu"])
    ], { label: "Read na noqu koli in a Fijian text", href: "https://www.churchofjesuschrist.org/bc/content/shared/content/fijian/pdf/language-materials/14445_fij.pdf" }),
    macala: play("Clear does not mean solved", "Macala can say that something is clear or understood. A leqa can be clearly explained while remaining a problem.", "macala", [
      card("If the cause of a leqa is now macala, has the problem necessarily been fixed?", ["No", "Yes"], "No", "Macala concerns clarity or understanding. Leqa names the difficulty, which may still need action.", ["leqa"]),
      card("Two answers are duidui but both are easy to understand. Can both still be macala?", ["Yes", "No"], "Yes", "Duidui marks their difference; macala concerns how clear each answer is.", ["duidui"])
    ]),
    motoka: play("Vehicle, person and fuel", "Motoka is a car. Draiva names the person driving; benisini names its fuel.", "motoka", [
      card("In advice that mentions a motoka and a draiva, which word names the vehicle?", ["motoka", "draiva"], "motoka", "The motoka is the car; the draiva is a person who drives it.", ["draiva"]),
      card("If a car needs benisini, is the missing item another vehicle or its fuel?", ["Its fuel", "Another vehicle"], "Its fuel", "Benisini is petrol. It belongs in the vehicle but does not name the vehicle.", ["benisini"])
    ], { label: "Read motoka and draiva in Fiji health advice", href: "https://www.health.gov.fj/wp-content/uploads/2020/04/Advisory26320_iTaukei_-COVID-19.pdf" }),
    maqo: play("A mango in the seasonal calendar", "Maqo names a mango. Fiji's traditional calendar places the mango season alongside the maturing of other fruit, including vudi.", "maqo", [
      card("The calendar says via oti na maqo while vudi is maturing. Which named fruit is nearing the end of its season?", ["maqo", "vudi"], "maqo", "The recorded phrase says the mango season is nearly over; it separately describes vudi maturing.", ["vudi", "matua"]),
      card("Could maqo and vudi be translated as the same fruit just because both appear in that calendar entry?", ["No", "Yes"], "No", "Maqo is mango and vudi is plantain. A shared season does not make the plants identical.", ["vudi"])
    ], { label: "Explore Fiji's traditional seasonal calendar", href: "https://www.ndmo.gov.fj/wp-content/uploads/2024/04/CBDRM-Training-Manual.pdf" }),
    duidui: play("Different without changing", "Duidui says things are distinct from one another. Veisau concerns change, which is another relationship.", "duidui", [
      card("Two already existing designs are duidui. Must either design have changed?", ["No", "Yes"], "No", "Duidui compares difference between them; it does not by itself report a change over time.", ["veisau"]),
      card("If one design later becomes different from its earlier version, which word draws attention to the change?", ["veisau", "duidui"], "veisau", "Veisau points to change. Duidui can describe the difference between the two versions.", ["veisau"])
    ]),
    ibe: play("A mat with local stories", "Ibe names a mat. Some forms have their own local histories, such as the ibe vaNamuka associated with Namuka in Macuata.", "ibe", [
      card("The name ibe vaNamuka identifies a tradition tied to Namuka. Does ibe alone name every local style?", ["No", "Yes"], "No", "Ibe is the broad mat word; the longer name identifies one local weaving tradition.", ["vanua"]),
      card("A public account lists yaqona, ibe and tabua among customary items. Which one is the mat?", ["ibe", "tabua"], "ibe", "Ibe is the mat; tabua is a whale tooth. Their ceremonial contexts can overlap without the objects being alike.", ["tabua", "yaqona"])
    ], { label: "Read about the ibe vaNamuka tradition", href: "https://parliament.gov.fj/wp-content/uploads/2020/05/Appendices.pdf" }),
    isulu: play("Clothing and whose it is", "Isulu is clothing or a garment. Its name alone does not say who wears or owns it.", "isulu", [
      card("Would a woven ibe used on a floor normally be called isulu just because both involve fibres?", ["No", "Yes"], "No", "Isulu names clothing; ibe names a mat. Their uses matter more than the shared material.", ["ibe"]),
      card("If a sentence only gives isulu, can you tell whose garment it is?", ["No", "Yes"], "No", "An owner needs more context or possessive material. The clothing word alone leaves that relationship open.", ["taukeni"])
    ]),
    kuro: play("The vessel, not the meal", "Kuro is a cooking pot. Kato can hold or carry things; kakana is the food itself.", "kuro", [
      card("A family cooks a meal in a kuro. Does kuro name the pot or the cooked kakana?", ["The pot", "The food"], "The pot", "Kuro is the vessel used in cooking; kakana is the food.", ["kakana"]),
      card("Someone carries uncooked produce in a kato. Has the word kato named the same vessel as kuro?", ["No", "Yes"], "No", "Kato is a basket or box; kuro is a cooking pot. Both hold things but serve different tasks.", ["kato"])
    ]),
    leqa: play("Knowing the problem is one step", "Leqa is a problem or difficulty. Macala can describe an explanation that makes the problem clear.", "leqa", [
      card("If someone says the leqa is macala, do you know the problem has gone away?", ["No", "Yes"], "No", "A clear explanation may identify a problem without resolving it.", ["macala"]),
      card("Can a person feel madua because of a leqa while the two words still name different things?", ["Yes", "No"], "Yes", "Leqa is the difficulty; madua is embarrassment or shame a person may feel about it.", ["madua"])
    ]),
    levulevu: play("A body description, not every large thing", "Levulevu concerns a stout or fat build. Levu is the broader word for large; raraba concerns width.", "levulevu", [
      card("For a person's stout build, which word is the specific description: levulevu or raraba?", ["levulevu", "raraba"], "levulevu", "Levulevu describes bodily build; raraba describes breadth or width.", ["raraba"]),
      card("Would levulevu be the safe general translation for large eyes just because levu can mean large?", ["No", "Yes"], "No", "Levulevu has the body-build meaning. Levu can describe size more generally; the whole phrase decides the best form.", ["levu"])
    ]),
    madua: play("A feeling after an event", "Madua is feeling ashamed or embarrassed. The situation that causes the feeling needs its own description.", "madua", [
      card("A person is madua about a leqa. Which word names the feeling?", ["madua", "leqa"], "madua", "Madua is the feeling; leqa is the difficulty being discussed.", ["leqa"]),
      card("Could someone feel madua without the word itself telling us what happened?", ["Yes", "No"], "Yes", "The adjective reports embarrassment or shame, not its cause. Ask for the surrounding story.", ["macala"])
    ]),
    mamaqi: play("Reluctance to share", "Mamaqi describes someone unwilling to give or share freely. It does not measure how much money that person has.", "mamaqi", [
      card("A person has plenty of ilavo but refuses to share any. Which word speaks to the unwillingness?", ["mamaqi", "ilavo"], "mamaqi", "Ilavo is money; mamaqi describes the person's reluctance to give.", ["ilavo"]),
      card("Can you infer someone's bank balance solely because they are called mamaqi?", ["No", "Yes"], "No", "The word judges a habit or attitude toward giving, not the amount in an akaude.", ["akaude"])
    ]),
    manumanu: play("The broad animal word", "Manumanu names an animal and can refer especially to a bird in some contexts. The rest of the phrase helps narrow it.", "manumanu", [
      card("If a speaker says only manumanu, have they identified a dog as precisely as koli would?", ["No", "Yes"], "No", "Koli specifies a dog. Manumanu leaves the kind of animal open.", ["koli"]),
      card("If a family records its neitou manumanu, does the word alone reveal which bird or animal is connected with them?", ["No", "Yes"], "No", "The family or village must supply the actual name. Manumanu only tells you the broad kind of living thing being asked about.", ["yavusa"])
    ]),
    matua: play("Fully developed depends on the fruit", "Matua describes something mature or fully developed. A Fiji seasonal account uses it for vudi; a nearly ripe fruit can be described differently.", "matua", [
      card("In the traditional calendar, matua na vudi concerns a plantain's stage. Is this about maturity or the colour of the sky?", ["Maturity", "The sky"], "Maturity", "The calendar records the vudi as mature at that time of year.", ["vudi"]),
      card("If a fruit is only carawabobota, nearly ripe, has it reached the fully mature or ready stage implied by matua in every context?", ["Not necessarily", "Certainly"], "Not necessarily", "Carawabobota marks a near-ripe stage; matua is broader and needs the crop and sentence for its exact reading.", ["carawabobota"])
    ], { label: "See matua na vudi in Fiji's seasonal calendar", href: "https://www.ndmo.gov.fj/wp-content/uploads/2024/04/CBDRM-Training-Manual.pdf" }),
    turaga: play("Respect is wider than a title", "Turaga can name a chief or address a man respectfully. A sentence or title must show which sense is intended.", "turaga", [
      card("If an account calls someone turaga, can you conclude from that word alone that he holds a chiefly title?", ["No", "Yes"], "No", "Turaga is also respectful address. The office, if any, needs separate evidence.", ["qase"]),
      card("Does cauravou describe the same thing as a chiefly title when it identifies a young man?", ["No", "Yes"], "No", "Cauravou concerns a young man's life stage or social description; turaga may be a respectful address or chiefly term.", ["cauravou"])
    ]),
    uca: play("Rain within the wider weather", "Uca is rain. Draki is the broader weather or climate, and a report may describe weather without saying it rained.", "uca", [
      card("If a forecast discusses draki, does it necessarily promise uca?", ["No", "Yes"], "No", "Draki covers weather more broadly; uca specifically names rain.", ["draki"]),
      card("A seasonal calendar says tau bi na uca. Which word identifies what is falling?", ["uca", "siga"], "uca", "The phrase describes heavy rain. Uca is the rain; siga is a day or daylight.", ["siga"])
    ], { label: "Read tau bi na uca in Fiji's seasonal calendar", href: "https://www.ndmo.gov.fj/wp-content/uploads/2024/04/CBDRM-Training-Manual.pdf" }),
    vudi: play("Plantain and the season", "Vudi is a plantain, often cooked as food. Fiji's traditional calendar records when it matures alongside other fruit.", "vudi", [
      card("The calendar says matua na vudi. Which word names the plantain: vudi or matua?", ["vudi", "matua"], "vudi", "Vudi names the crop; matua describes its mature stage.", ["matua"]),
      card("If a basket has vudi and maqo, are both names for the same fruit?", ["No", "Yes"], "No", "Vudi is plantain and maqo is mango. Their preparation and use differ.", ["maqo", "kato"])
    ], { label: "Explore Fiji's traditional seasonal calendar", href: "https://www.ndmo.gov.fj/wp-content/uploads/2024/04/CBDRM-Training-Manual.pdf" }),
    bisinisi: play("Trade as an activity", "Bisinisi is business or commercial activity. A sitoa may be one place where business happens, but the two words do different jobs.", "bisinisi", [
      card("A family runs a bisinisi from several places. Does bisinisi name the activity or one particular sitoa?", ["The activity", "One shop"], "The activity", "Bisinisi is the enterprise or trade; sitoa names a shop.", ["sitoa"]),
      card("If a business keeps an akaude at a baqe, which word names the business itself?", ["bisinisi", "baqe"], "bisinisi", "A baqe is a bank and an akaude is an account; neither is automatically the business.", ["baqe", "akaude"])
    ]),
    cauravou: play("A young man in a village account", "Cauravou describes a young man; in some contexts it also carries the sense that he is not yet married.", "cauravou", [
      card("An account mentions cauravou ni koro. Does cauravou identify young men or chiefly titles?", ["Young men", "Chiefly titles"], "Young men", "The phrase speaks about young men of a village, not the title of its chief.", ["turaga"]),
      card("Would qase be the more likely word for an elder in a contrast between generations?", ["Yes", "No"], "Yes", "Qase concerns an older person; cauravou points toward youth. Context and local usage still matter.", ["qase"])
    ], { label: "Read cauravou ni koro in Fiji Focus", href: "https://www.fiji.gov.fj/getattachment/2112ae88-585b-4e15-8136-8cbcbb1a3b1d/Fiji-Focus-Issue-18-Volume-10-September-11%2C-2019.aspx" }),
    draiva: play("The person, not the car", "Draiva is a driver. Motoka is the car; benisini is its fuel.", "draiva", [
      card("A health notice mentions pasidia and draiva. Is the draiva a person travelling in the vehicle or the vehicle itself?", ["A person", "The vehicle"], "A person", "Draiva names the driver; motoka names a car.", ["motoka"]),
      card("Does draiva end in the same consonant as English driver?", ["No", "Yes"], "No", "The borrowed form follows Fijian spelling and ends in a vowel, unlike the English word.", ["vosa"])
    ], { label: "Read draiva in Fiji health advice", href: "https://www.health.gov.fj/wp-content/uploads/2020/04/Advisory26320_iTaukei_-COVID-19.pdf" }),
    dravuisiga: play("The sun's effect on land", "Dravuisiga describes land parched or scorched by sun. Uca is rain, which would change the conditions rather than name the dryness.", "dravuisiga", [
      card("A field has become dravuisiga. Is the land wet from uca or parched by the sun?", ["Parched by sun", "Wet from rain"], "Parched by sun", "The word describes sun-scorched land; uca is rain.", ["uca", "siga"]),
      card("Does dravuisiga by itself tell us which crop was growing in the field?", ["No", "Yes"], "No", "It describes the land's condition. A separate crop name, such as tavioka, would identify what grew there.", ["tavioka"])
    ]),
    icurucuru: play("Paying to enter", "Icurucuru is an admission fee. Ilavo is money more generally; the entrance purpose makes this payment specific.", "icurucuru", [
      card("A notice asks for icurucuru before someone enters an event. Is it a fee for entry or the whole amount in their akaude?", ["A fee for entry", "Their bank balance"], "A fee for entry", "Icurucuru names the admission payment, not every sum of money someone owns.", ["akaude", "ilavo"]),
      card("If an entrance is free, is there necessarily an icurucuru to pay?", ["No", "Yes"], "No", "The word identifies a charge for admission; an entry without a charge has no fee of that kind.", ["ilavo"])
    ]),
    idabedabe: play("The place to sit", "Idabedabe names a seat or chair. An ibe can also be used under a seated person, but it is a mat, not the same named object.", "idabedabe", [
      card("Someone brings an idabedabe into a room. Have they brought a seat or a cooking kuro?", ["A seat", "A cooking pot"], "A seat", "Idabedabe names the seating object; kuro is a pot.", ["kuro"]),
      card("Can an ibe serve as a place to sit without becoming the same kind of object as an idabedabe?", ["Yes", "No"], "Yes", "Ibe is a mat; idabedabe is a seat or chair. Similar use does not erase the difference.", ["ibe"])
    ]),
    ikatalau: play("The first meal, whenever the clock says", "Ikatalau names breakfast. A Fiji account places an ikatalau at eight in the morning, but the word names the meal rather than one fixed hour.", "ikatalau", [
      card("A Fiji account says ikatalau ena walu na kaloko. Is ikatalau the breakfast or the number eight?", ["Breakfast", "Eight"], "Breakfast", "The phrase puts the meal at eight o'clock; ikatalau itself names breakfast.", ["kakana", "gauna"]),
      card("If a household eats breakfast at a different hour, must the meal stop being ikatalau?", ["No", "Yes"], "No", "The word names the morning meal, not a particular clock time.", ["siga"])
    ], { label: "Read the breakfast account in Fiji Focus", href: "https://www.fiji.gov.fj/getattachment/2112ae88-585b-4e15-8136-8cbcbb1a3b1d/Fiji-Focus-Issue-18-Volume-10-September-11%2C-2019.aspx" }),
    itau: play("A friend in a real phrase", "Itau names a friend. Fijian writing also uses itokani for a friend, but the surrounding words may give the relationship more detail.", "itau", [
      card("In the attested phrase noqu itau, which word names the friend and which marks the relationship to the speaker?", ["itau names the friend", "noqu names the friend"], "itau names the friend", "Itau is the friend word; noqu identifies the speaker's relationship to that friend.", ["noqu"]),
      card("A passage uses noqu itau and noqu itokani. Must those phrases name two different people?", ["No", "Yes"], "No", "The words can both refer to a friend. The whole passage decides whether it is the same person or two people.")
    ], { label: "Read noqu itau beside noqu itokani", href: "https://www.churchofjesuschrist.org/bc/content/shared/content/fijian/pdf/language-materials/SS_units_4-6_fij.pdf?lang=fij" }),
    kateni: play("Which kind of container?", "Kateni is a carton or cardboard box. Kato is broader for a basket or box, and tavaya names a bottle.", "kateni", [
      card("A parcel arrives in a cardboard carton. Which word picks out that packaging: kateni or tavaya?", ["kateni", "tavaya"], "kateni", "Kateni names a carton; tavaya is a bottle.", ["tavaya"]),
      card("Could a woven kato be useful without being a kateni?", ["Yes", "No"], "Yes", "Kato can be a basket or box. Kateni is specifically the carton or cardboard-box kind.", ["kato"])
    ]),
    keba: play("A camp is a setting, not a building type", "Keba is an organised camp, such as a military or scouting camp. An otela is a hotel, which offers another kind of stay.", "keba", [
      card("A scouting group stays together at a keba. Is the word naming the camp or an otela?", ["The camp", "A hotel"], "The camp", "Keba names the organised camp; otela names a hotel.", ["otela"]),
      card("Can the same word keba cover a military camp and a scouting camp without making them the same activity?", ["Yes", "No"], "Yes", "The headword identifies the camp setting. The people and purpose tell which kind of camp it is.", ["cauravou"])
    ]),
    kemesi: play("Medicine has a place and a person", "Kemesi is a pharmacy or chemist's shop. A vuniwai is a doctor; sitoa is the broader shop word.", "kemesi", [
      card("A person goes to a kemesi for medicine. Is kemesi the pharmacy or the vuniwai who treats them?", ["The pharmacy", "The doctor"], "The pharmacy", "Kemesi names the shop; vuniwai names a medical practitioner.", ["vuniwai"]),
      card("If an account says only sitoa, does that already tell us it is a kemesi?", ["No", "Yes"], "No", "Sitoa is a shop in general. Kemesi narrows it to a pharmacy.", ["sitoa"])
    ]),
    lase: play("Coral is not every grain of sand", "Lase can name coral or coral sand. Nuku is sand more generally, while cakau is a reef.", "lase", [
      card("Someone points to nuku on a beach. Can you conclude every grain is coral-based lase?", ["No", "Yes"], "No", "Nuku is sand; lase is the more specific coral or coral-sand reading.", ["nuku"]),
      card("A map marks a cakau offshore. Does that name the whole reef or a loose piece of lase?", ["The reef", "A loose piece"], "The reef", "Cakau identifies a reef structure; lase can identify coral material.", ["cakau"])
    ]),
    lesoni: play("A lesson can use a book", "Lesoni is a lesson or teaching unit. Ivola may hold its written material; qase ni vuli names a teacher.", "lesoni", [
      card("A qase ni vuli prepares a lesoni. Which expression names the teacher rather than the teaching unit?", ["qase ni vuli", "lesoni"], "qase ni vuli", "The teacher leads the learning; the lesoni is what is being taught.", ["qase ni vuli"]),
      card("If a lesoni appears in an ivola, must the whole book consist of only that one lesson?", ["No", "Yes"], "No", "Ivola is a book or written record. It may contain one lesson, many lessons, or other writing.", ["ivola"])
    ]),
    lovo: play("Cooking under the ground", "A lovo is a Fijian earth oven: hot stones heat food in a covered pit. A kuro is a cooking pot, a different vessel.", "lovo", [
      card("In a lovo, is the heat held in a covered pit with hot stones or inside a portable kuro?", ["A covered pit", "A portable pot"], "A covered pit", "The earth oven uses heated stones and covering to cook food; kuro is a pot.", ["kuro"]),
      card("A visitor enjoys the kakana from a lovo. Does lovo name the cooking method and oven or each food item by itself?", ["The cooking method and oven", "Each food item"], "The cooking method and oven", "The cooked foods still have their own names. Lovo tells how they were prepared.", ["kakana", "magiti"])
    ], { label: "See how a Fijian lovo is prepared", href: "https://www.fiji.travel/things-to-do/local-eats/all-about-lovo" }),
    lululu: play("A greeting by hand", "Lululu is shaking hands or a handshake. It is a physical greeting, not the relationship of friendship itself.", "lululu", [
      card("Can two people lululu when they first meet, before they are itau?", ["Yes", "No"], "Yes", "A handshake is an action. Itau names a friend, a relationship that is not established by the gesture alone.", ["itau"]),
      card("Fiji health guidance once advised people to avoid lululu. Was it asking them to stop shaking hands or to stop being friends?", ["Stop shaking hands", "Stop being friends"], "Stop shaking hands", "The advice addressed physical contact during a health emergency, not the existence of friendship.", ["itau"])
    ], { label: "Read lululu in Fiji health guidance", href: "https://www.health.gov.fj/wp-content/uploads/2020/04/17.03-iTaukei.pdf" }),
    maile: play("Distance without a clock", "Maile is a mile, a distance unit. Miniti measures time; raraba can describe how wide a route is.", "maile", [
      card("A road is two maile long. Does that tell you the distance or the number of miniti needed to travel it?", ["The distance", "The minutes"], "The distance", "Maile measures distance. Miniti measures elapsed time, which depends on the journey.", ["miniti"]),
      card("A path has a length in maile. Has that number also told you whether the path is raraba?", ["No", "Yes"], "No", "Length and width are separate measures. Raraba concerns breadth.", ["raraba"])
    ]),
    masese: play("What lights the fire?", "Masese is a match or matches for lighting a fire. Waqaca is the action of lighting it.", "masese", [
      card("Someone uses a masese to waqaca a fire. Which word names the match?", ["masese", "waqaca"], "masese", "Masese is the small lighting item; waqaca names the lighting action.", ["waqaca"]),
      card("Would calling a cooking kuro masese tell you what the pot is?", ["No", "Yes"], "No", "Kuro is the vessel for cooking; masese can help start the fire but does not name the pot.", ["kuro"])
    ]),
    matasawa: play("Where land meets a landing", "Matasawa is a beach or shore used as a landing place. Baravi names coast more broadly; waitui names sea water.", "matasawa", [
      card("A boat reaches a matasawa. Does the word direct you to a landing shore or to open waitui?", ["A landing shore", "Open sea water"], "A landing shore", "Matasawa identifies the shore or landing place; waitui is the sea-water side.", ["waitui"]),
      card("If a route follows baravi for miles, must every part of that coast be a matasawa?", ["No", "Yes"], "No", "Baravi is coastal land broadly; matasawa is a shore associated with landing.", ["baravi"])
    ]),
    nuku: play("Sand is a material, not a whole place", "Nuku is sand. Baravi is coastal land, and lase can refer specifically to coral sand.", "nuku", [
      card("A handful of nuku comes from a baravi. Which word names the material in the hand?", ["nuku", "baravi"], "nuku", "Nuku is sand; baravi is the coast where it may be found.", ["baravi"]),
      card("Can someone know a beach has nuku without knowing whether that sand is coral lase?", ["Yes", "No"], "Yes", "The broad sand word does not identify what the grains are made from.", ["lase"])
    ]),
    ivava: play("Footwear and an action built from it", "Ivava is footwear. Fiji health guidance uses vakaivava when telling people to wear shoes outdoors.", "ivava", [
      card("In the advice nomu vakaivava, is the action about wearing footwear or washing an isulu?", ["Wearing footwear", "Washing clothing"], "Wearing footwear", "The advice concerns shoes on the feet; isulu is the broader clothing word.", ["isulu"]),
      card("Does ivava name every kind of isulu, or the part worn on the feet?", ["Footwear", "Every garment"], "Footwear", "Ivava narrows the item to shoes or other footwear.", ["isulu"])
    ], { label: "Read Fiji health advice about wearing footwear", href: "https://www.fiji.gov.fj/itaukei-statement-by-permanent-secretary-for-health-medical-services-dr-james-fong-28-03-22/" }),
    masi: play("Cloth and mat are different crafts", "Masi is Fijian barkcloth. Ibe is a woven mat; their materials and uses can be discussed together without merging the words.", "masi", [
      card("A heritage report lists Masi Vulavula and Ibe Draukekua separately. Which broad word is barkcloth?", ["masi", "ibe"], "masi", "Masi is barkcloth; ibe is a mat. The longer names identify particular local traditions.", ["ibe"]),
      card("If a visitor sees a piece of masi displayed beside an ibe, can the visitor assume they were made by the same technique?", ["No", "Yes"], "No", "Barkcloth and woven mat involve different materials and making methods. Ask about the maker and place for the specific tradition.", ["ibe", "vanua"])
    ], { label: "Read a Fiji heritage report on masi and ibe", href: "https://www.education.gov.fj/wp-content/uploads/2022/06/MEHA-Annual-Report-2016-2017.pdf" }),
    miniti: play("Minutes measure how long", "Miniti is a minute, a time unit. Aua is an hour; maile measures distance instead.", "miniti", [
      card("A journey takes twenty miniti. Have you learned its time or its distance in maile?", ["Its time", "Its distance"], "Its time", "Miniti measures duration; maile measures distance along the route.", ["maile"]),
      card("How many miniti make one aua?", ["Sixty", "Twenty-four"], "Sixty", "One hour has sixty minutes. Aua is the hour word, while miniti is the smaller unit.", ["aua"])
    ]),
    moli: play("A citrus fruit in a seasonal account", "Moli often names an orange or another citrus fruit. It is distinct from a maqo, a mango.", "moli", [
      card("The traditional calendar says dreu na moli. Which fruit is ripening there: citrus or mango?", ["Citrus", "Mango"], "Citrus", "Moli identifies the citrus fruit; maqo would identify a mango.", ["maqo"]),
      card("Does moli on its own tell you the exact citrus variety in the speaker's hand?", ["No", "Yes"], "No", "The word has a range of citrus uses, with orange especially common. A more detailed context identifies a variety.", ["matua"])
    ], { label: "See moli in Fiji's seasonal calendar", href: "https://www.ndmo.gov.fj/wp-content/uploads/2024/04/CBDRM-Training-Manual.pdf" }),
    namu: play("A mosquito in the changing season", "Namu is a mosquito. Fiji's traditional calendar records a time when mosquitoes are fewer as bad weather eases.", "namu", [
      card("A household notices fewer namu. Has it counted mosquitoes or qasikalolo?", ["Mosquitoes", "Ants"], "Mosquitoes", "Namu are mosquitoes; qasikalolo are ants.", ["qasikalolo"]),
      card("The calendar says lailai tale ga na namu after draki ca eases. Does that report a seasonal observation or say mosquitoes can never appear then?", ["A seasonal observation", "Never appear"], "A seasonal observation", "The text records fewer mosquitoes in that period; it does not promise none in every place.", ["draki"])
    ], { label: "Read namu in Fiji's seasonal calendar", href: "https://www.ndmo.gov.fj/wp-content/uploads/2024/04/CBDRM-Training-Manual.pdf" }),
    ose: play("A horse is not the car that travels beside it", "Ose is a horse. It is a manumanu, while a motoka is a vehicle made by people.", "ose", [
      card("A traveller rides an ose. Has the word named an animal or a motoka?", ["An animal", "A car"], "An animal", "Ose names the horse; motoka names a car.", ["motoka"]),
      card("Would the broad word manumanu identify that animal as specifically as ose does?", ["No", "Yes"], "No", "Manumanu leaves the animal kind open. Ose narrows it to a horse.", ["manumanu"])
    ]),
    otela: play("A place for visitors to stay", "Otela is a hotel. A vulagi is a visitor or guest, who may stay in a hotel or somewhere else.", "otela", [
      card("A vulagi checks into an otela. Which word names the place to stay?", ["otela", "vulagi"], "otela", "Otela is the hotel; vulagi is the visitor.", ["vulagi"]),
      card("If a group stays at a keba, must the place also be an otela?", ["No", "Yes"], "No", "Keba is an organised camp, a different setting from a hotel.", ["keba"])
    ]),
    vulagi: play("The visitor and the welcome", "Vulagi is a visitor or guest. The place they stay or the way hosts receive them is a separate part of the story.", "vulagi", [
      card("If someone is a vulagi, does that word tell you they are staying at an otela?", ["No", "Yes"], "No", "Vulagi identifies the visitor, not their accommodation. A guest may stay with hosts or elsewhere.", ["otela"]),
      card("When a vulagi arrives in a village, which expression names a customary presentation that may introduce visitors?", ["i sevusevu", "icurucuru"], "i sevusevu", "I sevusevu is a customary presentation; icurucuru is an admission fee and should not be substituted for it.", ["i sevusevu", "icurucuru"])
    ]),
    "qase ni vuli": play("The whole phrase names the teacher", "Qase ni vuli names a schoolteacher. Qase alone can mean an older person; lesoni is what a teacher may prepare.", "qase ni vuli", [
      card("If someone is a qase ni vuli, does the whole phrase name any elder or a teacher?", ["A teacher", "Any elder"], "A teacher", "The complete expression is the teaching role; qase alone has a wider age-related sense.", ["qase"]),
      card("A qase ni vuli prepares a lesoni. Which expression identifies the teaching unit?", ["lesoni", "qase ni vuli"], "lesoni", "Lesoni is the lesson; qase ni vuli is the teacher.", ["lesoni"])
    ]),
    qasikalolo: play("The insect, not its mound", "Qasikalolo is an ant. Buri can name an anthill; namu is a mosquito.", "qasikalolo", [
      card("A qasikalolo comes out of a buri. Which word names the ant itself?", ["qasikalolo", "buri"], "qasikalolo", "Qasikalolo names the insect; buri is its mound or nest.", ["buri"]),
      card("If someone complains of namu, have they named the same insect as qasikalolo?", ["No", "Yes"], "No", "Namu is a mosquito; qasikalolo is an ant.", ["namu"])
    ]),
    rarawa: play("Sorrow among other feelings", "Rarawa is sorrow or sadness. Marau is joy; rere is fear, which is another feeling again.", "rarawa", [
      card("A reunion turns from rarawa to marau. What has changed?", ["Sadness to joy", "Fear to a storm"], "Sadness to joy", "Rarawa names sorrow; marau names happiness or delight.", ["marau"]),
      card("Someone is rere about what may happen but rarawa about what already happened. Do the two words name exactly the same feeling?", ["No", "Yes"], "No", "Rere is fear; rarawa is sadness. The same event can cause both, but they are not interchangeable.", ["rere"])
    ]),
    rere: play("Fear and courage", "Rere is fear. Yaloqaqa is courageous; rarawa is sadness rather than fear itself.", "rere", [
      card("A person acts while still feeling rere. Does acting yaloqaqa require that no fear exists?", ["No", "Yes"], "No", "Courage concerns how one faces a situation; rere names the feeling of fear.", ["yaloqaqa"]),
      card("A loss brings rarawa but no threat. Which word names sadness rather than fear?", ["rarawa", "rere"], "rarawa", "Rarawa is sorrow; rere is fear of danger or what may happen.", ["rarawa"])
    ]),
    sote: play("A shirt within clothing", "Sote names a shirt. Isulu is the broader clothing word; ivava is footwear.", "sote", [
      card("A person puts on a sote. Has the word told you the garment is a shirt or any kind of isulu?", ["A shirt", "Any garment"], "A shirt", "Sote is the particular garment; isulu covers clothing more broadly.", ["isulu"]),
      card("Someone also puts on ivava. Does ivava name another shirt?", ["No", "Yes"], "No", "Ivava is footwear. A complete outfit can include both a sote and shoes.", ["ivava"])
    ]),
    sovu: play("Soap and the result of washing", "Sovu is soap. Fiji health guidance pairs it with water for washing hands; savasava describes a clean state.", "sovu", [
      card("The guidance says sovu kei na wai. Which word names the soap?", ["sovu", "savasava"], "sovu", "Sovu is the substance used in washing. Savasava describes cleanliness.", ["savasava"]),
      card("If someone's hands are savasava, must the word itself say which brand or kind of sovu was used?", ["No", "Yes"], "No", "The result and the cleaning material have different names; the description does not specify a product.", ["savasava"])
    ], { label: "Read sovu kei na wai in Fiji health advice", href: "https://www.health.gov.fj/wp-content/uploads/2020/04/Advisory16320_iTaukei_COVID-19.pdf" }),
    senikau: play("A flower and a garland", "Senikau names a flower. In a Fijian account of welcoming visitors, different senikau are used in a salusalu, a flower garland.", "senikau", [
      card("If you admire a senikau on a plant, have you named the flower or its fruit?", ["Flower", "Fruit"], "Flower", "Senikau is the flower; a plant may later bear fruit, but that is a different part."),
      card("A welcome garland is made with several senikau. Which word names the finished garland?", ["salusalu", "senikau"], "salusalu", "Senikau are the flowers; salusalu is the garland made from them.", ["salusalu"])
    ], { label: "Read about senikau in a Fijian welcome garland", href: "https://fijisun.com.fj/news/itaukei/siga-rarama-cadra-tale-e-dua-na-matanisiga-vou" }),
    tagane: play("Which person?", "Tagane specifies a male person. Tamata can refer to a person without making that distinction.", "tagane", [
      card("A report says tamata but gives no other clue. Can you conclude that the person is a tagane?", ["No", "Yes"], "No", "Tamata alone does not specify male; tagane does.", ["tamata"]),
      card("A story contrasts a tagane with a yalewa. Which word names the woman?", ["yalewa", "tagane"], "yalewa", "Yalewa is the woman; tagane is the man.", ["yalewa"])
    ]),
    tamata: play("One person or the people?", "Tamata can name a person or people, according to the phrase. Tagane adds a male distinction; a Fiji government speech uses nomuni tamata when referring to a community's people.", "tamata", [
      card("If a sentence names a tamata but gives no further detail, is the person's sex already stated?", ["No", "Yes"], "No", "Tamata names the person; it does not itself say tagane or yalewa.", ["tagane", "yalewa"]),
      card("A speaker addresses leaders about nomuni tamata. Does the phrase refer to just one person or their people together?", ["Their people", "Just one person"], "Their people", "In that speech the phrase points to the community's people. The wider context helps show the collective reading.")
    ], { label: "Read nomuni tamata in a Fiji government speech", href: "https://www.pmoffice.gov.fj/prime-minister-josaia-voreqe-bainimaramas-speech-at-the-opening-of-the-lomaiviti-provincial-council-meeting-2/" }),
    tavaya: play("A vessel for carrying liquid", "Tavaya is a bottle. Bilo is a drinking cup, while vokete is a bucket.", "tavaya", [
      card("You pour from a tavaya into a bilo. Which one is the bottle?", ["tavaya", "bilo"], "tavaya", "Tavaya names the bottle; bilo names the cup used to drink.", ["bilo"]),
      card("A household carries a large amount of water in a vokete. Is vokete simply another word for a bottle?", ["No", "Yes"], "No", "Vokete is a bucket or pail. Tavaya is a bottle.", ["vokete"])
    ]),
    teveli: play("A surface, a seat, a meal", "Teveli is a table. Idabedabe is a seat; kakana is food that may be set on a table.", "teveli", [
      card("A person pulls up an idabedabe beside a teveli. Which one is the seat?", ["idabedabe", "teveli"], "idabedabe", "Idabedabe names a seat; teveli is the table.", ["idabedabe"]),
      card("Kakana is placed on the teveli. Does teveli name the food?", ["No", "Yes"], "No", "Kakana is food; teveli is the surface it is placed on.", ["kakana"])
    ]),
    uto: play("Breadfruit among Fiji's food crops", "Uto is breadfruit. Fiji's traditional seasonal calendar mentions uto beside vudi, a distinct food crop.", "uto", [
      card("A seasonal list mentions uto and vudi together. Does that make them two names for breadfruit?", ["No", "Yes"], "No", "Uto is breadfruit; vudi is plantain or cooking banana.", ["vudi"]),
      card("A recipe replaces uto with tavioka. Has it kept the same crop?", ["No", "Yes"], "No", "Tavioka is cassava, a different plant and food from breadfruit.", ["tavioka"])
    ], { label: "See the Fiji seasonal calendar", href: "https://www.ndmo.gov.fj/wp-content/uploads/2024/04/CBDRM-Training-Manual.pdf" }),
    oca: play("Feeling tired", "Oca describes being tired. Waiting may contribute to fatigue, but waraka itself names the act of waiting.", "oca", [
      card("Someone has been waiting a long time and now feels oca. Which word names the tired feeling?", ["oca", "waraka"], "oca", "Oca describes tiredness; waraka means to wait.", ["waraka"]),
      card("Can a person be oca after work without being rarawa?", ["Yes", "No"], "Yes", "Oca is tiredness and rarawa is sorrow. They can occur together, but one does not imply the other.", ["rarawa"])
    ]),
    polo: play("The object in the game", "Polo is a ball. Qito can name play or a game, and imau refers to cards or other game pieces.", "polo", [
      card("Children start a qito by passing a polo. Which word names the ball?", ["polo", "qito"], "polo", "Polo is the object; qito is the playing or game.", ["qito"]),
      card("A game uses imau rather than a polo. Must every qito involve a ball?", ["No", "Yes"], "No", "Imau can be cards or game pieces; a ball is only one possible object used in play.", ["imau", "qito"])
    ]),
    ramusu: play("What kind of break?", "Ramusu can describe a broken limb, branch or other long part. Cabola is used for something split or cracked open; mavoa concerns injury or damage.", "ramusu", [
      card("A long branch snaps across its length. Which word fits that kind of break?", ["ramusu", "cabola"], "ramusu", "Ramusu fits the broken branch; cabola foregrounds splitting or cracking open.", ["cabola"]),
      card("A person is mavoa after an accident. Does mavoa by itself say a limb is ramusu?", ["No", "Yes"], "No", "Mavoa means injured or wounded. Ramusu is a more specific description of a break.", ["mavoa"])
    ]),
    vakabauta: play("Belief, evidence and permission", "Vakabauta concerns believing or trusting. Vakadinata concerns accepting something as true; vakadonuya concerns approving it.", "vakabauta", [
      card("Someone trusts a person before seeing proof. Which word puts that trust in focus?", ["vakabauta", "vakadonuya"], "vakabauta", "Vakabauta can express belief or trust. Vakadonuya is approval or permission.", ["vakadonuya"]),
      card("A claim is checked and then accepted as true. Which related word makes that acceptance explicit?", ["vakadinata", "vakabauta"], "vakadinata", "Vakadinata is to acknowledge or accept the truth of a claim; vakabauta can be broader belief or trust.", ["vakadinata"])
    ]),
    vakadinata: play("Accepting a claim as true", "Vakadinata concerns agreement that something is true. Belief and official permission are related but different acts.", "vakadinata", [
      card("A witness examines evidence and accepts a statement as true. Which word points to that acceptance?", ["vakadinata", "vakadonuya"], "vakadinata", "Vakadinata concerns accepting the statement as true; vakadonuya concerns approval or permission.", ["vakadonuya"]),
      card("Can someone vakabauta a friend yet still ask for proof before they vakadinata a particular claim?", ["Yes", "No"], "Yes", "Trust in a person and acceptance of a specific claim are separable; the complete Fijian phrase determines the precise use.", ["vakabauta"])
    ]),
    vakadonuya: play("Permission is a decision", "Vakadonuya is to approve or permit something. A decision to allow an action differs from accepting a statement as true.", "vakadonuya", [
      card("A group asks to hold an event and receives approval. Which word names the approval?", ["vakadonuya", "vakadinata"], "vakadonuya", "Vakadonuya concerns permission; vakadinata concerns accepting a claim as true.", ["vakadinata"]),
      card("Someone wants to join, but the organiser has not agreed. Is vinakata alone the organiser's permission?", ["No", "Yes"], "No", "Vinakata names wanting; vakadonuya names the separate act of approval.", ["vinakata"])
    ]),
    "vakalailai-taka": play("Make it smaller", "Vakalailai-taka describes reducing something. Levu describes largeness; the two words do different work in an account of change.", "vakalailai-taka", [
      card("A pile was levu, then someone reduced it. Which word names the act of reduction?", ["vakalailai-taka", "levu"], "vakalailai-taka", "Levu describes the quantity or size; vakalailai-taka describes making it smaller.", ["levu"]),
      card("If a task says vakalailai-taka, is it describing a finished small size or asking for a change?", ["A change", "A finished size"], "A change", "The word expresses making or reducing, not merely a fixed measurement.")
    ]),
    vakaloloma: play("A response to distress", "Vakaloloma describes something pitiful or distressing. Rarawa names sorrow; the two may occur together without being identical.", "vakaloloma", [
      card("A difficult situation is vakaloloma. Does that word identify a distressing situation or only the feeling of fear?", ["A distressing situation", "Only fear"], "A distressing situation", "Vakaloloma can characterise a pitiful or distressing state; rere names fear.", ["rere"]),
      card("Someone feels rarawa while hearing about a vakaloloma event. Which word names the sorrow they feel?", ["rarawa", "vakaloloma"], "rarawa", "Rarawa is sadness; vakaloloma describes the distressing or pitiable state.", ["rarawa"])
    ]),
    varada: play("Part of a building", "Varada is a veranda or balcony attached to a building. Vale names a house; an otela is a hotel that may also have a veranda.", "varada", [
      card("A home has an open, attached veranda. Which word names that part rather than the whole house?", ["varada", "vale"], "varada", "Varada is the veranda; vale is the house or building.", ["vale"]),
      card("If an otela has a varada, has varada become another name for the hotel?", ["No", "Yes"], "No", "A veranda is a part of the building. Otela names the hotel as a whole.", ["otela"])
    ]),
    veiliutaki: play("Leading and taking part", "Veiliutaki names leadership. Vakaitavi names participation; a participant need not be the leader.", "veiliutaki", [
      card("A community project has many helpers but one person directing it. Which word names the work of leading?", ["veiliutaki", "vakaitavi"], "veiliutaki", "Veiliutaki is leadership; vakaitavi is taking part.", ["vakaitavi"]),
      card("A group works together on a task. Does each person's vakaitavi automatically mean that each holds veiliutaki?", ["No", "Yes"], "No", "Taking part and holding a leadership role are distinct, even when many people contribute.", ["vakaitavi"])
    ], { label: "See veiliutaki and vakaitavi in Fiji's Constitution", href: "https://www.laws.gov.fj/ResourceFile/Get/?fileName=2013+Constitution+of+Fiji+%28iTaukei%29.pdf" }),
    veimau: play("Play without a ball", "Veimau is used for playing a nonphysical game, such as cards. Polo names a ball; qito is a wider play or game word.", "veimau", [
      card("Players sit around a table with imau. Which word can name the kind of game they play?", ["veimau", "polo"], "veimau", "Veimau concerns a game such as cards; polo is a ball.", ["imau", "polo"]),
      card("Could qito describe play more generally without telling you that it is veimau?", ["Yes", "No"], "Yes", "Qito is broader play or game; veimau gives the more particular nonphysical game context.", ["qito"])
    ]),
    vinakata: play("Wanting is not waiting", "Vinakata expresses wanting or wishing for something. Waraka is waiting; vakadonuya is approving.", "vinakata", [
      card("A person wants a reply but has not received it. Which word names the wanting?", ["vinakata", "waraka"], "vinakata", "Vinakata names the wish; waraka names waiting for the reply.", ["waraka"]),
      card("A child vinakata an outing. Does that by itself mean a parent has vakadonuya it?", ["No", "Yes"], "No", "Wanting an outing and receiving permission are separate matters.", ["vakadonuya"])
    ]),
    vinivo: play("A particular garment", "Vinivo names a dress or pinafore. Sote names a shirt; isulu is a wider clothing word.", "vinivo", [
      card("A garment is identified as a vinivo. Does that tell you a particular kind of clothing or only that it is isulu?", ["A particular kind", "Only clothing generally"], "A particular kind", "Vinivo is the dress or pinafore; isulu can refer to clothing more generally.", ["isulu"]),
      card("A shopper asks for a sote rather than a vinivo. Which garment have they asked for?", ["A shirt", "A dress"], "A shirt", "Sote is a shirt; vinivo is a dress or pinafore.", ["sote"])
    ]),
    vokete: play("Three kinds of container", "Vokete is a bucket or pail. Tavaya is a bottle, while kuro is a cooking pot.", "vokete", [
      card("A family carries water in a vokete and pours some into a tavaya. Which word names the bucket?", ["vokete", "tavaya"], "vokete", "Vokete is the bucket; tavaya is the bottle.", ["tavaya"]),
      card("A cook heats food in a kuro. Is that the same kind of vessel as a vokete?", ["No", "Yes"], "No", "Kuro is a cooking pot; vokete is a bucket or pail.", ["kuro"])
    ]),
    vuniwai: play("Who treats the patient?", "Vuniwai names a doctor or medical practitioner. Kemesi names the pharmacy or chemist's shop; mate can name illness.", "vuniwai", [
      card("A patient consults a vuniwai about a mate. Which word names the practitioner?", ["vuniwai", "mate"], "vuniwai", "Vuniwai is the practitioner; mate can mean illness or disease in this context.", ["mate"]),
      card("Someone visits a kemesi after seeing a vuniwai. Which word names the place, not the person?", ["kemesi", "vuniwai"], "kemesi", "Kemesi is a pharmacy; vuniwai is the doctor.", ["kemesi"])
    ], { label: "See vuniwai in Fiji health advice", href: "https://www.health.gov.fj/wp-content/uploads/2020/04/Advisory1420_iTaukei_-COVID-19-1.pdf" }),
    waqavuka: play("The aircraft and the airfield", "Waqavuka is an aeroplane, distinct from a motoka. An official Fiji account uses rara ni waqavuka for the place where aircraft land.", "waqavuka", [
      card("An itinerary uses a waqavuka for the long journey. Which vehicle is named?", ["An aeroplane", "A car"], "An aeroplane", "Waqavuka is an aeroplane; motoka is a car.", ["motoka"]),
      card("In rara ni waqavuka, is the whole expression naming the aircraft or the airfield?", ["The airfield", "The aircraft"], "The airfield", "The official passage uses rara ni waqavuka for the place; waqavuka alone names the aircraft.")
    ], { label: "Read rara ni waqavuka in a Fiji government statement", href: "https://www.pmoffice.gov.fj/prime-minister-hon-josaia-voreqe-bainimaramas-statement-on-fijis-fifth-covid-19-case-25-03-2020/" }),
    waraka: play("The wait and the wish", "Waraka means to wait for someone or something. Vinakata names wanting; lako names going.", "waraka", [
      card("A visitor wants to leave but stays until a friend arrives. Which word names the staying and waiting?", ["waraka", "vinakata"], "waraka", "Waraka is the wait; vinakata is the wish or desire.", ["vinakata"]),
      card("When the friend finally arrives, the visitor begins to lako. Which word names the earlier action?", ["waraka", "lako"], "waraka", "Waraka is waiting; lako is going or travelling.", ["lako"])
    ]),
    weleti: play("Papaya in Fiji's fields and markets", "Weleti is papaya. A Fiji parliamentary account names weleti as a crop in a small-scale export trade; maqo is a different fruit, mango.", "weleti", [
      card("A fruit seller labels one pile weleti and another maqo. Are both names for papaya?", ["No", "Yes"], "No", "Weleti is papaya; maqo is mango.", ["maqo"]),
      card("A grower speaks of sending weleti to a market overseas. Which crop is being discussed?", ["Papaya", "Plantain"], "Papaya", "The parliamentary account explicitly pairs weleti with papaya; vudi is plantain.", ["vudi"])
    ], { label: "Read the Fiji parliamentary account of weleti growing", href: "https://parliament.gov.fj/wp-content/uploads/2017/03/TUESDAY-14TH-OCTOBER-2014.pdf" }),
    yabaki: play("A year in a longer calendar", "Yabaki names a year. Vula can name a month, and siga a day.", "yabaki", [
      card("A record covers several vula but less than one yabaki. Which unit is the year?", ["yabaki", "vula"], "yabaki", "Yabaki is a year; vula can be a month.", ["vula"]),
      card("A notice gives one siga for an event. Has it named a whole yabaki?", ["No", "Yes"], "No", "Siga can name a day. Yabaki is the longer yearly unit.", ["siga"])
    ]),
    mamada: play("Light in the hand", "Mamada describes light weight. Bibi can describe heaviness; levu describes size or quantity, which is a different measure.", "mamada", [
      card("Two identical vokete are lifted; one is mamada because it contains less. Which other word would describe the heavier one?", ["bibi", "mamada"], "bibi", "Mamada concerns light weight; bibi can mean heavy.", ["bibi", "vokete"]),
      card("An empty bag is levu but mamada. Is there a contradiction?", ["No", "Yes"], "No", "Levu describes its size; mamada describes its light weight. A large object need not be heavy.", ["levu"])
    ]),
    matata: play("Clear does not always mean true", "Matata can describe an explanation or situation that is clear. A clear claim can still need checking before someone vakadinata it.", "matata", [
      card("A statement is easy to understand but has not yet been checked. Which word speaks to its clarity?", ["matata", "vakadinata"], "matata", "Matata concerns clarity; vakadinata concerns accepting a statement as true.", ["vakadinata"]),
      card("A plan is matata but its details are not titobu. Must a clear plan also be deep or detailed?", ["No", "Yes"], "No", "Matata concerns clarity; titobu concerns depth, including depth of thought in a suitable phrase.", ["titobu"])
    ]),
    meimei: play("Care for a child", "Meimei is someone who looks after a child, such as a babysitter or nursemaid. It identifies a caregiving role, not necessarily a family relationship.", "meimei", [
      card("A child is looked after by a meimei while tata is away. Which word names the caregiver rather than the father?", ["meimei", "tata"], "meimei", "Meimei names the childcare role; tata is a familiar way to say dad.", ["tata"]),
      card("Does calling someone a meimei automatically mean that the person is the child's momo?", ["No", "Yes"], "No", "Momo is a maternal uncle; meimei describes care for a child, whether or not the caregiver is related.", ["momo"])
    ]),
    yalewa: play("A woman, a person, a form of respect", "Yalewa specifies a woman. Tamata is broader, while marama can be a respectful way to refer to a lady.", "yalewa", [
      card("A description says tamata and nothing more. Does it yet tell you that the person is a yalewa?", ["No", "Yes"], "No", "Tamata names a person without specifying woman or man.", ["tamata", "tagane"]),
      card("A speaker addresses a marama. Is that respectful term merely another way of saying tagane?", ["No", "Yes"], "No", "Marama is a respectful term for a lady; tagane names a man.", ["marama", "tagane"])
    ]),
    yaloqaqa: play("What courage describes", "Yaloqaqa describes courage. Rere is fear; veiliutaki is the work of leading people.", "yaloqaqa", [
      card("Someone acts despite feeling rere. Could the action still be yaloqaqa?", ["Yes", "No"], "Yes", "Courage is compatible with feeling fear; rere names the fear itself.", ["rere"]),
      card("If someone holds veiliutaki, does the role alone prove that every action is yaloqaqa?", ["No", "Yes"], "No", "Veiliutaki is leadership as a role or activity; yaloqaqa describes courage in how someone faces difficulty.", ["veiliutaki"])
    ]),
    yasana: play("Province, island, or country?", "Yasana is a province of Fiji. An island is a yanuyanu; matanitu can name a state or government. These labels describe different ways of grouping places.", "yasana", [
      card("A visitor asks which Fiji province a place belongs to. Which word names that administrative level?", ["yasana", "yanuyanu"], "yasana", "Yasana names the province. Yanuyanu names an island, which is a geographical feature.", ["yanuyanu"]),
      card("In the community sequence, is a yasana the same level as a whole matanitu?", ["No", "Yes"], "No", "Matanitu is the wider state or government level; yasana names a province within Fiji.", ["matanitu"])
    ], { label: "See koro, tikina and yasana in a Fiji place record", href: "https://tab.gov.fj/2025/12/08/savulelele-vuli-kei-na-veiqaravi-ena-koro-o-nabalasere/" }),
    boso: play("A boss is a role, not a skill", "Boso is an informal word for a boss or person in charge. Matai can describe someone skilled at a task; turaga can be a respectful address or title.", "boso", [
      card("A skilled worker is called matai but is not managing anyone. Must that person also be the boso?", ["No", "Yes"], "No", "Matai concerns skill; boso concerns being in charge.", ["matai"]),
      card("If someone uses turaga as a respectful address, have they necessarily called the person their workplace boso?", ["No", "Yes"], "No", "Turaga and boso have different uses; respect does not by itself identify an employer.", ["turaga"])
    ]),
    imau: play("What the players hold", "Imau can name cards or other game pieces. Polo is a ball, and veimau is the activity of playing a nonphysical game.", "imau", [
      card("Players deal imau rather than pass a polo. Which word can name the cards?", ["imau", "polo"], "imau", "Imau refers to cards or pieces; polo is a ball.", ["polo"]),
      card("Two people sit at a table and veimau. Is veimau the game activity or another name for the pieces they hold?", ["The activity", "The pieces"], "The activity", "Veimau names playing this kind of game; imau can name the pieces used.", ["veimau"])
    ]),
    matai: play("Skill and the person who directs work", "Matai may describe someone skilled at a task; another recorded sense names a skilled craft worker. Boso instead concerns being in charge.", "matai", [
      card("A carpenter is respected for careful work but supervises no one. Is matai or boso the clearer clue to skill?", ["matai", "boso"], "matai", "Matai points to expertise. Boso points to a person in charge.", ["boso"]),
      card("Does calling someone matai tell you that the person works only in one craft in every context?", ["No", "Yes"], "No", "The word has a broader skilled-person use as well as a more specific craft-worker sense; the surrounding phrase matters.")
    ]),
    matanivanua: play("Who speaks in formal protocol?", "Matanivanua is a herald or spokesperson in formal communication. Turaga names a chief or respected man; i sevusevu names a customary presentation, not the spokesperson.", "matanivanua", [
      card("During a formal welcome, which word identifies the herald rather than the presentation itself?", ["matanivanua", "i sevusevu"], "matanivanua", "Matanivanua is the spokesperson; i sevusevu is a customary presentation.", ["i sevusevu"]),
      card("If a speaker is a matanivanua, does the role alone tell you that the person is the turaga being addressed?", ["No", "Yes"], "No", "The herald's communication role and the chief's title are distinct.", ["turaga"])
    ], { label: "Read about the matanivanua role in Fiji Parliament", href: "https://parliament.gov.fj/wp-content/uploads/2025/09/Daily-Hansard-Friday-8-August-2025.pdf" }),
    momo: play("A relative on the mother's side", "Momo names a maternal uncle, the mother's brother. Tata names a father; veiwekani is a wider word for kinship ties.", "momo", [
      card("A child introduces their mother's brother. Which family word identifies him?", ["momo", "tata"], "momo", "Momo is a maternal uncle; tata is dad or father.", ["tata"]),
      card("A family describes its wider veiwekani. Does that broad term specify that every relative is a momo?", ["No", "Yes"], "No", "Veiwekani covers relationships more broadly; momo identifies one particular family relation.", ["veiwekani"])
    ]),
    sigalevu: play("The middle of the day", "Sigalevu refers to midday or the early afternoon. Siga can refer to a day; karobo is dusk or twilight.", "sigalevu", [
      card("An appointment is at sigalevu. Has it named the middle of the day or the whole siga?", ["The middle of the day", "The whole day"], "The middle of the day", "Sigalevu narrows the time; siga can refer to a day more generally.", ["siga"]),
      card("If the light is fading at karobo, is that the same time as sigalevu?", ["No", "Yes"], "No", "Karobo is dusk; sigalevu is around midday or early afternoon.", ["karobo"])
    ]),
    tata: play("Dad and other people who care", "Tata is a familiar way to say father or dad. Momo names the mother's brother; meimei names someone caring for a child.", "tata", [
      card("A child calls their father tata. Would momo identify that same relationship?", ["No", "Yes"], "No", "Momo is a maternal uncle, a different family relation.", ["momo"]),
      card("A meimei looks after the child while tata works. Does the childcare role itself make the meimei the father?", ["No", "Yes"], "No", "Meimei describes care for a child; tata names the father.", ["meimei"])
    ]),
    tea: play("From planting to selling", "Tea means to plant something so it grows. Tavioka is one crop that can be planted; volitaka means to sell something after it has been produced.", "tea", [
      card("Someone puts tavioka cuttings into the ground. Which word names the planting action?", ["tea", "tavioka"], "tea", "Tea is the action of planting; tavioka is the cassava crop.", ["tavioka"]),
      card("A farmer grows a crop and later volitaka it. Which action came first?", ["tea", "volitaka"], "tea", "Tea is planting; volitaka is selling. They describe different stages of growing and trading food.", ["volitaka"])
    ]),
    tukuna: play("A thought, a telling, a record", "Tukuna means to tell or say something. Nanuma is to think or remember; ivola can be a written record.", "tukuna", [
      card("A person remembers a story but has not yet shared it. Which word names the act of telling it aloud?", ["tukuna", "nanuma"], "tukuna", "Nanuma is remembering or thinking; tukuna is telling or saying it.", ["nanuma"]),
      card("The story is preserved in an ivola. Is the book itself the same thing as the act of tukuna?", ["No", "Yes"], "No", "Ivola is a book or written record; tukuna is an act of telling.", ["ivola"])
    ]),
    yanuyanu: play("Land surrounded by sea", "Yanuyanu is an island. Wasawasa is the sea or ocean around it; yasana is a province, an administrative grouping.", "yanuyanu", [
      card("A boat crosses the wasawasa and reaches a yanuyanu. Which word names the land it reaches?", ["yanuyanu", "wasawasa"], "yanuyanu", "Yanuyanu names the island; wasawasa names the sea.", ["wasawasa"]),
      card("A map gives a yasana for an island. Are yasana and yanuyanu two labels for the same kind of feature?", ["No", "Yes"], "No", "Yasana is a province; yanuyanu is a landform. A province and an island are different kinds of grouping.", ["yasana"])
    ]),
    yadra: play("Awake is not a clock time", "Yadra can describe being awake or waking up. Karobo is dusk; siga is a day. A person may be awake at different times.", "yadra", [
      card("A person yadra before anyone calls them. Is the word describing their waking or the hour of the day?", ["Their waking", "The hour"], "Their waking", "Yadra concerns the person's state or change to wakefulness; it is not a clock time."),
      card("Someone is still yadra at karobo. Must yadra mean morning?", ["No", "Yes"], "No", "Karobo is dusk; yadra can describe wakefulness then too.", ["karobo"])
    ]),
    mavoa: play("An injury may need more detail", "Mavoa describes an injury or wound. Ramusu is more specific to a break, and mate can name an illness in context.", "mavoa", [
      card("Someone's arm is mavoa. Can you conclude from that word alone that it is ramusu?", ["No", "Yes"], "No", "Mavoa says injured; ramusu would specify a break.", ["ramusu"]),
      card("A doctor sees someone with a mate but no wound. Does mate necessarily describe the same thing as mavoa?", ["No", "Yes"], "No", "Mate can refer to illness; mavoa points to injury or damage.", ["mate", "vuniwai"])
    ]),
    niusiveva: play("A newspaper with an English origin", "Niusiveva names a newspaper and was adapted from the English word newspaper. Ivola is a wider book or record word; tukuna is the act of telling something.", "niusiveva", [
      card("Which English word can you hear behind the Fijian form niusiveva?", ["newspaper", "notebook"], "newspaper", "Niusiveva is a borrowing from newspaper, reshaped to fit Fijian sounds. Ivola has a wider written-record sense.", ["ivola"]),
      card("A neighbour tukuna the same news aloud. Has the news necessarily been printed in a niusiveva?", ["No", "Yes"], "No", "Tukuna is telling; niusiveva names the printed newspaper.", ["tukuna"])
    ]),
    savasava: play("The result and the cleaning material", "Savasava describes something clean. Sovu is soap used in cleaning; maca describes a different state, such as a container being empty or liquid used up.", "savasava", [
      card("A washed cup is savasava. Which word names the soap that might have been used?", ["sovu", "savasava"], "sovu", "Sovu is soap; savasava describes the clean result.", ["sovu"]),
      card("A clean vokete is empty. Does savasava itself tell you that the bucket is maca?", ["No", "Yes"], "No", "Cleanliness and emptiness are separate properties; maca can refer to an empty or used-up supply.", ["vokete", "maca"])
    ]),
    katakata: play("Heat in two settings", "Katakata can describe high heat and, in a food context, spicy heat. Masima is salt, a different taste clue.", "katakata", [
      card("A pot is katakata after cooking. Is the heat from temperature or necessarily from chilli?", ["Temperature", "Necessarily chilli"], "Temperature", "Katakata can describe something physically hot; the context tells you which kind of heat is meant.", ["kuro"]),
      card("A dish tastes katakata but not masima. Which contrast fits?", ["Spicy rather than salty", "Salty rather than spicy"], "Spicy rather than salty", "Katakata can describe spicy heat in food; masima is salt.", ["masima"])
    ]),
    maca: play("Empty, dry or simply clean?", "Maca can describe a supply of liquid that has run out or dried up. A clean container is savasava, which is a separate idea.", "maca", [
      card("The last water has been poured from a tavaya. Which word points to the supply being used up?", ["maca", "savasava"], "maca", "Maca can describe a liquid supply that is empty or used up; savasava would concern cleanliness.", ["tavaya", "savasava"]),
      card("A vokete is washed and clean but still full of water. Must it also be maca?", ["No", "Yes"], "No", "Maca concerns emptiness or drying up in this use. A full bucket can be savasava without being empty.", ["vokete", "savasava"])
    ]),
    nanuma: play("Remembering before speaking", "Nanuma can mean thinking about or remembering. Tukuna is telling; ivola is a written record that may preserve something for later.", "nanuma", [
      card("You nanuma a person's name but have not said it. Which word names speaking it to someone?", ["tukuna", "nanuma"], "tukuna", "Nanuma concerns thought or memory; tukuna is the telling.", ["tukuna"]),
      card("An ivola preserves an event that you no longer nanuma clearly. Is the written record the same as your remembering?", ["No", "Yes"], "No", "Ivola can be the record; nanuma is the act of thinking or remembering.", ["ivola"])
    ]),
    yali: play("Gone does not always mean dead", "Yali can mean missing, absent or gone; in some contexts it can refer to death. Mate can name death or illness, depending on its phrase.", "yali", [
      card("A friend has not arrived and is yali for now. Does that word alone prove the friend has died?", ["No", "Yes"], "No", "Yali can simply mean missing or absent; context is needed before reading it as death.", ["mate"]),
      card("You waraka someone who is still away. Which word names your waiting, rather than their absence?", ["waraka", "yali"], "waraka", "Waraka is waiting; yali describes the person's absence or disappearance.", ["waraka"])
    ]),
    osooso: play("Busy is not automatically tired", "Osooso means occupied with many things. Galala is free or available; oca describes tiredness.", "osooso", [
      card("A worker has many tasks and is osooso. Which word would say that the worker is available instead?", ["galala", "osooso"], "galala", "Galala can describe being free or available; osooso means busy.", ["galala"]),
      card("A person finishes an osooso day but still feels energetic. Must they be oca?", ["No", "Yes"], "No", "Osooso is busyness; oca is tiredness. One does not necessarily follow from the other.", ["oca"])
    ]),
    ceva: play("A direction, not the whole forecast", "Ceva points south. Cagi names wind; draki names weather. The direction can describe where a wind comes from without naming all the weather.", "ceva", [
      card("A chart points ceva on the compass. Does it point north or south?", ["South", "North"], "South", "Ceva is the southern direction; vualiku points north.", ["vualiku"]),
      card("If someone reports a wind from the south, which word names the wind itself?", ["cagi", "ceva"], "cagi", "Cagi is wind; ceva supplies a direction.", ["cagi", "draki"])
    ]),
    daveta: play("A way through the reef", "Daveta is a passage through a reef that boats can use. The recorded place-name Davetalevu refers to a particular passage, while daveta can describe a reef opening more generally.", "daveta", [
      card("A boat crosses a reef through its daveta. What feature is the word pointing to?", ["An opening through the reef", "The whole ocean"], "An opening through the reef", "Daveta names the passage, whereas wasawasa names the sea.", ["wasawasa"]),
      card("Does the name Davetalevu mean that every daveta is the same passage?", ["No", "Yes"], "No", "Daveta can be a general reef-passage word; Davetalevu names a particular passage in a recorded place-name.")
    ], { label: "Read about the named Davetalevu", href: "https://www.jstage.jst.go.jp/article/jsos/21/0/21_87/_pdf" }),
    duna: play("Which eel is being named?", "Duna names a freshwater eel. One Fiji fisheries list identifies a duna with the marbled eel, Anguilla marmorata; local names may cover more than one identification.", "duna", [
      card("A duna is caught in a river. Which habitat matches the dictionary meaning?", ["Fresh water", "Only an offshore reef"], "Fresh water", "Duna is recorded as a freshwater eel; tunatuna names a conger eel.", ["tunatuna"]),
      card("Would the English word eel by itself tell you whether a fish is duna or tunatuna?", ["No", "Yes"], "No", "The broad English label is not enough. Habitat and local identification matter; diria is another recorded freshwater eel name.", ["diria", "tunatuna"])
    ], { label: "See duna in a Fiji fish-name list", href: "https://www.aciar.gov.au/sites/default/files/legacy/node/2217/mn35_pdf_78957.pdf" }),
    iloilo: play("A surface that shows you yourself", "Iloilo can name a mirror or glass. Bilo is a drinking vessel, so the shared English word glass needs the object in view.", "iloilo", [
      card("You see your face in an iloilo. Which English meaning fits?", ["Mirror", "Drinking cup"], "Mirror", "Iloilo can be a mirror; bilo is a cup or drinking vessel.", ["bilo"]),
      card("If someone says 'glass' in English, can you always choose iloilo without knowing whether they mean a mirror or a cup?", ["No", "Yes"], "No", "The object matters. English glass can name different things, while iloilo and bilo separate this contrast.", ["bilo"])
    ]),
    laga: play("Starting the song", "Laga can mean beginning or leading a song. The word points to a singer's role in starting it, not merely to any listener hearing it.", "laga", [
      card("One singer laga a song before others join. Which action is being described?", ["Starting or leading it", "Listening in silence"], "Starting or leading it", "The recorded sense of laga is to begin or lead a song."),
      card("If three people hear a song, has that fact alone told you which one laga it?", ["No", "Yes"], "No", "Hearing a song does not identify the person who began or led it.")
    ]),
    lalai: play("Small things in a group", "Lalai describes more than one small person or thing. Lailai is the related form for a single one in this contrast.", "lalai", [
      card("A group of objects is described as lalai. Is the word pointing to one object or several?", ["Several", "One"], "Several", "The reviewed meaning of lalai specifies more than one; lailai is the related singular form."),
      card("Several objects change from lelevu to lalai. What has changed: their size or their number?", ["Their size", "Their number"], "Their size", "Both words can describe several things. Lelevu says large; lalai says small.", ["lelevu"])
    ]),
    tovolea: play("Trying is a step, not a result", "Tovolea means to try or attempt something. The word tells you there was an effort, not that the aim was achieved.", "tovolea", [
      card("A person tovolea a task but cannot finish it. Was there still an attempt?", ["Yes", "No"], "Yes", "Tovolea names the attempt; success is a separate question."),
      card("Which statement needs more evidence than tovolea alone gives: 'they tried' or 'they succeeded'?", ["They succeeded", "They tried"], "They succeeded", "The meaning establishes the effort. It does not settle the outcome.")
    ]),
    vualiku: play("North and the northerly wind", "Vualiku can point north and can also refer to a northerly wind. Compare ceva for south and cagi for wind itself.", "vualiku", [
      card("On a compass, which word opposes vualiku?", ["ceva", "cagi"], "ceva", "Vualiku points north; ceva points south. Cagi means wind.", ["ceva", "cagi"]),
      card("A report speaks of vualiku as a wind. What has the northern direction helped specify?", ["Where the wind comes from", "The amount of rain"], "Where the wind comes from", "In this sense the direction is part of naming a northerly wind; draki is the broader weather word.", ["cagi", "draki"])
    ]),
    galala: play("Room in a schedule", "Galala can mean free or available. Osooso points to being occupied; galala need not mean that a person has no responsibilities at all.", "galala", [
      card("A person has time to meet today. Which word fits that availability?", ["galala", "osooso"], "galala", "Galala can mean available; osooso means busy.", ["osooso"]),
      card("A worker is galala this afternoon but busy tomorrow. Does galala have to describe their whole life?", ["No", "Yes"], "No", "Availability can belong to a particular time or situation; gauna is a time or period.", ["gauna"])
    ]),
    soqo: play("People gathered for a purpose", "Soqo is a gathering or meeting. Bose more specifically points to a discussion or council meeting; magiti brings food into a feast setting.", "soqo", [
      card("People assemble for an event. Which word can name the gathering itself?", ["soqo", "wasawasa"], "soqo", "Soqo names a gathering of people; wasawasa is the sea.", ["wasawasa"]),
      card("If the gathering is described specifically as a discussion meeting, which related word is useful?", ["bose", "masima"], "bose", "Bose points to a meeting or deliberation, while soqo is a broader gathering word.", ["bose"])
    ]),
    wasawasa: play("The sea around an island", "Wasawasa names the sea or ocean. Yanuyanu is land surrounded by it; waitui can draw attention to sea water.", "wasawasa", [
      card("A boat travels between two yanuyanu across the wasawasa. What does it cross?", ["The sea", "A province"], "The sea", "Wasawasa names the sea; yanuyanu names an island.", ["yanuyanu"]),
      card("If someone is talking about salty sea water itself, which related word makes that water more explicit?", ["waitui", "yanuyanu"], "waitui", "Waitui can mean sea water; wasawasa names the sea or ocean.", ["waitui"])
    ]),
    volitaka: play("Selling changes who has the goods", "Volitaka means to sell something. Makete is a market, the place where a sale may happen; a word for the place does not name the act.", "volitaka", [
      card("A seller volitaka produce at a makete. Which word names what the seller does?", ["volitaka", "makete"], "volitaka", "Volitaka is the selling; makete is the market.", ["makete"]),
      card("Someone carries produce through a makete but makes no sale. Can you infer volitaka from their presence there alone?", ["No", "Yes"], "No", "The market is a setting; the verb requires an actual selling action.", ["makete"])
    ]),
    qarava: play("Care as an action", "Qarava can mean to attend to someone or something, including in medical care. Vuniwai names a medical practitioner; the action and person are distinct.", "qarava", [
      card("A vuniwai qarava a patient. Which word names the action of attending to them?", ["qarava", "vuniwai"], "qarava", "Qarava is the attending or caring action; vuniwai names the practitioner.", ["vuniwai"]),
      card("Must every use of qarava be medical?", ["No", "Yes"], "No", "Qarava also has the wider sense of looking after or attending to someone or something.")
    ]),
    veisau: play("Notice what changed", "Veisau can name a change or an exchange. The context tells you whether something became different or things were exchanged.", "veisau", [
      card("A plan is revised but nothing changes hands. Which veisau reading fits?", ["A change", "An exchange"], "A change", "Veisau can name change without an exchange of objects."),
      card("Two people swap items. Does the exchange reading of veisau fit better than a mere change of weather?", ["Yes", "No"], "Yes", "An exchange involves what passes between participants; the same word can also refer to change in a different context.", ["draki"])
    ]),
    masima: play("Salt is one taste", "Masima is salt. Katakata may describe spicy heat in food, so the two clues tell a cook different things.", "masima", [
      card("A dish needs more masima. What ingredient is missing?", ["Salt", "Chilli"], "Salt", "Masima is salt; katakata describes heat, including spicy heat in food.", ["katakata"]),
      card("Can a dish contain masima and also taste katakata from chilli?", ["Yes", "No"], "Yes", "Salt and spicy heat are different parts of a dish's flavour. One does not rule out the other.", ["katakata"])
    ]),
    sagavulu: play("Building tens", "Sagavulu participates in compound numbers for tens. Ruasagavulu is a recorded form for twenty, while tini separately names ten.", "sagavulu", [
      card("In the recorded number ruasagavulu, how many tens does rua contribute?", ["Two", "One"], "Two", "Rua is two, so ruasagavulu is twenty in this recorded pattern.", ["rua", "tini"]),
      card("Does the existence of sagavulu mean tini has disappeared as a word for ten?", ["No", "Yes"], "No", "Tini is another recorded word for ten. Sagavulu participates in longer compound number forms.", ["tini"])
    ], { label: "See recorded number forms in a Fijian language handbook", href: "https://upload.wikimedia.org/wikipedia/commons/f/fb/Handbook_of_the_Fijian_language_%28IA_handbookoffijian00moorrich%29.pdf" }),
    karobo: play("The light at dusk", "Karobo is dusk or twilight. Sigalevu names midday; yadra names waking or being awake rather than a time of day.", "karobo", [
      card("The light fades near karobo. Which time is being named?", ["Dusk", "Midday"], "Dusk", "Karobo is dusk; sigalevu is midday.", ["sigalevu"]),
      card("Someone is still yadra at karobo. Does that make karobo another word for waking?", ["No", "Yes"], "No", "Karobo is a time of day. Yadra describes wakefulness or waking.", ["yadra"])
    ]),
    tala: play("The person sent and the message carried", "Tala can mean sending a person, often on an errand. Tukuna is telling or saying something; the acts can occur together but are not identical.", "tala", [
      card("A person is tala to deliver a message. Which word names the sending?", ["tala", "tukuna"], "tala", "Tala names sending the person; tukuna names telling or saying the message.", ["tukuna"]),
      card("If you tukuna a message while staying in the same place, have you necessarily tala someone?", ["No", "Yes"], "No", "You can tell something without sending a person on an errand.", ["tukuna"])
    ]),
    veitau: play("Friendship goes both ways", "Veitau describes people being friends with one another. The reciprocal vei- pattern helps point to a shared relationship, but a similar-looking form still needs its own checked meaning.", "veitau", [
      card("Two people are veitau. Is the relationship mutual or one-sided in this meaning?", ["Mutual", "One-sided"], "Mutual", "The reviewed meaning is being friends with one another; vei- can mark reciprocity in checked forms.", ["vei-"] ),
      card("If one person only admires another from afar, does that by itself establish veitau?", ["No", "Yes"], "No", "Veitau names a friendship between them, not one person's unreturned feeling.", ["vei-"])
    ]),
    ivola: play("From writing to a written thing", "Ivola can be a book, letter, mark or record. An attested i- nominal pattern relates a written item to the base vola, so the full context decides which kind of written thing is meant.", "ivola", [
      card("In the attested pairing vola → ivola, what does the attached i- help form?", ["A written thing", "A weather term"], "A written thing", "Ivola can name a book or other written record. The prefix i- is one recorded noun-forming pattern.", ["i-"] ),
      card("A printed newspaper is niusiveva. Does ivola alone tell you that the item is specifically a newspaper?", ["No", "Yes"], "No", "Ivola is broader; niusiveva identifies a newspaper.", ["niusiveva"])
    ], { label: "Read a linguistic analysis of i- and ivola", href: "https://tufs.repo.nii.ac.jp/record/53547/files/dt-ko-0349.pdf" }),
    yalo: play("More than one English word", "Yalo can refer to spirit, soul, mind or inward disposition. Yaloqaqa names courage; the longer word points to a particular quality rather than every sense of yalo.", "yalo", [
      card("A person is described as yaloqaqa. Which quality is named more particularly?", ["Courage", "Width"], "Courage", "Yaloqaqa concerns courage; raba names width.", ["yaloqaqa", "raba"]),
      card("Does translating yalo as 'mind' in one phrase prove it must mean 'mind' in every phrase?", ["No", "Yes"], "No", "Yalo has several related English readings. The complete Fijian phrase decides which is active.")
    ]),
    lelevu: play("Large things, plural", "Lelevu can describe more than one large person or thing. Levu is the related singular form in this contrast; lalai describes the opposite size for several things.", "lelevu", [
      card("Several objects are lelevu. Which related word could describe a single large object?", ["levu", "lalai"], "levu", "Lelevu is plural here; levu is the corresponding singular size word.", ["levu", "lalai"]),
      card("A set of objects changes from lalai to lelevu. What has changed?", ["Their size", "Their number"], "Their size", "Both forms can describe several items. Lalai is small; lelevu is large.", ["lalai"])
    ]),
    lewe: play("People in a group", "Lewe can point to the people of a place or group. Tamata can name a person; lewe in this sense draws attention to membership.", "lewe", [
      card("A notice names the lewe of a village. Is it focusing on people or on the buildings?", ["People", "Buildings"], "People", "Lewe can name the people who belong to a place or group."),
      card("If a story first introduces one tamata and then the lewe of a village, which word points to the group?", ["lewe", "tamata"], "lewe", "Tamata can name an individual person. Lewe here draws attention to the people belonging to a group.", ["tamata"])
    ]),
    raba: play("How wide?", "Raba is width. Balavu describes length or longness; titobu concerns depth, so each asks about a different dimension.", "raba", [
      card("A table is measured from side to side. Which word is about that width?", ["raba", "titobu"], "raba", "Raba is width; titobu is depth.", ["titobu"]),
      card("If a mat is long but narrow, does its balavu alone give its raba?", ["No", "Yes"], "No", "Length and width are separate measurements. Balavu does not by itself tell you the width.", ["balavu"])
    ]),
    waitui: play("Water from the sea", "Waitui is sea water and can also refer to the sea. Wasawasa gives the broader sea or ocean setting.", "waitui", [
      card("A container holds waitui. Is the water from the sea or from a freshwater stream?", ["From the sea", "From a freshwater stream"], "From the sea", "Waitui means sea water in this use; wasawasa names the wider sea.", ["wasawasa"]),
      card("If a boat crosses the wasawasa, does waitui have to mean a cup of water?", ["No", "Yes"], "No", "Waitui can also refer to the sea. The wider setting and phrase choose the reading.", ["wasawasa"])
    ], { label: "See waitui and wasawasa in Fiji weather writing", href: "https://www.fiji.gov.fj/getattachment/4d0259d6-c62e-48ae-8ee9-733fdcc629c7/Fiji-Focus-Issue-20-Volume-11-December-31%2C-2020.aspx" }),
    pae: play("The pastry and its filling", "Pae is pie, a pastry dish with a filling. Madrai is bread and keke is cake; the three baked foods are not interchangeable names.", "pae", [
      card("A baker encloses a filling in pastry. Which word from these entries fits the finished dish?", ["pae", "madrai"], "pae", "Pae names pie; madrai is bread.", ["madrai"]),
      card("If the baker also makes a keke, does that automatically make the cake a pae?", ["No", "Yes"], "No", "Keke names cake. Pae points to the pastry dish with a filling.", ["keke"])
    ]),
    ti: play("What is in the cup?", "Ti names tea. Yaqona names a different drink, and bilo names a vessel rather than either beverage.", "ti", [
      card("A guest asks for ti instead of yaqona. Which drink do they want?", ["Tea", "Kava"], "Tea", "Ti is tea; yaqona is kava.", ["yaqona"]),
      card("Someone holds a bilo containing ti. Which word names the vessel?", ["bilo", "ti"], "bilo", "Bilo is a drinking vessel; ti is the tea inside it.", ["bilo"])
    ]),
    jisi: play("A food that can go into another food", "Jisi is cheese. Keke is cake; a food can contain an ingredient without taking that ingredient's name.", "jisi", [
      card("A cook adds jisi to a dish. Which ingredient has been added?", ["Cheese", "Chocolate"], "Cheese", "Jisi means cheese; jokeliti means chocolate.", ["jokeliti"]),
      card("Could a keke contain jisi while keke still names the finished cake?", ["Yes", "No"], "Yes", "An ingredient and the food containing it can have different names. Jisi is cheese; keke is cake.", ["keke"])
    ]),
    jokeliti: play("Chocolate on its own or in baking", "Jokeliti is chocolate. It might be an ingredient in keke, but the word does not itself mean cake.", "jokeliti", [
      card("A sweet is labelled jokeliti. Is the label naming chocolate or cheese?", ["Chocolate", "Cheese"], "Chocolate", "Jokeliti is chocolate; jisi is cheese.", ["jisi"]),
      card("A keke has jokeliti in it. Which word identifies the cake, not the chocolate ingredient?", ["keke", "jokeliti"], "keke", "Keke names the finished cake; jokeliti can name the chocolate used in it.", ["keke"])
    ]),
    pusi: play("A cat among other animals", "Pusi is a cat. Lulu is an owl: both are animals, but one name does not identify the other.", "pusi", [
      card("An animal curls up on a chair and is identified as pusi. What animal is it?", ["A cat", "An owl"], "A cat", "Pusi is a cat; lulu is an owl.", ["lulu"]),
      card("A pusi hides from visitors. Does the animal name alone mean that it is kila?", ["No", "Yes"], "No", "Pusi identifies the cat. Kila can describe an animal as wild or shy; that needs its own observation.", ["kila"])
    ]),
    lulu: play("Which animal is the owl?", "Lulu is an owl. The dictionary also has pusi for cat; knowing the broad English word animal is not enough to choose between them.", "lulu", [
      card("A bird is identified as lulu. Which animal has been named?", ["An owl", "A cat"], "An owl", "Lulu is an owl; pusi is a cat.", ["pusi"]),
      card("Does lulu alone tell you which species of owl was seen?", ["No", "Yes"], "No", "The checked meaning is owl. A particular species needs more evidence than the broad bird name gives.")
    ]),
    tavako: play("The item and what rises from it", "Tavako can name tobacco or a cigarette. Kuvu can describe smoke rising or drifting; the item and the smoke are different things.", "tavako", [
      card("Someone buys tavako. Have they named tobacco or the smoke after it burns?", ["Tobacco or a cigarette", "The smoke"], "Tobacco or a cigarette", "Tavako names the item. Kuvu can describe rising smoke.", ["kuvu"]),
      card("A room is filled with kuvu after tavako is lit. Which word points to what is in the air?", ["kuvu", "tavako"], "kuvu", "Kuvu concerns the drifting smoke; tavako is the tobacco or cigarette.", ["kuvu"])
    ]),
    drega: play("From a tree to two uses", "Drega is sticky gum or tree resin. It can be chewed or used as glue; those uses do not turn it into two different plants.", "drega", [
      card("A tree produces a sticky material that can be used as glue. Is that drega or drifting kuvu?", ["drega", "kuvu"], "drega", "Drega is sticky gum or resin; kuvu can describe smoke or dust drifting in air.", ["kuvu"]),
      card("One person chews drega and another uses it to stick things together. Must the word have changed to name two unrelated substances?", ["No", "Yes"], "No", "The same sticky material can be described by different practical uses in the checked meaning.")
    ]),
    kaya: play("Thought, speech and a written record", "Kaya means to say or tell something. Nanuma concerns thinking or remembering; ivola can be a written record.", "kaya", [
      card("You nanuma an answer but have not spoken. Which word names the act of saying it?", ["kaya", "nanuma"], "kaya", "Nanuma stays with thought or memory; kaya is saying or telling.", ["nanuma"]),
      card("An ivola contains a story. Has the book itself performed kaya aloud?", ["No", "Yes"], "No", "Ivola names a written thing. Kaya names the act of saying or telling something.", ["ivola"])
    ]),
    vakaitavi: play("Taking part and leading", "Vakaitavi means to take part or have a role. Veiliutaki is leadership; participation does not automatically make someone the leader.", "vakaitavi", [
      card("A volunteer helps at a soqo. Which word describes taking part?", ["vakaitavi", "veiliutaki"], "vakaitavi", "Vakaitavi is participation; veiliutaki is leadership.", ["soqo", "veiliutaki"]),
      card("If everyone at an event is vakaitavi, must everyone also hold veiliutaki?", ["No", "Yes"], "No", "People can contribute in different roles without all directing the work.", ["veiliutaki"])
    ]),
    veiwekani: play("Family ties and friendship", "Veiwekani names kinship ties or relatives linked through family or traditional relationship. Veitau concerns friendship; vuvale focuses on a household.", "veiwekani", [
      card("Two people are veitau but have no known family tie. Does friendship alone establish veiwekani in its kinship sense?", ["No", "Yes"], "No", "Veitau is friendship; veiwekani here points to kinship or a recognised family relationship.", ["veitau"]),
      card("Can relatives live in different vuvale and still have veiwekani?", ["Yes", "No"], "Yes", "Vuvale is a household grouping. A kinship tie can connect people across households.", ["vuvale"])
    ], { label: "Read a USP account of kinship and care", href: "https://repository.usp.ac.fj/id/eprint/14116/1/2020_Routledge%20Edited%20Volume_Besnier%2C%20Calabro%2C%20Guinness_Sport%2C%20Migration%2C%20and%20Gender%20in%20the%20Neoliberal%20Age.pdf" }),
    yavusa: play("A kin group within a wider place", "Yavusa is a traditional kin group that may include several mataqali. Yasana names a province; vuvale names a household, so these labels answer different questions.", "yavusa", [
      card("A person names their yavusa and their yasana. Which label identifies a kin group rather than a province?", ["yavusa", "yasana"], "yavusa", "Yavusa names a kin grouping; yasana names a province.", ["yasana"]),
      card("Could a yavusa include more than one vuvale?", ["Yes", "No"], "Yes", "A yavusa is a wider kin grouping than a single household. Vuvale names the people of one household.", ["vuvale"])
    ], { label: "See Fiji's published account of yavusa and mataqali", href: "https://www.forestry.gov.fj/docs/policies/FijiForestPolicyStatement.pdf" }),
    vuvale: play("The people of a household", "Vuvale points to the people of one household. Yavusa is a wider kin grouping; veiwekani can connect relatives beyond one home.", "vuvale", [
      card("Several relatives live together as one household. Which word names the household people?", ["vuvale", "yasana"], "vuvale", "Vuvale is the household group; yasana is a province.", ["yasana"]),
      card("Do relatives living in separate vuvale lose all veiwekani just because their homes differ?", ["No", "Yes"], "No", "Separate households can still be connected by kinship ties.", ["veiwekani"])
    ]),
    loloma: play("A feeling that can become action", "Loloma names love, affection or caring. Qarava names attending to someone; the feeling and the care given may be connected without being the same word.", "loloma", [
      card("Someone feels deep loloma for a child. Which word names the affection?", ["loloma", "qarava"], "loloma", "Loloma is the love or affection; qarava can name the action of looking after someone.", ["qarava"]),
      card("If a person qarava a neighbour by bringing food, does that action alone specify every feeling they have?", ["No", "Yes"], "No", "An act of care can express loloma, but the action and the inner feeling are not identical.", ["qarava", "magiti"])
    ], { label: "Read a USP account of loloma and care", href: "https://repository.usp.ac.fj/id/eprint/14116/1/2020_Routledge%20Edited%20Volume_Besnier%2C%20Calabro%2C%20Guinness_Sport%2C%20Migration%2C%20and%20Gender%20in%20the%20Neoliberal%20Age.pdf" }),
    maliwa: play("Space between things", "Maliwa is the space between things, or the middle. Raba tells how wide something is; it does not simply name the gap beside it.", "maliwa", [
      card("Two chairs have a gap between them. Which word points to that space?", ["maliwa", "raba"], "maliwa", "Maliwa is the intervening space; raba is width.", ["raba"]),
      card("A person stands in the middle of two chairs. Is the middle reading of maliwa about one chair's width?", ["No", "Yes"], "No", "Maliwa can point to the position between them, not the dimensions of either chair.", ["raba"])
    ]),
    veikau: play("Forest and coastal mangroves", "Veikau means forest or bushland. Veidogo names mangrove vegetation, a more particular coastal plant community.", "veikau", [
      card("A path crosses dense bushland. Which word names the vegetated area generally?", ["veikau", "wasawasa"], "veikau", "Veikau is forest or bushland; wasawasa is the sea.", ["wasawasa"]),
      card("At a muddy coast, a guide points specifically to mangroves. Which word is more particular than veikau?", ["veidogo", "yanuyanu"], "veidogo", "Veidogo names mangroves; veikau is the broader forest or bushland word.", ["veidogo"])
    ]),
    titobu: play("Depth in water and in thought", "Titobu means deep. It can describe physical depth and can also be used in a phrase about thought; raba measures width instead.", "titobu", [
      card("A pool is titobu. Which dimension is being described?", ["Depth", "Width"], "Depth", "Titobu is deep; raba is width.", ["raba"]),
      card("Someone speaks of titobu thought. Must the word now be measuring water?", ["No", "Yes"], "No", "The reviewed meaning also allows depth in a phrase about thought; the full phrase decides the reading.", ["nanuma"])
    ]),
    salusalu: play("A garland, not just any adornment", "Salusalu is a garland made with flowers or fragrant leaves. Qato names a bracelet or similar band worn on an arm or ankle.", "salusalu", [
      card("Flowers and scented leaves are woven into a garland. Which word names the finished adornment?", ["salusalu", "qato"], "salusalu", "Salusalu is the floral garland; qato is a bracelet or band.", ["qato"]),
      card("If an ornament is worn around the wrist, may you call it salusalu merely because it is decorative?", ["Not automatically", "Always"], "Not automatically", "The material and kind of adornment matter. Qato is the checked word for a bracelet or similar band.", ["qato"])
    ]),
    sautu: play("More than a quiet moment", "Sautu brings together peace, well-being and prosperity. Maravu can describe calm sea conditions; these are different kinds of calm.", "sautu", [
      card("A community speaks of sautu. Is it only the surface of a calm sea?", ["No", "Yes"], "No", "Sautu concerns peace and well-being in life; maravu can describe smooth or calm water.", ["maravu"]),
      card("A household is peaceful but struggling to meet basic needs. Has the prosperity side of sautu necessarily been established?", ["No", "Yes"], "No", "The word can include both peace and a sense of enough or well-being; one aspect alone does not settle the whole picture.", ["vuvale"])
    ]),
    rerevaki: play("Danger and what might happen", "Rerevaki can describe something feared or dangerous. Mavoa names an injury, which need not have happened yet for danger to be recognised.", "rerevaki", [
      card("A path is rerevaki. Does the word describe the danger, or merely the feeling of rere in a person?", ["The danger or feared thing", "Only a person's fear"], "The danger or feared thing", "Rere is fear; rerevaki can describe something feared or dangerous.", ["rere"]),
      card("If a path is rerevaki but everyone passes safely, must someone be mavoa?", ["No", "Yes"], "No", "A danger can be present without a person being injured. Mavoa names injury.", ["mavoa"])
    ]),
    magiti: play("Food in a feast setting", "Magiti is food prepared for a feast or ceremonial presentation. Kakana is a broader food word; soqo names a gathering of people.", "magiti", [
      card("Food is prepared for a feast. Which word brings that occasion into the meaning?", ["magiti", "kakana"], "magiti", "Magiti has the feast or ceremonial-food sense; kakana is food more broadly.", ["kakana"]),
      card("People meet for a soqo with no food mentioned. Has the word soqo alone told you there is magiti?", ["No", "Yes"], "No", "Soqo names a gathering; magiti names food in a feast or presentation setting.", ["soqo"])
    ]),
    vuso: play("Foam on the water", "Vuso is froth or foam, especially on water. Kuvu can be smoke, dust, steam or spray rising into the air.", "vuso", [
      card("Bubbles gather as froth on the water. Which word fits that surface layer?", ["vuso", "kuvu"], "vuso", "Vuso is foam or froth; kuvu points to material rising or drifting, such as smoke or spray.", ["kuvu"]),
      card("A sea is maravu with a smooth surface. Would a patch of visible vuso be describing that same smoothness?", ["No", "Yes"], "No", "Maravu describes calmness or smoothness; vuso identifies froth on the surface.", ["maravu"])
    ]),
    vakaisulu: play("Wearing the garment", "Vakaisulu describes being dressed or wearing clothes. Isulu names clothing itself; sote is a shirt, one particular garment.", "vakaisulu", [
      card("A person is vakaisulu for a visit. Which word identifies their dressed state?", ["vakaisulu", "isulu"], "vakaisulu", "Vakaisulu describes the person as dressed; isulu names clothing or a garment.", ["isulu"]),
      card("Someone chooses a sote. Has the word sote alone said whether the person is already vakaisulu?", ["No", "Yes"], "No", "Sote identifies a shirt. Having or choosing a garment is distinct from wearing it.", ["sote"])
    ]),
    maravu: play("A calm sea still has a name", "Maravu describes calm or smooth conditions, especially at sea. Wasawasa is the sea itself; vuso is visible froth or foam.", "maravu", [
      card("The wasawasa is maravu. Which word names the sea rather than its calm condition?", ["wasawasa", "maravu"], "wasawasa", "Wasawasa is the sea; maravu describes its calmness.", ["wasawasa"]),
      card("Foam appears on a patch of water. Which word identifies the froth rather than the smooth state?", ["vuso", "maravu"], "vuso", "Vuso is froth or foam; maravu is calm or smooth.", ["vuso"])
    ]),
    kuvu: play("What rises into the air?", "Kuvu can refer to smoke, dust, steam or fine spray drifting or rising. Vuso is froth on water rather than that drifting material.", "kuvu", [
      card("A lit tavako sends something drifting through the air. Which word can describe the rising smoke?", ["kuvu", "vuso"], "kuvu", "Kuvu includes smoke; vuso is froth or foam.", ["tavako", "vuso"]),
      card("A spray rises above the wasawasa. Does kuvu by itself prove it is smoke from a fire?", ["No", "Yes"], "No", "Kuvu can cover fine spray as well as smoke, dust or steam; the scene settles which one.", ["wasawasa"])
    ]),
    delana: play("At the top of the hill", "Delana is a hilltop. Dela is separately recorded as 'top'; cabecabe can point to the slope or path leading upward.", "delana", [
      card("A walker reaches the delana after climbing a cabecabe. Where are they now?", ["At the hilltop", "On the slope only"], "At the hilltop", "Delana names the top; cabecabe can be the steep slope or path up it.", ["cabecabe"]),
      card("Dela can mean 'top' more generally. What does delana pick out in this entry?", ["A hilltop", "The width of a hill"], "A hilltop", "The checked delana meaning is the top of a hill; raba would concern width.", ["raba"])
    ], { label: "See dela in an independent Fijian word list", href: "https://www.unitec.ac.nz/umisc/jmctest/fijian_english_dictionary/fijian_eng_dict.html" }),
    kila: play("An animal's manner, not its name", "Kila can describe an animal as wild or shy. Pusi tells you the animal is a cat; it does not tell you whether that cat is kila.", "kila", [
      card("A pusi keeps away from people and is called kila. Which word identifies the cat itself?", ["pusi", "kila"], "pusi", "Pusi names the cat; kila describes its wild or shy behaviour in this sense.", ["pusi"]),
      card("If a tame animal becomes shy around strangers, has its species necessarily changed?", ["No", "Yes"], "No", "Kila can describe a way an animal behaves. It need not replace the name of the animal.", ["pusi"])
    ]),
    koula: play("A material and a kind of valuable", "Koula is gold. Tabua is a whale tooth used in formal exchange; kamunaga is a wider category of ceremonial valuables.", "koula", [
      card("A valuable object is made of koula. What material is it made from?", ["Gold", "Whale tooth"], "Gold", "Koula is gold; tabua is a whale tooth.", ["tabua"]),
      card("A speaker mentions kamunaga. Can you conclude that every ceremonial valuable is koula?", ["No", "Yes"], "No", "Kamunaga includes different kinds of ceremonial valuables, including tabua and mats. The category does not mean gold alone.", ["kamunaga", "tabua"])
    ]),
    teri: play("A wetland bird", "Teri is a swamp hen. Lulu names an owl; the broader label 'bird' does not identify which of the two has been seen.", "teri", [
      card("A bird at the edge of a wetland is identified as teri. Which English bird name fits?", ["Swamp hen", "Owl"], "Swamp hen", "Teri is a swamp hen; lulu is an owl.", ["lulu"]),
      card("If another bird visits the same wetland, does its location alone make it a teri?", ["No", "Yes"], "No", "The habitat helps you look, but the bird still needs its own identification. Teri is a particular bird name.")
    ]),
    dawai: play("Unmarried now does not tell the whole story", "Dawai can refer to an adult without a spouse. It can include a bachelor or someone widowed, so English 'single' alone may hide different histories.", "dawai", [
      card("An adult never married. Could dawai fit the current absence of a spouse?", ["Yes", "No"], "Yes", "The checked meaning includes an adult without a spouse, including a bachelor."),
      card("An adult's spouse has died. Must dawai be excluded because that adult was once married?", ["No", "Yes"], "No", "The recorded sense also allows a widowed person. The word does not by itself tell the person's entire history.")
    ]),
    gatu: play("A particular barkcloth in Lau", "In Lau, gatu can name a large barkcloth piece prepared for presentation. Masi is the broader Fijian barkcloth word; kamunaga names ceremonial valuables as a category.", "gatu", [
      card("A large presentation cloth from Lau is described as gatu. What material family does it belong to?", ["Barkcloth", "Gold"], "Barkcloth", "Gatu is a kind of barkcloth; masi is the broader Fijian barkcloth term.", ["masi", "koula"]),
      card("When gatu is presented among kamunaga, does kamunaga mean the cloth's material?", ["No", "Yes"], "No", "Kamunaga groups ceremonial valuables; gatu identifies a particular barkcloth item in this context.", ["kamunaga"])
    ], { label: "Explore Lau barkcloth in a museum collection", href: "https://maa.cam.ac.uk/fiji-solevu" }),
    matabani: play("A group that makes music", "Matabani names a band or orchestra. Mataqiriqiri is another recorded musical-group label; laga names the action of beginning or leading a song.", "matabani", [
      card("A performance has a matabani and one singer who laga the song. Which word names the group?", ["matabani", "laga"], "matabani", "Matabani is the band or orchestra; laga is beginning or leading the song.", ["laga"]),
      card("Matabani and mataqiriqiri both have musical-group glosses. Does that alone prove they are interchangeable in every community?", ["No", "Yes"], "No", "Their recorded English glosses overlap. A complete local phrase is needed before claiming the same use everywhere.", ["mataqiriqiri"])
    ]),
    qato: play("Which adornment is worn?", "Qato is a bracelet or similar band worn around an arm or ankle. Salusalu is a garland made with flowers or scented leaves.", "qato", [
      card("An ornament circles a wrist. Which of these words is the checked bracelet word?", ["qato", "salusalu"], "qato", "Qato is a bracelet or band; salusalu is a floral garland.", ["salusalu"]),
      card("Can a qato in this meaning be worn at an ankle rather than only at a wrist?", ["Yes", "No"], "Yes", "The recorded meaning includes a band worn on an arm or ankle.")
    ]),
    yavato: play("The grub in wood", "Yavato names a large tree grub. A comparative study places the Fijian word beside related Pacific forms for grubs found in timber; the label alone does not give an exact insect species.", "yavato", [
      card("Someone finds a yavato inside wood. Are they looking at a grub or a marine fish?", ["A grub", "A marine fish"], "A grub", "Yavato is a tree grub. Qio, by contrast, is a shark.", ["qio"]),
      card("Related Pacific words also name wood grubs. Does that prove each community is naming exactly the same insect species?", ["No", "Yes"], "No", "Related words can share a broad meaning while local identifications still need checking.")
    ], { label: "Read the comparative study of Pacific grub names", href: "https://openresearch-repository.anu.edu.au/server/api/core/bitstreams/1635b209-8ef7-4a64-97ea-655571840be6/content" }),
    kalou: play("Context changes the reading", "Kalou can refer to a spirit or deity. In Christian Fijian it can mean God; a complete phrase and setting help show which reading is intended.", "kalou", [
      card("A traditional account refers to several kalou. Which reading is being used here?", ["Spirits or deities", "A word for a boat"], "Spirits or deities", "One checked sense of kalou covers spirits or deities."),
      card("In a Christian Fijian prayer, can kalou be read as 'God'?", ["Yes", "No"], "Yes", "That is a separate checked use. The same spelling does not erase the older spirit or deity reading.")
    ]),
    bala: play("A turtle, but which one?", "Bala names a male turtle. The checked word does not, on its own, settle the turtle's species.", "bala", [
      card("A turtle is called bala. What does this word specify?", ["It is male", "It is a shark"], "It is male", "Bala specifies a male turtle; qio names a shark.", ["qio"]),
      card("Can bala alone confirm that a turtle belongs to one particular scientific species?", ["No", "Yes"], "No", "The recorded meaning identifies the sex, not a precise species. A species claim needs separate identification.")
    ]),
    bakewa: play("A suckerfish beside a larger animal", "Bakewa is a remora or suckerfish that attaches to larger sea animals. FishBase records the Fiji name for Echeneis naucrates; a host fish is not itself a bakewa.", "bakewa", [
      card("A bakewa rides attached to a qio. Which animal is the suckerfish?", ["bakewa", "qio"], "bakewa", "Bakewa names the remora; qio names the shark it may attach to.", ["qio"]),
      card("FishBase matches one recorded bakewa name to Echeneis naucrates. Does that one match prove every local use has been identified to species?", ["No", "Yes"], "No", "A species identification is useful evidence, but local names and identifications still need to be checked in context.")
    ], { label: "See the Fiji bakewa record in FishBase", href: "https://www.fishbase.se/country/CountryComNamesSearchList.php?Country=242&showAll=yes" }),
    ceguoca: play("What happens to the breath?", "Ceguoca is to pant or breathe with difficulty. Oca names tiredness; the breathing sign and its possible cause are not identical.", "ceguoca", [
      card("After hard exercise, someone is ceguoca. Which sign is directly named?", ["Panting", "Being asleep"], "Panting", "Ceguoca names difficult or rapid breathing in this context; oca names tiredness.", ["oca"]),
      card("If someone is ceguoca, does the word alone prove that oca is the cause?", ["No", "Yes"], "No", "Panting may have several causes. The word reports the breathing difficulty, not a diagnosis.", ["oca"])
    ]),
    rube: play("Hanging up, not falling down", "Rube means to hang up or suspend something. Ceba can describe a thin object fluttering downward; isulu names clothing that might be hung.", "rube", [
      card("A garment is hung up to dry. Which word names the garment itself?", ["isulu", "rube"], "isulu", "Isulu is clothing; rube is the hanging or suspending action.", ["isulu"]),
      card("A leaf flutters toward the ground. Is that the same motion as keeping it suspended overhead?", ["No", "Yes"], "No", "Ceba points to fluttering down; rube concerns suspending something.", ["ceba"])
    ]),
    rairai: play("An appearance can leave room for doubt", "Rairai can mean to seem or appear. Basika more specifically points to something coming out or emerging.", "rairai", [
      card("An object physically comes out from hiding. Which word points more clearly to that emergence?", ["basika", "rairai"], "basika", "Basika names appearing or emerging; rairai can also be an impression that something seems a certain way.", ["basika"]),
      card("A proposal seems promising. Does that appearance alone prove it will work?", ["No", "Yes"], "No", "Rairai can report how a thing seems. Its eventual result still needs to be seen.")
    ]),
    basika: play("From hidden to visible", "Basika means to appear or emerge. Yali can mean missing or gone; rairai can be an appearance or impression without an emergence.", "basika", [
      card("A lost object appears again. Which earlier state does that reverse?", ["yali", "maravu"], "yali", "Yali can mean missing; basika means appearing or emerging.", ["yali"]),
      card("A plan merely seems promising. Has anything necessarily emerged from hiding?", ["No", "Yes"], "No", "Rairai can describe an impression. Basika can describe something coming into view.", ["rairai"])
    ]),
    cavacava: play("The end of an account or a place", "Cavacava can name a conclusion, an ending, or a boundary. The thing being discussed tells the reader which sort of end is meant.", "cavacava", [
      card("A story reaches its cavacava. Which reading fits?", ["Its conclusion", "A sea current"], "Its conclusion", "Cavacava can mean the ending or conclusion of an account."),
      card("A surveyor marks the cavacava of a plot. Is that more likely a boundary or the final page of a story?", ["A boundary", "The final page"], "A boundary", "The checked meaning also allows an outer edge or boundary.")
    ]),
    waqaca: play("Lighting and what follows", "Waqaca means to light a fire or lamp. Buka can be fire or firewood; kuvu can be the smoke that rises afterward.", "waqaca", [
      card("Someone lights a lamp. Which word names the action of lighting it?", ["waqaca", "buka"], "waqaca", "Waqaca is the lighting action; buka can name fire or firewood.", ["buka"]),
      card("Smoke begins to rise after the fire is lit. Which word can name that drifting smoke?", ["kuvu", "waqaca"], "kuvu", "Kuvu can be smoke; waqaca is lighting the fire or lamp.", ["kuvu"])
    ]),
    ceba: play("A thin thing comes down", "Ceba means to flutter down, as a leaf or another thin flat thing can. Cagi is wind; rube is to hang or suspend something.", "ceba", [
      card("A leaf moves downward in the air. Which word captures that fluttering?", ["ceba", "rube"], "ceba", "Ceba is fluttering down; rube is hanging or suspending.", ["rube"]),
      card("The cagi changes a leaf's path while it ceba. Does ceba itself name the wind?", ["No", "Yes"], "No", "Cagi names wind. Ceba names the leaf's fluttering descent.", ["cagi"])
    ]),
    daru: play("Just you and me", "In this subject use, daru is the short form of kedaru: 'we two', including the listener. Keirau is also two people, but excludes the listener.", "daru", [
      card("A speaker addresses you and means only the two of you. Which form fits the inclusive pair?", ["daru", "keirau"], "daru", "Daru includes the listener. Keirau is a two-person 'we' that leaves the listener out.", ["keirau"]),
      card("Which full pronoun does subject-form daru shorten here?", ["kedaru", "kedatou"], "kedaru", "Kedaru is the corresponding full two-person inclusive pronoun; kedatou covers a small larger group.", ["kedaru", "kedatou"])
    ]),
    datou: play("A small group including you", "In this subject use, datou is short for kedatou: 'we few' including the listener. Daru keeps the group to exactly two people.", "datou", [
      card("A speaker includes you and a few others. Which short form fits this group rather than the pair daru?", ["datou", "daru"], "datou", "Datou is the small inclusive group; daru is just two people including you.", ["daru"]),
      card("Which full pronoun corresponds to datou in this use?", ["kedatou", "keirau"], "kedatou", "Kedatou is the full inclusive few-person form; keirau excludes the listener and refers to two.", ["kedatou", "keirau"])
    ]),
    tou: play("A shorter form needs its setting", "In one subject use, tou is a still shorter form associated with kedatou, meaning 'we few' including the listener. Tou also occurs elsewhere, so a full phrase is needed.", "tou", [
      card("In the inclusive few-person subject use, which full form helps explain tou?", ["kedatou", "kedaru"], "kedatou", "Tou can shorten the kedatou group in this use; kedaru refers to two people.", ["kedatou", "kedaru"]),
      card("If you see tou by itself, may you always translate it 'we few including you' without context?", ["No", "Yes"], "No", "Tou has other uses. Check who is speaking, who is included and the complete phrase before choosing this reading.", ["datou"])
    ]),
    da: play("A larger 'we' that includes you", "In this subject use, da is short for keda, 'we many' including the listener. Keimami is 'we many' with the listener excluded.", "da", [
      card("A speaker addresses you as part of a large group. Which short form includes you?", ["da", "keimami"], "da", "Da includes the listener in this use; keimami excludes the listener.", ["keimami"]),
      card("Which full pronoun corresponds to this subject-form da?", ["keda", "kedaru"], "keda", "Keda is the full inclusive many-person form. Kedaru is the inclusive two-person form.", ["keda", "kedaru"])
    ]),
    vakanomodi: play("The manner is silent", "Vakanomodi means silently or in silence. It tells how an action happens; the action itself must be supplied by context.", "vakanomodi", [
      card("Someone reads a book without speaking aloud. Which word adds the quiet manner?", ["vakanomodi", "ivola"], "vakanomodi", "Ivola is the book or written record; vakanomodi says the activity happens silently.", ["ivola"]),
      card("A singer leads a song aloud. Could we describe that same audible singing as vakanomodi without changing the scene?", ["No", "Yes"], "No", "Laga concerns beginning or leading a song; vakanomodi means silently. The description would need a different context.", ["laga"])
    ]),
    cauna: play("What remains after the meal", "Cauna is a remainder or leftover portion, especially food. Kakana names food more generally; maca can describe a supply that has run out.", "cauna", [
      card("After a meal, some kakana is left. Which word focuses on the leftover portion?", ["cauna", "magiti"], "cauna", "Cauna is what remains; magiti is food for a feast or presentation.", ["kakana", "magiti"]),
      card("A pot has nothing left because its supply has run out. Can the empty pot's contents be called cauna?", ["No", "Yes"], "No", "Cauna requires something to remain; maca can describe a supply that has been used up.", ["maca"])
    ]),
    batikadi: play("Waiting with a different intention", "Batikadi is a historical word for lying in wait to attack. Waraka is the broader act of waiting; the intended attack changes the scene.", "batikadi", [
      card("Someone is waiting for a friend to arrive. Does that alone make their action batikadi?", ["No", "Yes"], "No", "Waraka can be ordinary waiting. Batikadi carries the hostile ambush sense recorded in the older dictionary.", ["waraka"]),
      card("The historical entry also uses batikadi for a person who ambushes. Is that a separate use from the action of lying in wait?", ["Yes", "No"], "Yes", "The same recorded form has both an action sense and a person sense; the phrase must tell you which one is meant.")
    ]),
    beta: play("Bloom is one stage, not the harvest", "Beta describes a tree in full bloom. Burebu names fruit that falls before ripening; botatoka names a ripe nut still on the tree.", "beta", [
      card("A tree is beta. Has that word alone told you that its fruit is ripe?", ["No", "Yes"], "No", "Full bloom concerns the flowers, not the later ripeness of a fruit or nut.", ["botatoka"]),
      card("Fruit drops before maturity. Which word names that event rather than the tree's full bloom?", ["burebu", "beta"], "burebu", "Burebu is the premature fruit fall; beta describes a tree flowering fully.", ["burebu"])
    ]),
    bibivoro: play("A bruise is not every kind of break", "Bibivoro describes something crushed or bruised. Dabuiloa focuses on a dark bruise; cabola can describe something broken open.", "bibivoro", [
      card("Fruit is crushed and bruised but has not cracked open. Which word still fits?", ["bibivoro", "cabola"], "bibivoro", "Bibivoro covers crushing or bruising; cabola concerns a break or crack.", ["cabola"]),
      card("A bruise has left a dark mark on skin or fruit. Which related word names that visible mark more specifically?", ["dabuiloa", "bibivoro"], "dabuiloa", "Dabuiloa is the checked dark-bruise word; bibivoro can describe the crushing or bruising more broadly.", ["dabuiloa"])
    ]),
    biri: play("Swelling is one visible sign", "Biri is recorded for swelling, particularly a thigh. Mavoa describes injury; bubuta can describe sunburn or blistering.", "biri", [
      card("A person's thigh is swollen. Which checked word names the swelling itself?", ["biri", "mavoa"], "biri", "Biri is the swelling description in this older use; mavoa is injury or damage.", ["mavoa"]),
      card("Skin blisters after sun exposure. Does biri alone tell you that sunburn was the cause?", ["No", "Yes"], "No", "Bubuta can describe sunburn or blistering. Biri names swelling without settling its cause.", ["bubuta"])
    ]),
    bou: play("A post that holds the roof", "Bou names the tall house post supporting the ridgepole. Boto names an interior space of a traditional house, not that structural post.", "bou", [
      card("Which word identifies the support beneath a ridgepole?", ["bou", "boto"], "bou", "Bou is the tall supporting post; boto is a space inside the house.", ["boto"]),
      card("The ridgepole needs support. What work does the bou do in the house?", ["Carries the ridgepole", "Lines the food basket"], "Carries the ridgepole", "Bou names the tall post with that roof-supporting job; calovei are leaves used to line a food container.", ["calovei"])
    ]),
    bowai: play("Look at the object, then its name", "Bowai is a Fijian pole club. Museum examples show both a plain staff and decorated examples; the decoration alone does not define the word.", "bowai", [
      card("A long hardwood pole is catalogued as a Fijian club. Is bowai the club or a snare for animals?", ["The club", "A snare"], "The club", "Bowai names the pole club. Dai is a snare or trap.", ["dai"]),
      card("One museum bowai has a wrapped grip while another is decorated. Must every bowai have the same ornament?", ["No", "Yes"], "No", "Bowai identifies a club form; museum examples differ in their surface treatment.")
    ], { label: "See a Fijian bowai in the Smithsonian collection", href: "https://www.si.edu/object/war-club-bowai%3Anmnhanthropology_8384053" }),
    buawa: play("What is hard to see?", "Buawa describes short-sighted or indistinct vision. Wanonova is deliberately watching or staring at something; the two words do different work.", "buawa", [
      card("Someone watches a distant object closely but the view is still blurred. Which word names the difficulty of seeing clearly?", ["buawa", "wanonova"], "buawa", "Buawa concerns unclear vision; wanonova concerns close watching.", ["wanonova"]),
      card("A thing merely rairai different in poor light. Does that prove the observer is permanently buawa?", ["No", "Yes"], "No", "Rairai can report an appearance or impression. A blurred view in one scene is not enough to decide a person's lasting eyesight.", ["rairai"])
    ]),
    bui: play("A woman in a family relationship", "Bui can refer to an older woman or grandmother. The recorded phrase bui ni gone relates the woman to a child; yalewa is a broader word for a woman.", "bui", [
      card("Which word can carry a grandmother or older-woman sense rather than only naming a woman generally?", ["bui", "yalewa"], "bui", "Bui carries the older-woman or grandmother reading; yalewa names a woman more broadly.", ["yalewa"]),
      card("In the recorded phrase bui ni gone, does gone help identify whose family relationship is being discussed?", ["Yes", "No"], "Yes", "The phrase relates bui to a child. The relationship matters more than translating bui as a generic label for any woman.")
    ]),
    buroro: play("A plant comes back after damage", "Buroro is recorded for grass shooting up again after it has been burned or destroyed. Beta, by contrast, describes a tree in full bloom.", "buroro", [
      card("Grass shoots up again after fire. Which word brings that return of growth into view?", ["buroro", "beta"], "buroro", "Buroro concerns growth returning after damage; beta is full bloom of a tree.", ["beta"]),
      card("If a tree is beta, must it first have been burned?", ["No", "Yes"], "No", "Full bloom and regrowth after destruction are different stages. The extra history belongs to buroro here.", ["beta"])
    ]),
    cabola: play("The object breaks; the sound is another clue", "Cabola describes something broken or cracked. Cabolo can name a burst or loud report, while cadruti is especially recorded for a snapped rope.", "cabola", [
      card("A vessel is found cracked open, but no one heard it happen. Which word names its condition?", ["cabola", "cabolo"], "cabola", "Cabola concerns the broken condition; cabolo can describe an explosion or report.", ["cabolo"]),
      card("A rope snaps. Which older word singles out that kind of break more closely?", ["cadruti", "cabola"], "cadruti", "Cadruti is especially recorded for a broken rope; cabola is a broader broken condition.", ["cadruti"])
    ]),
    cabolo: play("A burst can be heard", "Cabolo has an event sense, to burst or make a loud report, and a separate sense for the explosion or report itself. Cabola names something broken.", "cabolo", [
      card("A sudden report is heard like a gunshot. Which recorded word names the loud event?", ["cabolo", "cabola"], "cabolo", "Cabolo can be the burst or loud report; cabola describes a break.", ["cabola"]),
      card("If an object is cabola, must somebody have heard a cabolo?", ["No", "Yes"], "No", "A broken object need not have made an audible explosion. The two spellings keep condition and sound apart.", ["cabola"])
    ]),
    cadruti: play("A break in a rope", "Cadruti is especially recorded for a rope that has broken or snapped. Cabola is the wider broken or cracked description.", "cadruti", [
      card("A rope parts in two. Which historical word points especially to that material?", ["cadruti", "cabola"], "cadruti", "Cadruti is chiefly recorded of a broken rope; cabola is less specific.", ["cabola"]),
      card("The rope is still hanging intact. Does the act of rube, hanging something, say that it has become cadruti?", ["No", "Yes"], "No", "Rube concerns suspending an object; cadruti requires a break or snap in the rope.", ["rube"])
    ]),
    draudrau: play("Leaves can serve as a surface", "Draudrau names leaves used for serving food or as a covering. Calovei more specifically names leaves placed as a lining inside a pot or basket.", "draudrau", [
      card("Food is presented on a layer of leaves. Which word names the serving leaves?", ["draudrau", "gatu"], "draudrau", "Draudrau are the serving leaves; gatu is barkcloth, not the food-serving leaf layer.", ["gatu"]),
      card("Leaves are placed inside a basket as a food lining. Which related word gives that more precise placement?", ["calovei", "draudrau"], "calovei", "Calovei names lining leaves; draudrau can cover serving or wrapping leaves more broadly.", ["calovei"])
    ]),
    dreke: play("The hollow holds different things", "Dreke is a cavity or hollow. A cup has an inside, and a ship has a hold; this entry records both uses of the same word.", "dreke", [
      card("A ship's cargo is placed in its dreke. Does dreke name the hold or the sail?", ["The hold", "The sail"], "The hold", "The recorded maritime use is the hold, the space where cargo is carried."),
      card("Does dreke refer only to ships, or can it also name the hollow of a cup or oven?", ["It can name other hollows", "Only ships"], "It can name other hollows", "The common feature is an inner cavity; a ship's hold is one application among others.")
    ], { label: "See a separately recorded ship phrase for dreke", href: "https://pollex.eva.mpg.de/source/9/?page=9" }),
    kibo: play("Out of sight in a hole", "Kibo is recorded for an animal withdrawing into its hole and disappearing from view. Basika points in the other direction: appearing or emerging.", "kibo", [
      card("An animal moves back into its hole. Which word records that disappearance?", ["kibo", "basika"], "kibo", "Kibo is the retreat into a hole; basika means to appear or emerge.", ["basika"]),
      card("An animal is yali from sight. Does yali alone tell you it entered a hole?", ["No", "Yes"], "No", "Yali means missing or gone. Kibo gives a more specific way an animal disappears.", ["yali"])
    ]),
    bona: play("A smell tells you something has spoiled", "Bona can describe a foul smell from decay or name that stench. Savasava means clean, but a clean appearance alone does not settle how something smells.", "bona", [
      card("Food gives off a rotten smell. Which word names that unpleasant quality?", ["bona", "savasava"], "bona", "Bona is the rotten-smell word; savasava means clean.", ["savasava"]),
      card("Could the same recorded form bona refer to the stench itself rather than only describing food?", ["Yes", "No"], "Yes", "The dictionary has a separate sense for the foul smell as a thing, beside the description of smelling rotten.")
    ]),
    botatoka: play("Ripe, but still on the tree", "Botatoka names a ripe nut that has not fallen. Burebu is the opposite timing for fruit: it drops before it is mature.", "botatoka", [
      card("A nut is mature and still attached to its tree. Which word fits this precise stage?", ["botatoka", "burebu"], "botatoka", "Botatoka is ripe but still attached; burebu is fruit falling before maturity.", ["burebu"]),
      card("A green coconut is called bu at its drinking stage. Does bu alone tell you it is a botatoka ripe nut?", ["No", "Yes"], "No", "Bu names a coconut at the drinking stage; botatoka makes a different claim about a ripe nut still on the tree.", ["bu"])
    ]),
    botonikete: play("Finding the part of the body", "Botonikete names the abdomen. Kete can name the stomach or belly; bilobilo is the kneecap, a different body part.", "botonikete", [
      card("A person points to the abdomen rather than the knee. Which checked form fits?", ["botonikete", "bilobilo"], "botonikete", "Botonikete is the abdomen; bilobilo is the kneecap.", ["bilobilo"]),
      card("Kete can mean the belly or stomach. Does that make botonikete a word for a kneecap?", ["No", "Yes"], "No", "The related belly meaning stays in the abdominal area; the knee has its own word.", ["kete", "bilobilo"])
    ]),
    bubuta: play("Sunburn and blisters are visible", "Bubuta can describe skin sunburned or blistered through illness. Biri names swelling, which does not alone say how the skin was affected.", "bubuta", [
      card("Skin is blistered after exposure to the sun. Which recorded description fits?", ["bubuta", "biri"], "bubuta", "Bubuta includes sunburn; biri is swelling.", ["biri"]),
      card("If someone is bubuta because of illness, must the cause have been sunshine?", ["No", "Yes"], "No", "The older entry also records blistering from disease. The scene tells you which cause is intended.")
    ]),
    buisokoloa: play("Ink from a sea creature", "Buisokoloa is the dark fluid released by a cuttlefish. Kuvu can name smoke, dust or spray drifting in air, which is a different material.", "buisokoloa", [
      card("Dark fluid comes from a cuttlefish. Is it buisokoloa or smoke called kuvu?", ["buisokoloa", "kuvu"], "buisokoloa", "Buisokoloa is the cuttlefish's dark fluid; kuvu covers smoke and other drifting material.", ["kuvu"]),
      card("Does the dark colour alone let you identify every black mark in the sea as buisokoloa?", ["No", "Yes"], "No", "The word identifies a material by its source, a cuttlefish, not by colour alone.")
    ]),
    bukebuke: play("A mound with a planting purpose", "Bukebuke is a soil mound, especially one prepared for yams. Bulubulu names placing yams into prepared mounds; uvi is the crop.", "bukebuke", [
      card("A grower prepares an earth mound for uvi. Which word names the mound itself?", ["bukebuke", "bulubulu"], "bukebuke", "Bukebuke is the mound; bulubulu is the planting action.", ["uvi", "bulubulu"]),
      card("An anthill also rises from the ground. Would its shape alone make it a bukebuke prepared for planting?", ["No", "Yes"], "No", "Buri is an anthill. Bukebuke is a soil mound, especially a planting mound made for yams.", ["buri"])
    ]),
    bulowa: play("One spelling, two recorded meanings", "Bulowa has a pumice-stone sense and a separate historical sense for swelling of the mouth. Neither meaning can be selected from the spelling alone.", "bulowa", [
      card("A light porous volcanic stone is being handled. Which bulowa meaning fits?", ["Pumice stone", "Mouth swelling"], "Pumice stone", "The stone is the material sense of bulowa; the mouth condition is a separate recorded sense."),
      card("A person has a swollen mouth. Should the stone meaning be inserted into that sentence?", ["No", "Yes"], "No", "The historical source records a different bulowa sense for the condition. A full phrase is needed to distinguish the readings.")
    ]),
    butoleka: play("Daylight briefly turns dark", "Butoleka names a solar eclipse. Bogi is ordinary night; buto names darkness more broadly, including when daylight is obscured.", "butoleka", [
      card("The sun is obscured during the day. Which word names the event rather than ordinary night?", ["butoleka", "bogi"], "butoleka", "Butoleka is the solar eclipse; bogi is night.", ["bogi", "siga"]),
      card("Does buto on its own necessarily tell you that a solar eclipse is happening?", ["No", "Yes"], "No", "Buto is darkness more generally. Butoleka names the specific eclipse event.", ["buto"])
    ]),
    buna: play("A reef beneath the surface", "Buna can name a submerged reef or deep water with the bottom still visible. Daveta is a passage through a reef where a boat can pass.", "buna", [
      card("A boat seeks a passage through the reef. Which word names that opening rather than a submerged reef?", ["daveta", "buna"], "daveta", "Daveta is the passage; buna can be the submerged reef.", ["daveta"]),
      card("The water is deep but its bottom can still be seen. Is that also included in the recorded buna meaning?", ["Yes", "No"], "Yes", "The older entry records both a sunken reef and deep water whose bottom remains visible.")
    ]),
    burebu: play("Fruit falls before its time", "Burebu is fruit that drops before it matures. Botatoka identifies a nut that is ripe and still attached to the tree.", "burebu", [
      card("A fruit falls while still immature. Which word names this early fall?", ["burebu", "botatoka"], "burebu", "Burebu is premature fruit fall; botatoka is a ripe nut not yet fallen.", ["botatoka"]),
      card("A tree is beta, in full bloom. Has its fruit necessarily become burebu?", ["No", "Yes"], "No", "Bloom does not mean fruit has already formed and fallen before ripening.", ["beta"])
    ]),
    balala: play("A spear remains lodged", "Balala describes being pierced by a spear that stays in place. Moto is the spear itself; mavoa is the wider idea of being injured.", "balala", [
      card("A moto has struck and remains lodged. Which word describes that particular result?", ["balala", "moto"], "balala", "Moto names the spear. Balala describes the condition after it has pierced and remained in place.", ["moto"]),
      card("Someone is mavoa after a fall, with no spear involved. Does mavoa alone establish balala?", ["No", "Yes"], "No", "Mavoa covers injury more broadly; balala specifies the lodged spear in this historical sense.", ["mavoa"])
    ]),
    bilobilo: play("Find the part, then the condition", "Bilobilo is the kneecap. Kete is the stomach or belly, while mavoa can describe an injury anywhere on the body.", "bilobilo", [
      card("Someone points to the hard cap at the front of a knee. Which word identifies that part?", ["bilobilo", "kete"], "bilobilo", "Bilobilo is the kneecap; kete points to the stomach or belly.", ["kete"]),
      card("A person says they are mavoa. Can you tell from that word alone whether their bilobilo is hurt?", ["No", "Yes"], "No", "Mavoa reports an injury. It does not locate that injury at the kneecap.", ["mavoa"])
    ]),
    "buku vere": play("A plan can be hidden", "Buku vere is to plan or conspire together, particularly against someone. Batikadi is the separate act of lying in wait for an attack; bolebole was a public challenge.", "buku vere", [
      card("People secretly make a hostile plan together but have not yet lain in wait. Which term names the planning?", ["buku vere", "batikadi"], "buku vere", "Buku vere concerns the conspiracy; batikadi is lying in wait to attack.", ["batikadi"]),
      card("A challenge is proclaimed openly before a chief. Is that the same hidden action as buku vere?", ["No", "Yes"], "No", "The recorded bolebole was public. Buku vere points to planning or conspiring together.", ["bolebole"])
    ]),
    buli: play("A shell, not every ceremonial valuable", "In this sense, buli is a white cowrie shell. The older dictionary also records white cowries used to ornament canoes; tabua is a whale tooth.", "buli", [
      card("A white cowrie is being named. Is it a buli or a tabua?", ["buli", "tabua"], "buli", "Buli is a cowrie shell in this sense. Tabua is a whale tooth used in formal exchange.", ["tabua"]),
      card("An older account describes cowries adorning a canoe. Does the shell's use as ornament turn it into barkcloth called masi?", ["No", "Yes"], "No", "The object remains a shell; masi names Fijian barkcloth.", ["masi"])
    ]),
    burotu: play("A spirit place and a figure of speech", "Burotu is a beautiful place of departed spirits in Fijian tradition. The older dictionary also uses it figuratively for a delightful place.", "burotu", [
      card("In a traditional account of departed spirits, is Burotu an ordinary name for any town?", ["No", "Yes"], "No", "The recorded tradition gives Burotu a spirit-world meaning. A town name would need its own evidence.", ["kalou"]),
      card("Someone calls a pleasant place Burotu figuratively. Must they be claiming they have literally entered the spirit world?", ["No", "Yes"], "No", "The historical entry records a figurative delightful-place use beside the traditional spirit-place sense.")
    ], { label: "See Borutu, a recorded spelling, in a Fiji museum collection", href: "https://maa.cam.ac.uk/fiji-viti" }),
    cadri: play("Hard to overcome", "Cadri was recorded especially for a difficult or resistant thing. Rerevaki names something feared or dangerous; difficulty and danger need not coincide.", "cadri", [
      card("A problem is stubbornly hard to overcome. Which older word points to that resistance?", ["cadri", "rerevaki"], "cadri", "Cadri was used of things difficult to overcome; rerevaki concerns danger or fear.", ["rerevaki"]),
      card("If a route is cadri to complete, must it also be rerevaki?", ["No", "Yes"], "No", "A demanding task need not be dangerous. The two descriptions ask different questions.", ["rerevaki"])
    ]),
    caqu: play("A gift at departure", "In the older usage, caqu is property presented to friends as they leave. Butu instead points to valuables presented at a solevu gathering.", "caqu", [
      card("Friends are departing and receive an item of property. Which historical word identifies that parting gift?", ["caqu", "butu"], "caqu", "Caqu is recorded for an item presented on departure; butu belongs to a solevu presentation.", ["butu"]),
      card("Does caqu by itself tell you exactly whether the item is cloth, food or another possession?", ["No", "Yes"], "No", "The word identifies the parting presentation, not a fixed material or object type.")
    ]),
    bolebole: play("A challenge spoken openly", "Bolebole was a public declaration of courage and loyalty before a chief ahead of war. Buku vere is planning together against someone, often hidden.", "bolebole", [
      card("A person proclaims courage publicly before a chief. Which word names that historical practice?", ["bolebole", "buku vere"], "bolebole", "Bolebole was the public challenge or declaration; buku vere is conspiracy or plotting.", ["buku vere"]),
      card("If a group quietly makes a plan but issues no public challenge, has it necessarily performed bolebole?", ["No", "Yes"], "No", "The public declaration is the important part of the recorded bolebole practice.", ["buku vere"])
    ]),
    bolomo: play("A step in preparing dalo", "Bolomo is the older word for soaking dalo when preparing pudding. Dalo names the taro crop; buta describes food cooked enough to eat.", "bolomo", [
      card("Dalo is being steeped for a pudding. Which word names the preparation action rather than the crop?", ["bolomo", "dalo"], "bolomo", "Bolomo is the steeping step; dalo is taro.", ["dalo"]),
      card("If dalo has only been soaked, does bolomo alone tell you the pudding is already buta, cooked enough to eat?", ["No", "Yes"], "No", "Soaking and reaching a cooked state are different stages. Buta supplies the cooked-enough meaning.", ["buta"])
    ]),
    boroa: play("Crowded reeds in a fence", "Boroa describes reeds packed close together in a fence. The older record warns against extending it freely to anything that happens to be crowded.", "boroa", [
      card("Reeds are fitted tightly side by side in a fence. Which recorded description fits?", ["boroa", "maravu"], "boroa", "Boroa was recorded for the crowded reeds; maravu describes calm or smooth conditions.", ["maravu"]),
      card("A street is full of people. May the fence-reed gloss alone prove boroa is the normal word for that crowd?", ["No", "Yes"], "No", "The older source marks a restricted use. A complete local phrase would be needed for a different setting.")
    ]),
    boto: play("Locate the space inside the house", "Boto names a particular interior space of a traditional house, between the lalaga and matadravu. Bou, by contrast, is a tall post supporting the ridgepole.", "boto", [
      card("A description points to an area inside the house rather than a load-bearing post. Which word fits?", ["boto", "bou"], "boto", "Boto is the interior space in this sense; bou is the post carrying the ridgepole.", ["bou"]),
      card("Does the word boto by itself identify the material used for that house's roof?", ["No", "Yes"], "No", "It locates a space in the layout. The roof material requires a different description.")
    ]),
    bubului: play("What is invoked in an oath?", "Bubului is recorded for an oath sworn in the name of a deceased person or a deity. Kalou names a spirit or deity, not the oath itself.", "bubului", [
      card("An oath invokes a kalou. Which word names the oath rather than the being invoked?", ["bubului", "kalou"], "bubului", "Bubului is the oath in this older usage; kalou can name the deity or spirit.", ["kalou"]),
      card("If the oath invokes a departed person, does the recorded bubului meaning require that person to be a deity?", ["No", "Yes"], "No", "The historical entry gives a deceased person and a deity as two possible referents.")
    ]),
    bulivovo: play("The fence has parts and a pattern", "Bulivovo are horizontal reeds at the top or bottom of a traditional house fence. Boroa describes reeds packed close together; bai can name the enclosing fence as a whole.", "bulivovo", [
      card("Which word points to the horizontal reeds, rather than the fence itself?", ["bulivovo", "bai"], "bulivovo", "Bulivovo names the particular fence reeds; bai can name the enclosing fence.", ["bai"]),
      card("The reeds are tightly crowded. Does that density tell you whether they are the horizontal top or bottom pieces?", ["No", "Yes"], "No", "Boroa concerns closeness; bulivovo identifies the reeds' position in the fence.", ["boroa"])
    ]),
    bulubulu: play("Planting action and prepared mound", "Bulubulu names placing yams into prepared earth mounds. Bukebuke is the mound; uvi is the cultivated yam.", "bulubulu", [
      card("A grower prepares a bukebuke but has not planted. Has the bulubulu action happened yet?", ["No", "Yes"], "No", "Bukebuke is the mound; bulubulu is putting the yam into it.", ["bukebuke"]),
      card("In this recorded gardening use, which crop is placed in the mound: uvi or dalo?", ["uvi", "dalo"], "uvi", "The older description specifically speaks of yams. Uvi is yam; dalo is taro.", ["uvi", "dalo"])
    ]),
    bunua: play("Many bats, one branch", "Bunua is a group of bats hanging together from a single branch. It names the cluster, not one bat singled out from it.", "bunua", [
      card("Several bats hang together from one branch. Does bunua identify the cluster or a single bat?", ["The cluster", "A single bat"], "The cluster", "The older entry describes a lot of bats hanging together on one branch."),
      card("Bats hang separately on branches far apart. Has the one-branch detail in the recorded bunua scene been met?", ["No", "Yes"], "No", "The recorded picture is a group sharing one branch. Other arrangements need their own contextual check.")
    ]),
    buri: play("A mound made by insects", "Buri is an anthill. Bukebuke is an earth mound especially prepared for planting yams; the similar shape does not give them the same use.", "buri", [
      card("A mound belongs to ants rather than to a yam garden. Which word names it?", ["buri", "bukebuke"], "buri", "Buri is an anthill; bukebuke is a planting mound.", ["bukebuke"]),
      card("If a grower places uvi into a prepared mound, have the ants necessarily made that mound?", ["No", "Yes"], "No", "Uvi is yam. A prepared yam mound is bukebuke; buri is an anthill.", ["uvi", "bukebuke"])
    ]),
    butabutako: play("The person and the act", "Butabutako is an older form for a thief. The historical source relates it to butako, to steal; buku vere is plotting, which by itself does not establish a theft.", "butabutako", [
      card("An account identifies someone as a thief. Does butabutako name the person or a place?", ["The person", "A place"], "The person", "The recorded sense is a thief, not a location."),
      card("People secretly plan something against another person. Does buku vere alone establish that anyone has stolen property?", ["No", "Yes"], "No", "Buku vere concerns a conspiracy; butabutako identifies a thief. The action still needs evidence.", ["buku vere"])
    ]),
    butayari: play("A nut before it fills out", "Butayari is a nut with only a little flesh developed inside. Botatoka is a ripe nut still attached to a tree; those are different observations.", "butayari", [
      card("A nut is opened and has very little flesh inside. Which word describes that condition?", ["butayari", "botatoka"], "butayari", "Butayari concerns how little flesh has developed; botatoka concerns a ripe nut still on the tree.", ["botatoka"]),
      card("A nut has not fallen. Does that fact by itself tell you whether its flesh is well developed?", ["No", "Yes"], "No", "Remaining attached and developing flesh are separate details. The first matters for botatoka; the second for butayari.", ["botatoka"])
    ]),
    butu: play("What is presented at a solevu?", "Butu is property or valuables presented at a solevu gathering. The particular item varies; tabua is one kind of ceremonial valuable and magiti names feast food.", "butu", [
      card("At a solevu, valuables are presented. Which word names the presented property in this older use?", ["butu", "magiti"], "butu", "Butu identifies the presented property; magiti names food for a feast or formal presentation.", ["magiti"]),
      card("Does the word butu alone tell you that every presented object is a tabua?", ["No", "Yes"], "No", "Tabua is a whale tooth. A museum account records different kinds of valuables at solevu, so the broader presentation does not fix one material.", ["tabua"])
    ], { label: "See objects presented at solevu", href: "https://maa.cam.ac.uk/fiji-solevu" }),
    cabecabe: play("Up the slope, then the summit", "Cabecabe can mean a steep hillside or path upward. Delana is the hilltop reached after a climb.", "cabecabe", [
      card("A walker is still climbing the steep cabecabe. Have they necessarily reached the delana?", ["No", "Yes"], "No", "Cabecabe can be the slope or uphill path; delana is the top.", ["delana"]),
      card("One recorded cabecabe sense describes the terrain as hilly. Must that description identify one exact path?", ["No", "Yes"], "No", "The checked entry also has a hilly-terrain sense; a particular path needs more context.")
    ]),
    calovei: play("Leaves line the food container", "Calovei are leaves placed inside a pot or basket as a food lining. Draudrau can name leaves used under food for serving or as a cover.", "calovei", [
      card("Leaves are fitted inside a basket before food is placed there. Which word highlights that lining?", ["calovei", "draudrau"], "calovei", "Calovei specifically names leaves lining a food container; draudrau has a wider serving or covering use.", ["draudrau"]),
      card("Food is set directly on serving leaves, without a pot or basket. Does that scene establish the container-lining use of calovei?", ["No", "Yes"], "No", "The broader draudrau sense covers serving leaves. Calovei in this entry is tied to lining a container.", ["draudrau"])
    ]),
    wanonova: play("Watching closely is an action", "Wanonova is to stare or watch closely. Buawa concerns indistinct vision; rairai can mean to seem or appear, without deliberate watching.", "wanonova", [
      card("A person deliberately keeps their eyes on something. Which word names that act?", ["wanonova", "buawa"], "wanonova", "Wanonova is close watching; buawa is difficulty seeing distinctly.", ["buawa"]),
      card("A plan rairai promising. Does that impression prove someone was physically staring at it?", ["No", "Yes"], "No", "Rairai can express how something seems. Wanonova is a deliberate act of watching.", ["rairai"])
    ]),
    dabuiloa: play("A bruise you can see", "Dabuiloa is a dark bruise on skin or fruit. Bibivoro can describe crushing or bruising more broadly; mavoa is a broader injury word.", "dabuiloa", [
      card("A piece of fruit has a dark bruise. Which word identifies the visible mark?", ["dabuiloa", "mavoa"], "dabuiloa", "Dabuiloa is recorded for a dark bruise on skin or fruit; mavoa is injury or damage more generally.", ["mavoa"]),
      card("Something is bibivoro after pressure. Must it always show a dark dabuiloa mark?", ["No", "Yes"], "No", "Bibivoro can be crushed or bruised. Dabuiloa supplies the dark-mark detail.", ["bibivoro"])
    ]),
    qio: play("Which sea animal is it?", "Qio is a shark. Fiji fish-name records include more specific shark names, so qio alone does not settle the species; bakewa is a remora that may attach to a shark.", "qio", [
      card("A bakewa rides attached to a qio. Which of the two is the shark?", ["qio", "bakewa"], "qio", "Qio is the shark; bakewa is the smaller remora.", ["bakewa"]),
      card("FishBase records a name such as qio saga for a particular shark. Does qio by itself identify that one species?", ["No", "Yes"], "No", "Qio is the broader shark name. The added name and a checked identification narrow it further.")
    ], { label: "See recorded Fiji shark names", href: "https://www.fishbase.se/country/CountryComNamesSearchList.php?Country=242&showAll=yes" }),
    dai: play("A trap is not a net", "Dai is a snare or trap for catching an animal. Lawa can be a fishing net; bowai is a pole club, a different kind of implement.", "dai", [
      card("An animal is caught in a snare. Which word names the catching device?", ["dai", "lawa"], "dai", "Dai is the snare or trap; lawa can be a net, especially for fishing.", ["lawa"]),
      card("A museum labels a hardwood object bowai. Does that make it a dai snare?", ["No", "Yes"], "No", "Bowai is a club. Dai is a device set to catch an animal.", ["bowai"])
    ], { label: "Read a linguistic study of the Fijian snare word", href: "https://openresearch-repository.anu.edu.au/bitstreams/913635d1-fbab-4684-b345-1f20033a2f56/download" }),
    vakavuqa: play("How often, not how strongly", "Vakavuqa means frequently. Vakalevu can concern degree or intensity; a single strong event is not thereby frequent.", "vakavuqa", [
      card("An action happens again and again. Which word answers 'how often'?", ["vakavuqa", "vakalevu"], "vakavuqa", "Vakavuqa concerns frequency; vakalevu concerns an increase or intensification in the relevant construction.", ["vakalevu"]),
      card("An event happens once but very strongly. Does its strength alone make it vakavuqa?", ["No", "Yes"], "No", "Frequency needs repeated occurrence. Intensity is a different question.", ["vakalevu"])
    ]),
    cakulea: play("Searching by moving things aside", "Cakulea is a search that involves moving things aside. Wanonova is close watching; merely looking is not yet the same action.", "cakulea", [
      card("Someone shifts items out of the way while searching. Which word fits that action?", ["cakulea", "wanonova"], "cakulea", "Cakulea is the searching action with things moved aside; wanonova is watching closely.", ["wanonova"]),
      card("A lost object basika, appears, while no one is searching. Has that appearance alone established cakulea?", ["No", "Yes"], "No", "Basika concerns appearing; cakulea describes a particular way of searching.", ["basika"])
    ]),
    caca: play("The amount beyond full tens", "In this counting sense, caca is the remainder beyond a multiple of ten. Cauna can mean a portion left over, especially food; its setting is different.", "caca", [
      card("Twenty-three items are grouped into tens. How many are left beyond the two full tens?", ["Three", "Thirteen"], "Three", "The three extra items are the remainder that caca identifies in this counting use."),
      card("A meal leaves a portion of kakana in the pot. Does the counting sense of caca automatically name that leftover food?", ["No", "Yes"], "No", "Cauna focuses on a remaining food portion; caca here concerns the amount beyond full tens.", ["cauna", "kakana"])
    ]),
    dawa: play("A fruit with a season and a tree", "Dawa names the edible fruit of the dawa tree, identified in a botanical reference as Pometia pinnata. Fiji's seasonal account lists dawa among fruits available during Vula i Nuqalevu.", "dawa", [
      card("A seasonal list mentions dawa alongside other fruits. Is it naming an edible fruit or a reef fish?", ["An edible fruit", "A reef fish"], "An edible fruit", "Dawa is the fruit of a tree, not a fish."),
      card("Fruit falls before it is ripe. Does the fruit's name dawa itself describe that early fall?", ["No", "Yes"], "No", "Dawa names the fruit; burebu is the separate word for fruit falling before maturity.", ["burebu"])
    ], { label: "See a Fiji seasonal account mentioning dawa", href: "https://itaukeitrustfund.com.fj/vula-i-nuqalevu/" }),
    ikuri: play("A piece attached to a word", "Ikuri is an addition attached to a yavu. Vei- can go before a base; a dewa ending follows certain predicate bases. The whole word and phrase decide the meaning.", "ikuri", [
      card("Which checked piece can be attached before a base: vei- or a dewa ending?", ["vei-", "A dewa ending"], "vei-", "Vei- is a prefix, an ikuriliu. A dewa follows a base in the constructions recorded for it.", ["vei-", "dewa"]),
      card("If you see a familiar attached piece, can you translate the whole new form without checking its use?", ["No", "Yes"], "No", "An ikuri is a clue to structure; the meaning and Tuvavosa role still need a complete attested phrase.", ["yavu"])
    ]),
    dravukasi: play("A colour with a dirty cast", "Dravukasi describes a dirty grey colour. Savasava describes cleanliness; a colour word and a cleanliness judgement answer different questions.", "dravukasi", [
      card("A surface is described as dirty grey. Which word gives that colour?", ["dravukasi", "savasava"], "dravukasi", "Dravukasi is the dirty-grey description; savasava means clean.", ["savasava"]),
      card("An object is washed until savasava. Must its original grey colour have disappeared?", ["No", "Yes"], "No", "Cleaning changes the dirt, but the material may still be grey. Dravukasi carries a dirty cast rather than naming every clean grey object.", ["savasava"])
    ]),
    momona: play("Flesh, size and the wrong body part", "In this sense momona can describe shellfish rich in flesh. For large round eyes, the owner instead uses ka levu and mokimokiti; the same English word 'big' does not settle the Fijian choice.", "momona", [
      card("A shellfish has plenty of flesh inside. Which word fits this recorded sense?", ["momona", "maca"], "momona", "Momona can describe that fleshy fullness; maca can mean empty or used up.", ["maca"]),
      card("Someone wants to describe eyes as large and round. Should momona be chosen merely because English says 'big'?", ["No", "Yes"], "No", "The owner's phrasing uses ka levu and mokimokiti for the eyes. Momona here is about fullness of flesh, not simply size.")
    ]),
    donu: play("A grouper in a reef setting", "Donu can name coral trout or related groupers. Fiji's census fish list places it with groupers, while saqa is a trevally name.", "donu", [
      card("A fish is listed with coral trout and groupers. Which name fits that group: donu or saqa?", ["donu", "saqa"], "donu", "Donu belongs with coral trout and groupers; saqa belongs with trevallies.", ["saqa"]),
      card("Kavu is recorded as a giant grouper. Does the word donu alone prove the fish is that exact giant grouper?", ["No", "Yes"], "No", "These names can share a broader grouper setting without identifying the same particular fish.", ["kavu"])
    ], { label: "See Fiji's official fish-name list", href: "https://www.fao.org/fileadmin/templates/ess/ess_test_folder/World_Census_Agriculture/WCA_2020/WCA_2020_new_doc/FJI_QUE_ENG_2020.pdf" }),
    saqa: play("Which kind of reef fish?", "Saqa is used for trevallies, including the giant trevally in Fiji fish lists. Donu names a coral trout or grouper, another fish group.", "saqa", [
      card("A fish is identified as a trevally. Which of these names matches that group?", ["saqa", "donu"], "saqa", "Saqa belongs to the trevally group; donu to coral trout or groupers.", ["donu"]),
      card("The official list also records saqaleka for giant trevally. Does saqa alone force every fish so called to be that one species?", ["No", "Yes"], "No", "The wider name and a more specific listed form should not be flattened into one exact species without a local identification.")
    ]),
    nuqa: play("A fish name in a seasonal calendar", "Nuqa is a rabbitfish. An iTaukei seasonal account says rabbitfish are abundant during Vula i Nuqalevu; the season helps remember the fish without turning the name into a month name.", "nuqa", [
      card("The seasonal account mentions many nuqa. Which fish group does it mean?", ["Rabbitfish", "Trevally"], "Rabbitfish", "Nuqa is the rabbitfish name; saqa belongs with trevallies.", ["saqa"]),
      card("Does the name Vula i Nuqalevu make nuqa itself a word for the whole month?", ["No", "Yes"], "No", "Nuqa names the fish. The month name is a longer seasonal expression that includes it.")
    ], { label: "Read the Fiji seasonal account of nuqa", href: "https://itaukeitrustfund.com.fj/vula-i-nuqalevu/" }),
    ceruma: play("A small drink, not just any drink", "Ceruma is used for sipping liquid. Gunu names drinking more generally, without telling you whether the drink is taken in little sips.", "ceruma", [
      card("A person takes a little liquid at a time from a bowl. Which word tells you the manner of drinking?", ["ceruma", "gunu"], "ceruma", "Ceruma adds the sipping manner; gunu only says that someone drinks.", ["gunu"]),
      card("If someone gulps down the whole drink, does the English word 'drink' alone justify ceruma?", ["No", "Yes"], "No", "Ceruma is the more particular sipping action. The broader translation 'drink' loses that difference.", ["gunu"])
    ]),
    caucau: play("A breeze with a direction", "Caucau is a land breeze. It is a kind of cagi, but its direction matters: the air moves from land toward the water, commonly at night.", "caucau", [
      card("At the coast at night, a breeze moves out from land toward the sea. Which name is more specific?", ["caucau", "cagi"], "caucau", "Caucau names the land breeze; cagi can name wind without specifying this coastal movement.", ["cagi"]),
      card("A daytime sea breeze moves from water toward land. Is that also a land breeze merely because both are winds?", ["No", "Yes"], "No", "The direction reverses. A land breeze blows seaward; a sea breeze blows shoreward.", ["cagi"])
    ], { label: "See the land-breeze explanation", href: "https://forecast.weather.gov/glossary.php?word=breeze" }),
    cavika: play("The empty-handed return", "Cavika is about a fishing trip that ends with no catch. It names the outcome, not just the trip out to fish.", "cavika", [
      card("Someone goes fishing and returns without fish. What does cavika pick out?", ["The empty-handed return", "The weather"], "The empty-handed return", "Cavika applies when the fishing trip ends without a catch."),
      card("If a person is still heading out with a line, has cavika already been established?", ["No", "Yes"], "No", "You need the result: a return with nothing caught. The journey alone does not tell you that.", ["lako"])
    ], { label: "Read cavika in a Fijian account", href: "https://www.fijitimes.com.fj/oqo-na-noqu-vosa/" }),
    leva: play("When a question hits a nerve", "Leva can mean taking offence when a matter one does not want addressed is raised. It is a response to the issue, not simply any disagreement.", "Leva", [
      card("A person takes offence because a sensitive matter was raised. Which word fits the response?", ["leva", "daumaka"], "leva", "Leva is the offended or resentful response; daumaka gives a favourable judgement.", ["daumaka"]),
      card("In the recorded sentence 'Au sega ni cudru se leva e na vuku ni lomatarotaro', does the speaker say they are offended by the questioning?", ["No", "Yes"], "No", "Sega ni negates the response: the speaker denies being angry or offended by the questioning.")
    ]),
    "baba siga": play("A place and its nickname", "Baba Siga is a nickname associated with Macuata in northern Fiji. It evokes sunny, dry slopes; it is not the name of a separate province.", "Baba Siga", [
      card("Someone calls Macuata Baba Siga. Are they naming a second province or using a regional nickname?", ["A regional nickname", "A second province"], "A regional nickname", "The nickname points back to Macuata and its landscape."),
      card("If a visitor hears Baba Siga, what landscape clue does the name carry?", ["Sunlit, dry slopes", "A wet reef flat"], "Sunlit, dry slopes", "Baba Siga evokes the sunnier, drier side of Macuata; siga contributes the sun or daylight idea.", ["siga"])
    ], { label: "Read a local account of Baba Siga", href: "https://babasiga.blogspot.com/2008/03/" }),
    balagi: play("Surgeonfish is a group, not one name", "A Fiji fish list records balagi with surgeonfish, while ta is used for a bluespine unicornfish. Both are reef fish, but the names are not interchangeable.", "balagi", [
      card("The fish is listed as a yellowfin surgeonfish. Which Fijian name is attached to it?", ["balagi", "ta"], "balagi", "The Fiji list gives balagi with yellowfin surgeonfish; ta is listed for a bluespine unicornfish.", ["ta"]),
      card("Does hearing 'reef fish' tell you whether the fish is balagi or corocoro?", ["No", "Yes"], "No", "Balagi belongs with surgeonfishes; corocoro is a soldierfish. The reef setting alone cannot settle the identification.", ["corocoro"])
    ], { label: "See Fiji's fish-name list", href: "https://www.fao.org/fileadmin/templates/ess/ess_test_folder/World_Census_Agriculture/WCA_2020/WCA_2020_new_doc/FJI_QUE_ENG_2020.pdf" }),
    corocoro: play("A soldierfish with another local name", "Fiji's fish list pairs corocoro with matalevu for blotcheye soldierfish. A similar reef setting does not make it a surgeonfish such as balagi.", "corocoro", [
      card("A Fiji fish list prints 'Corocoro, Matalevu' beside one English fish name. Which fish is it?", ["Blotcheye soldierfish", "Yellowfin surgeonfish"], "Blotcheye soldierfish", "These two Fijian names are recorded together for blotcheye soldierfish; balagi is the surgeonfish name in that list.", ["balagi"]),
      card("Would a catch from the reef alone prove it is corocoro rather than balagi?", ["No", "Yes"], "No", "Both may be reef fish. The type of fish, not simply where it was caught, distinguishes the names.", ["balagi"])
    ], { label: "Compare the named reef fishes", href: "https://www.fao.org/fileadmin/templates/ess/ess_test_folder/World_Census_Agriculture/WCA_2020/WCA_2020_new_doc/FJI_QUE_ENG_2020.pdf" }),
    delabulewa: play("A grouper with a particular identity", "Delabulewa names the brown-marbled grouper in Fiji Fisheries material. Donu is used for coral groupers, so the broader reef-fish setting does not merge their identities.", "delabulewa", [
      card("A fish guide labels the brown-marbled grouper. Which name should you look for?", ["delabulewa", "kawago"], "delabulewa", "Delabulewa names this grouper; kawago is an emperor fish.", ["kawago"]),
      card("The guide also groups donu with coral trout. Are delabulewa and donu automatically the same species?", ["No", "Yes"], "No", "Their names point to different fish within a wider grouper setting. The brown-marbled identification is particular to delabulewa.", ["donu"])
    ], { label: "See the Fiji Fisheries fish guide", href: "https://fiji.wcs.org/Portals/82/WCS%20Fisheries%20Profile%20290920%20WEB%20%281%29.pdf?ver=2020-10-14-024200-580" }),
    "doko ni vudi": play("Look at the snout", "Doko ni vudi is recorded for a long-faced or long-nosed emperor. The pointed, elongated snout helps separate this fish from other emperors such as kawago.", "doko ni vudi", [
      card("Which fish name accompanies a long, pointed snout in the Fiji fish guide?", ["doko ni vudi", "kawago"], "doko ni vudi", "Doko ni vudi is the long-nosed emperor; kawago is the spangled emperor.", ["kawago"]),
      card("Both names belong with emperors. Does that make the two names one fish?", ["No", "Yes"], "No", "They share a fish family, but the guide identifies different emperors. The longer snout is a useful clue here.", ["kawago"])
    ], { label: "See Fiji emperor names and habitats", href: "https://www.aciar.gov.au/sites/default/files/legacy/node/2217/mn35_pdf_78957.pdf" }),
    kabatia: play("One emperor name, several identifications", "Kabatia is an emperor-fish name. Fiji guides associate it with small sea bream and identify particular kabatia in more than one way, so the name needs a place and a fish to pin it down.", "kabatia", [
      card("In a fish-size table, kabatia is paired with kake under small sea bream. Does that turn kake into the same fish in every list?", ["No", "Yes"], "No", "One table groups them for a purpose; other fish lists distinguish kake among snappers. Check the local identification.", ["kake"]),
      card("A guide names a thumbprint emperor as kabatia, while another local survey records more than one emperor under that name. What should a learner avoid?", ["Assuming one name always proves one species", "Checking a photograph"], "Assuming one name always proves one species", "Local fish names may cover different identified fish. A photograph, place and knowledgeable speaker help resolve the reference.", ["kawago"])
    ], { label: "Compare Fiji emperor identifications", href: "https://fiji.wcs.org/Portals/82/WCS%20Fisheries%20Profile%20290920%20WEB%20%281%29.pdf?ver=2020-10-14-024200-580" }),
    kacika: play("The yellow-lipped emperor", "Kacika is used for a yellowlip emperor in a Fiji fish profile. Kawago is another emperor, the spangled emperor; shared family does not erase the different names.", "kacika", [
      card("A fish description calls out yellowish lips. Which Fiji name is linked to that emperor?", ["kacika", "kawago"], "kacika", "Kacika is the yellowlip emperor identification in that account; kawago names the spangled emperor.", ["kawago"]),
      card("The same description mentions a red spot near the pectoral fin. Would the word 'emperor' alone give that detail?", ["No", "Yes"], "No", "The family word is broad. The combination of features helps identify the fish called kacika in this account.", ["kabatia"])
    ], { label: "See the Fiji kacika description", href: "https://foodprocessors.com.fj/yellowlip-emperor-kacika/" }),
    kaikai: play("A little fish at the estuary", "Kaikai names a ponyfish. A Fiji fisheries survey records it in estuaries and lagoons; kawago is an emperor associated with reefs.", "kaikai", [
      card("A Fiji fish appendix lists Cebe/Kaikai among ponyfish in estuaries and lagoons. Is kaikai naming a ponyfish or a grouper?", ["A ponyfish", "A grouper"], "A ponyfish", "The list identifies kaikai as a ponyfish, a different group from kavu the grouper.", ["kavu"]),
      card("Does the spelling kaikai prove it means the same thing as kai, the freshwater mussel?", ["No", "Yes"], "No", "The repeated-looking fish name identifies a ponyfish here. A similar spelling does not license a guessed word-building analysis.")
    ], { label: "See Fiji fish names and habitats", href: "https://www.aciar.gov.au/sites/default/files/legacy/node/2217/mn35_pdf_78957.pdf" }),
    kava: play("Kava in this entry swims", "Here kava is a mullet recorded in Fiji's estuaries and lagoons. The English word 'kava' for a drink can mislead a learner; Fijian yaqona names the drink.", "kava", [
      card("A Fiji fish list places kava in estuaries and lagoons. What is it naming there?", ["A mullet", "A prepared drink"], "A mullet", "The Fiji fish record identifies kava as a mullet in this setting.", ["yaqona"]),
      card("Would translating this fish name as yaqona keep the same meaning?", ["No", "Yes"], "No", "Yaqona is the drink or plant name; the kava in this entry is a fish. Context is essential when a word resembles a familiar English name.", ["yaqona"])
    ], { label: "See kava in Fiji's fish-name appendix", href: "https://www.aciar.gov.au/sites/default/files/legacy/node/2217/mn35_pdf_78957.pdf" }),
    kavu: play("The giant among groupers", "Kavu is identified as the giant grouper in a Fiji fisheries survey. Delabulewa is a brown-marbled grouper, and donu is used for coral groupers.", "kavu", [
      card("Which of these names is recorded for the giant grouper?", ["kavu", "delabulewa"], "kavu", "Kavu is the giant grouper; delabulewa identifies the brown-marbled grouper.", ["delabulewa"]),
      card("A Fiji Fisheries profile names both kavu and donu among groupers. Does that make them the same species?", ["No", "Yes"], "No", "Kavu is listed as giant grouper; donu names coral groupers in the same profile.", ["donu"])
    ], { label: "See kavu in the Fiji Fisheries profile", href: "https://fiji.wcs.org/Portals/82/WCS%20Fisheries%20Profile%20290920%20WEB%20%281%29.pdf?ver=2020-10-14-024200-580" }),
    kawago: play("One emperor among several", "Kawago is the spangled emperor in Fiji fish lists. Doko ni vudi is a long-nosed emperor. Their shared family name does not make them the same fish.", "kawago", [
      card("A Fiji fish list places spangled emperor and long-nosed emperor beside different local names. Which one is kawago?", ["Spangled emperor", "Long-nosed emperor"], "Spangled emperor", "Kawago is the spangled emperor; doko ni vudi is the long-nosed emperor.", ["doko ni vudi"]),
      card("If both kawago and kabatia are emperors, can the word emperor alone select one?", ["No", "Yes"], "No", "The shared fish family is only the start. Their local names and physical identifications differ.", ["kabatia"])
    ], { label: "See Fiji emperor names and habitats", href: "https://www.aciar.gov.au/sites/default/files/legacy/node/2217/mn35_pdf_78957.pdf" }),
    qitawa: play("A perch near the shore", "A Fiji fish appendix records qitawa, a crescent perch, in estuaries and lagoons. Sakelo is a different fish associated with rivers.", "qitawa", [
      card("The appendix reports a crescent perch in estuaries and lagoons. Which name is attached to it?", ["qitawa", "sakelo"], "qitawa", "Qitawa is the name recorded there. Sakelo is a flagtail linked to river water.", ["sakelo"]),
      card("Does that same estuary setting make qitawa the ponyfish called kaikai?", ["No", "Yes"], "No", "Habitat helps narrow a search, but the appendix lists qitawa and kaikai as different fish.", ["kaikai"])
    ], { label: "See Fiji fish names and habitats", href: "https://www.aciar.gov.au/sites/default/files/legacy/node/2217/mn35_pdf_78957.pdf" }),
    reve: play("Fresh water with a coastal connection", "Reve is recorded as a native fish of fresh and brackish water. A fisheries list places it with the grunters, not with the river flagtail sakelo.", "reve", [
      card("A fish is observed where river water mixes with seawater. Does that setting rule out reve?", ["No", "Yes"], "No", "Reve is recorded in freshwater and brackish water, so a mixed-water setting can fit."),
      card("Reve and sakelo may both be discussed beside rivers. Are they the same kind of fish?", ["No", "Yes"], "No", "Reve is listed with grunters; sakelo is a flagtail. Place alone cannot substitute for an identification.", ["sakelo"])
    ], { label: "See Fiji fish families and habitats", href: "https://www.aciar.gov.au/sites/default/files/legacy/node/2217/mn35_pdf_78957.pdf" }),
    sabutu: play("An emperor with a yellow tail", "A Fiji Fisheries list identifies sabutu with the Pacific yellowtail emperor. Kawago is a spangled emperor; they share a family but not the same specific fish name.", "sabutu", [
      card("Which name is paired with Pacific yellowtail emperor in the Fiji list?", ["sabutu", "kawago"], "sabutu", "Sabutu is the name in that identification; kawago is paired with spangled emperor.", ["kawago"]),
      card("A market sign says 'emperor fish'. Has it told you whether the fish is sabutu or kabatia?", ["No", "Yes"], "No", "Both can be placed among emperors. The general English group leaves the Fijian identification open.", ["kabatia"])
    ], { label: "Compare Fiji emperor names", href: "https://www.fao.org/fileadmin/templates/ess/ess_test_folder/World_Census_Agriculture/WCA_2020/WCA_2020_new_doc/FJI_QUE_ENG_2020.pdf" }),
    sakelo: play("A flagtail in the river", "Sakelo is a flagtail fish recorded in rivers in a Fiji fish appendix. The same appendix also gives drava as a local name.", "sakelo", [
      card("The appendix lists sakelo beside drava. Are these two names attached to a flagtail or a snapper?", ["A flagtail", "A snapper"], "A flagtail", "Sakelo/drava is the flagtail identification in the appendix."),
      card("Could you identify a fish as sakelo merely because another fish, qitawa, occurs in a nearby estuary?", ["No", "Yes"], "No", "Qitawa is listed for estuaries and lagoons; sakelo is tied to rivers. Identify the fish itself, not only the place.", ["qitawa"])
    ], { label: "See Fiji river-fish names", href: "https://www.aciar.gov.au/sites/default/files/legacy/node/2217/mn35_pdf_78957.pdf" }),
    sokisoki: play("Spines change the identification", "Sokisoki is a porcupinefish; a Fiji fish list specifies spotfin porcupinefish. Sumusumu names a pufferfish, another fish often confused with it.", "sokisoki", [
      card("The fish list pairs sokisoki with spotfin porcupinefish. Which English group fits?", ["Porcupinefish", "Snapper"], "Porcupinefish", "Sokisoki is the porcupinefish name in this list; tanabe names a snapper.", ["tanabe"]),
      card("If a fish is called sumusumu in the same list, should you silently relabel it sokisoki?", ["No", "Yes"], "No", "The list distinguishes a pufferfish from a porcupinefish. Confirm the actual fish before switching names.", ["sumusumu"])
    ], { label: "Compare the Fiji fish names", href: "https://www.fao.org/fileadmin/templates/ess/ess_test_folder/World_Census_Agriculture/WCA_2020/WCA_2020_new_doc/FJI_QUE_ENG_2020.pdf" }),
    sumusumu: play("The puffer and its named variety", "Sumusumu is a pufferfish name. Fiji Fisheries also records the longer name sumusumu sevula for a white-spotted pufferfish.", "sumusumu", [
      card("A fish guide labels sumusumu sevula. What does the longer name identify?", ["A white-spotted pufferfish", "A parrotfish"], "A white-spotted pufferfish", "The longer recorded name is a particular pufferfish identification; ulavi is a parrotfish name.", ["ulavi"]),
      card("Does the shorter name sumusumu alone tell you the fish must be that one white-spotted kind?", ["No", "Yes"], "No", "The base name is broader. The extra word in sumusumu sevula narrows the identification in the fish guide.", ["sokisoki"])
    ], { label: "See the Fiji Fisheries fish guide", href: "https://www.fao.org/fileadmin/templates/ess/ess_test_folder/World_Census_Agriculture/WCA_2020/WCA_2020_new_doc/FIJ_MAN_ENG_2020.pdf" }),
    tanabe: play("Which snapper has the black tail?", "A Fiji list records tanabe for blacktail snapper. Regua is used for rivulated snapper in another identification; both are snappers, but the second word matters.", "tanabe", [
      card("Which local name is paired with blacktail snapper?", ["tanabe", "regua"], "tanabe", "Tanabe is recorded for blacktail snapper; regua has a different snapper identification.", ["regua"]),
      card("If a catch is labelled only 'snapper', can you know from that label whether it is tanabe or kake?", ["No", "Yes"], "No", "The English family name covers several listed Fijian names. A closer identification is needed.", ["kake"])
    ], { label: "See the Fiji snapper list", href: "https://www.fao.org/fileadmin/templates/ess/ess_test_folder/World_Census_Agriculture/WCA_2020/WCA_2020_new_doc/FJI_QUE_ENG_2020.pdf" }),
    ulavi: play("One name across many parrotfish", "Ulavi is a general Fijian parrotfish name. Fiji reef research also describes local colour distinctions; ulurua names one particular parrotfish in a fish list.", "ulavi", [
      card("A reef survey says 'ulavi' without a species. Should you assume it must be the steephead parrotfish?", ["No", "Yes"], "No", "Ulavi can be broad; ulurua is the name attached to that particular parrotfish in the Fiji list.", ["ulurua"]),
      card("Why might parrotfish matter beyond the fishing catch?", ["They graze algae on reefs", "They are all freshwater fish"], "They graze algae on reefs", "Fiji reef research describes parrotfish grazing as one way reefs stay clear of excessive algae.", ["ulurua"])
    ], { label: "Read about parrotfish in Fiji reefs", href: "https://fiji.wcs.org/Portals/82/FICSF%20Proceedings.pdf" }),
    ulurua: play("A particular parrotfish", "Ulurua is listed as the steephead parrotfish. Ulavi can cover parrotfish more generally, so a specific fish name is useful when the species matters.", "ulurua", [
      card("Which is the more specific name in the Fiji fish list: ulurua or ulavi?", ["ulurua", "ulavi"], "ulurua", "Ulurua is paired with steephead parrotfish; ulavi is a broader parrotfish name.", ["ulavi"]),
      card("Does every fish called ulavi have to be an ulurua?", ["No", "Yes"], "No", "A group name does not force every member to be the one particular fish named ulurua.", ["ulavi"])
    ], { label: "See the Fiji parrotfish list", href: "https://www.fao.org/fileadmin/templates/ess/ess_test_folder/World_Census_Agriculture/WCA_2020/WCA_2020_new_doc/FJI_QUE_ENG_2020.pdf" }),
    vuvula: play("Two Fiji names for one tarpon", "A Fiji fish appendix pairs vuvula and yavula with the same Indo-Pacific tarpon; it lists yavula in its river-fish section. Ulavi is a separate parrotfish name.", "vuvula", [
      card("A Fiji appendix pairs Vuvula/Yavula with one fish. Is that a tarpon or a parrotfish?", ["A tarpon", "A parrotfish"], "A tarpon", "Both names are listed for Indo-Pacific tarpon; ulavi is a parrotfish name.", ["ulavi"]),
      card("The appendix places yavula among river fishes. Does that make the paired name vuvula a kind of reef emperor like kawago?", ["No", "Yes"], "No", "The appendix identifies one as tarpon and the other as spangled emperor. Their names and fish groups differ.", ["kawago"])
    ], { label: "See tarpon in Fiji's fish-name appendix", href: "https://www.aciar.gov.au/sites/default/files/legacy/node/2217/mn35_pdf_78957.pdf" }),
    bokola: play("A word from a difficult history", "Bokola has a specific historical sense connected with an enemy killed in war and intended for consumption. A Fiji account of Naililili discusses this past practice; mate is a wider word for death.", "Bokola", [
      card("Does bokola simply mean anyone who has died, as mate can in a wider context?", ["No", "Yes"], "No", "The historical meaning is much narrower and tied to violence and consumption. Do not replace a general death word with it.", ["mate"]),
      card("In the Naililili account, are bokola the war victims discussed, or the people telling the story?", ["The war victims", "The storytellers"], "The war victims", "The account uses the word while describing victims brought to Naililili. It is a historical account, not a model for casual address.")
    ], { label: "Read the Naililili historical account", href: "https://www.fijitimes.com.fj/ko-naililili-ni-bokola/" }),
    "ba ni ika": play("A fence made for fish", "Ba ni ika is recorded in Wayan Fijian for a fish weir. Its barrier guides or traps fish as water moves; vuvu is a different, basket-like fish trap.", "ba ni ika", [
      card("If a fisher sets a barrier across a channel, is the recorded implement ba ni ika or vuvu?", ["ba ni ika", "vuvu"], "ba ni ika", "The Wayan form names a fish weir; vuvu refers to a narrow basket trap.", ["vuvu"]),
      card("What does the ika in ba ni ika tell you the barrier is for?", ["Fish", "A house"], "Fish", "Ika names fish. The full expression identifies a fishing barrier, rather than every fence called ba.", ["ika"])
    ], { label: "Explore the fish-weir comparison", href: "https://tlopo.clld.org/contributions/1-8" }),
    ajibisovi: play("An office in a Fiji church letter", "A bilingual letter from the Archdiocese of Suva uses Ajibisovi for Archbishop. It also uses Bisovi for the related bishop role and Ajidaiosisi for the wider church district.", "Ajibisovi", [
      card("When the writer says noqu cakacaka vaka-Ajibisovi, is Ajibisovi the writer's personal name or an office?", ["An office", "A personal name"], "An office", "The bilingual letter speaks of the writer's work as Archbishop. The term names a church role."),
      card("The same letter uses both Ajibisovi and Bisovi. Would you erase the difference by translating both only as 'bishop'?", ["No", "Yes"], "No", "Ajibisovi is Archbishop in the letter; Bisovi is Bishop. The added title matters to the office being described.")
    ], { label: "Read the bilingual Archdiocese letter", href: "https://aosfiji.org/wp-content/uploads/2022/06/AAA-final-final-1.pdf" }),
    "vosa veiganiti": play("Choose words for the occasion", "Vosa veiganiti concerns language fitted to a purpose or audience. A Fiji Year 13 exercise asks learners to consider the purpose and method of legal language, conversation, a public presentation and sports commentary.", "vosa veiganiti", [
      card("A learner is drafting a public legal explanation. Should the same register automatically fit a casual chat?", ["No", "Yes"], "No", "The worksheet treats legal language and conversation as different settings. Consider who is listening and why before choosing wording.", ["lawa", "vosa"]),
      card("In the worksheet, sports commentary is listed alongside conversation. What makes both relevant to vosa veiganiti?", ["Each has its own purpose and audience", "Both require identical wording"], "Each has its own purpose and audience", "The task is to match wording and delivery to the setting, not to memorise one style for every occasion.", ["qito"])
    ], { label: "Try the Fiji Year 13 register worksheet", href: "https://learninghub.telecom.com.fj/assets/worksheet/2021_Year%2013%20Vosa%20VakaViti_WORKSHEET%205.pdf" }),
    mataqiriqiri: play("A group that makes music", "Mataqiriqiri names a band or orchestra. Fiji writing uses it for named groups such as Spinning Wheels, while the surrounding text can distinguish the group from a singer.", "mataqiriqiri", [
      card("In an account of Lagani singing with Spinning Wheels, which one is called the mataqiriqiri?", ["Spinning Wheels", "Lagani alone"], "Spinning Wheels", "The account names the accompanying band as mataqiriqiri and refers separately to Lagani's singing."),
      card("If another report calls Makare Band a mataqiriqiri, does the word require only traditional instruments?", ["No", "Yes"], "No", "The attested use includes a named contemporary band. The word identifies the music group, not one fixed instrument or style.")
    ], { label: "Read mataqiriqiri in a Fiji music account", href: "https://www.fijitimes.com.fj/taleitaki-o-lagani-mai-taveuni-kei-rabi/" }),
    tabua: play("An object with a ceremonial role", "A tabua is a sperm whale tooth presented on significant occasions in Fiji. Its material and the reason for presenting it are both worth noticing.", "tabua", [
      card("At a formal welcome, officials present a tabua. What is the object itself?", ["A whale tooth", "A woven mat"], "A whale tooth", "The Fiji Prime Minister's Office identifies the presented tabua as a whale tooth. The occasion explains its use; it does not change what the object is.", ["kamunaga"]),
      card("A government account mentions tabua in a welcome, while another discusses their movement as cultural artefacts. Does 'tabua' by itself tell you the purpose of every presentation?", ["No", "Yes"], "No", "The same valued object can enter different occasions. Read the surrounding account to learn why it was presented.", ["kamunaga"])
    ], { label: "See a Fiji state welcome involving tabua", href: "https://www.pmoffice.gov.fj/traditional-ceremony-of-welcome-accorded-to-his-majesty-king-tupou-vi-and-her-majesty-queen-nanasipauu-of-the-kingdom-of-tona-08-07-2025/" }),
    kamunaga: play("The value of a presentation", "Kamunaga can refer to ceremonial valuables; a tabua is a prominent example. Fiji accounts place the presentation in particular relationships and occasions.", "kamunaga", [
      card("In a Fiji speech, a tabua is presented as kamunaga. Is kamunaga the same as the English material label 'whale tooth'?", ["No", "Yes"], "No", "Tabua names the tooth. Kamunaga draws attention to a valuable presented within a ceremony; the terms are related but do different work.", ["tabua"]),
      card("The same speech says a kamunaga was presented during a boka after a long absence. What helped explain that presentation?", ["The relationship and occasion", "Only the tooth's size"], "The relationship and occasion", "The speaker connects the offering to return, thanks, and family ties. The occasion matters to what the presentation communicates.", ["tabua"])
    ], { label: "Read a Fiji account of kamunaga and tabua", href: "https://www.foreignaffairs.gov.fj/prime-minister-rabukas-speech-at-the-state-dinner-in-kiribati/" }),
    vakasisila: play("A word whose target matters", "Vakasisila can express disgust or disgrace. Fiji usage applies it to foul surroundings and also to conduct judged shameful.", "vakasisila", [
      card("A resident describes sewage below a bridge as vakasisila. What is being judged there?", ["The filthy surroundings", "A ceremonial title"], "The filthy surroundings", "The report describes a polluted river setting. Vakasisila conveys the resident's strong revulsion.", ["savasava"]),
      card("A separate Fiji report uses i tovo vakasisila about behaviour. Is the word limited to visibly dirty places?", ["No", "Yes"], "No", "It can also condemn conduct. The word beside it, such as tovo, tells you what is being judged.")
    ], { label: "Read vakasisila in a Fiji river report", href: "https://www.fijitimes.com.fj/sewer-spill-2/" }),
    daumaka: play("Good for what?", "Daumaka takes its shade of 'good' from what follows. Fiji writing uses it for learning something worthwhile and for the quality of a service.", "daumaka", [
      card("In daumaka sara mo vulica, what is being encouraged?", ["Learning it", "Throwing it away"], "Learning it", "The invitation is to learn something worth knowing. The following mo vulica makes the good action clear."),
      card("A government health report discusses na daumaka ni noda veiqaravi. Is it praising one person's appearance or the quality of service?", ["The quality of service", "One person's appearance"], "The quality of service", "The surrounding words ni noda veiqaravi make the service the thing being evaluated.")
    ], { label: "Read daumaka in a Fiji heritage learning context", href: "https://digitalpasifik.org/items/68364" }),
    "bogi ni gone": play("A child’s head, not a time of day", "The recorded bogi ni gone is the soft area on a young child's head where the skull bones have yet to close. Bogi on its own can also mean 'night'; the whole phrase is essential here.", "bogi ni gone", [
      card("Would translating bogi ni gone word by word as 'the child's night' identify the recorded body part?", ["No", "Yes"], "No", "The whole expression is used for a part of a young child's head. A separate sense of bogi alone means night.", ["bogi"]),
      card("Why does the older description mention a young child rather than an adult?", ["The skull bones have not yet closed there", "It names an adult hairstyle"], "The skull bones have not yet closed there", "The age matters to this anatomical meaning. Present-day local usage still needs a fluent-speaker check.", ["bogi"])
    ]),
    vakalevu: play("An effect of a form, not the form itself", "In the Tuvavosa description of repetition, vakalevu names an increased or intensified effect. Drua names the repetition pattern; the two labels answer different questions.", "vakalevu", [
      card("If a repeated form conveys a stronger effect, which label names that effect: vakalevu or drua?", ["vakalevu", "drua"], "vakalevu", "Vakalevu labels the increased force in this analysis. Drua is the word-shape process being examined.", ["drua"]),
      card("Can a repeated-looking word be called vakalevu without checking its base and use?", ["No", "Yes"], "No", "A repeated shape alone does not prove a live intensified meaning. Compare the word in a complete phrase before assigning the effect.", ["yavu drua"])
    ], { label: "Read a Fijian grammar treatment of repetition", href: "https://manifold.uhpress.hawaii.edu/projects/the-fijian-language" }),
    badamu: play("An eel in quieter water", "Fiji fisheries research identifies badamu with the Pacific short-finned eel. It tends toward still or marshy water, while the recorded diria and tautaubale favour faster streams.", "badamu", [
      card("A Fiji freshwater eel is found in still, marshy water. Which recorded name is a better starting clue?", ["badamu", "tautaubale"], "badamu", "Badamu has the still-water association in the fishery profile; tautaubale is more associated with faster, upper river water.", ["tautaubale"]),
      card("When mature badamu move down rivers toward the sea, have they become a different named reef fish?", ["No", "Yes"], "No", "The fishery profile describes a freshwater eel's life cycle: adults migrate seaward to spawn. Duna remains the broad local eel category.", ["duna"])
    ], { label: "Read the Fiji freshwater-eel profile", href: "https://fiji.wcs.org/Portals/82/WCS%20Fisheries%20Profile%20290920%20WEB%20%281%29.pdf?ver=2020-10-14-024200-580" }),
    diria: play("A different river eel", "Diria is recorded as the giant mottled eel. Fiji fisheries research distinguishes it from the short-finned badamu and records it in faster water.", "diria", [
      card("Which recorded eel name goes with the giant mottled eel rather than the Pacific short-finned eel?", ["diria", "badamu"], "diria", "The fisheries profile pairs diria with the giant mottled eel and badamu with the short-finned eel.", ["badamu"]),
      card("A mature diria leaves a river and heads toward the sea. Does that movement make it a saltwater-only eel throughout its life?", ["No", "Yes"], "No", "These eels grow in rivers and later migrate seaward for spawning. The movement is part of a life cycle, not a different species name.", ["duna"])
    ], { label: "Compare Fiji's three freshwater eels", href: "https://fiji.wcs.org/Portals/82/WCS%20Fisheries%20Profile%20290920%20WEB%20%281%29.pdf?ver=2020-10-14-024200-580" }),
    tautaubale: play("The eel of upper rivers", "Tautaubale is the Polynesian long-finned eel in Fiji's fisheries profile. It is associated with faster water and river headwaters.", "tautaubale", [
      card("A report places an eel in upper, faster-flowing river water. Which of these recorded names fits that setting better?", ["tautaubale", "badamu"], "tautaubale", "Tautaubale is associated with headwaters; badamu tends toward still or marshy water. Habitat guides identification but does not replace looking at the fish.", ["badamu"]),
      card("Do the names tautaubale and diria mean the same species merely because both prefer faster water?", ["No", "Yes"], "No", "The profile identifies tautaubale as a long-finned eel and diria as the giant mottled eel. Shared habitat does not erase that distinction.", ["diria"])
    ], { label: "See the Fiji eel names and habitats", href: "https://fiji.wcs.org/Portals/82/WCS%20Fisheries%20Profile%20290920%20WEB%20%281%29.pdf?ver=2020-10-14-024200-580" }),
    keteleka: play("A mullet name that can change with size", "In fisherwomen's recorded naming practice, keteleka can name a small mullet in a sequence that later uses other names as the fish grows.", "keteleka", [
      card("In the recorded size sequence keteleka, tumō, kanace, yawa, which name is used for the small fish?", ["keteleka", "kanace"], "keteleka", "Keteleka is the small stage in that reported sequence; kanace is used later for a larger fish.", ["kanace"]),
      card("If a fish called keteleka grows, does the study suggest its local name must stay unchanged at every size?", ["No", "Yes"], "No", "The fisherwomen reported size-related names. This is a documented community naming pattern, not a rule to impose on every village.", ["kanace"])
    ], { label: "Read the fisherwomen's naming study", href: "https://repository.usp.ac.fj/id/eprint/14532/1/A%20RANKE____Frontiers%20in%20Marine%20Science%20-%202023.pdf" }),
    moka: play("A trap built into the shore", "A moka is a stone fish trap. At Vatulele on Koro, a community account describes a stone enclosure that fills at high tide and holds fish when the water falls.", "moka", [
      card("When the tide retreats from a stone enclosure, what can remain inside a moka?", ["Fish", "Only a bamboo basket"], "Fish", "The account describes fish entering at high tide and being enclosed as the tide falls. A vuvu is a different, narrow trap.", ["vuvu"]),
      card("The Vatulele account says four mataqali helped build the moka. Does that make it just a portable tool one person carries away after each catch?", ["No", "Yes"], "No", "This moka is a shore structure built through communal work. Keep that local account tied to Vatulele rather than assigning its history to every moka.")
    ], { label: "Read the Vatulele account of moka", href: "https://www.fijitimes.com.fj/discovering-fiji-the-fish-trap-and-leka-the-spirit/" }),
    vuvu: play("One spelling, several meanings", "Vuvu can name a narrow bamboo fish trap in the recorded fishing sense. Other dictionary senses involve jealousy or muddy water, so a whole sentence is needed.", "vuvu", [
      card("A fisher sets a long narrow bamboo trap rather than a stone shore enclosure. Which recorded fishing word fits?", ["vuvu", "moka"], "vuvu", "The historical fishing record uses vuvu for the narrow trap; moka is a stone enclosure working with the tide.", ["moka"]),
      card("If someone says vuvu in a conversation about envy, should you automatically picture the bamboo trap?", ["No", "Yes"], "No", "The same spelling has a separate jealousy sense. Let the surrounding sentence select the sense instead of joining the meanings together.")
    ], { label: "Explore the Oceanic history of the fish-trap word", href: "https://tlopo.clld.org/contributions/1-8" }),
    dairo: play("A sea cucumber, not a finfish", "Dairo identifies the sandfish sea cucumber in a Fiji fisheries survey. The longer dairo kula is listed separately for golden sandfish.", "dairo", [
      card("The Fiji survey identifies dairo as sandfish. Is that a sea cucumber or a finfish with scales?", ["A sea cucumber", "A finfish"], "A sea cucumber", "The survey classifies dairo among sea cucumbers. The English trade name 'sandfish' can mislead if read as a finfish label.", ["ika"]),
      card("A field team records dairo kula separately. Should the word dairo alone force every specimen to be golden sandfish?", ["No", "Yes"], "No", "The survey distinguishes sandfish from golden sandfish. The extra word matters to that identification.")
    ], { label: "See dairo in the Fiji sea-cucumber survey", href: "https://fiji.wcs.org/Portals/82/reports/WCS%20Sea%20cucumber%20report%20260217.pdf" }),
    kake: play("A snapper name at two levels", "A Fiji census fish list pairs kake with Russell's snapper; fisherwomen's research also records kake as a wider snapper name covering several species. The context decides how specific an identification is.", "kake", [
      card("In the Fiji census list, which fish is paired with kake: Russell's snapper or blacktail snapper?", ["Russell's snapper", "Blacktail snapper"], "Russell's snapper", "The list pairs kake with Russell's snapper and tanabe with blacktail snapper.", ["tanabe"]),
      card("A fisherwoman's report groups three snapper species under kake. Can every use of kake then be assigned one exact scientific species without inspecting the fish?", ["No", "Yes"], "No", "The research records a broader local category. The census's narrower pairing is useful, but it does not settle every community use.", ["tanabe"])
    ], { label: "See fisherwomen's snapper naming research", href: "https://repository.usp.ac.fj/id/eprint/14532/1/A%20RANKE____Frontiers%20in%20Marine%20Science%20-%202023.pdf" }),
    novu: play("A stonefish on the reef", "Fijian fisherwomen's research records novu as a reef stonefish. The same study reports it alongside a coral-banded shrimp, showing that a fish name also leads to a habitat story.", "novu", [
      card("Which fish does the study identify by the name novu?", ["A reef stonefish", "A mullet"], "A reef stonefish", "Novu is recorded for the reef stonefish; keteleka is a mullet name in the same research setting.", ["keteleka"]),
      card("The report notes a shrimp near novu. Does that make novu a word for the shrimp?", ["No", "Yes"], "No", "The fish and shrimp are separate animals observed together. Association in a habitat is not identity.")
    ], { label: "Read the Fiji fisherwomen's reef observations", href: "https://repository.usp.ac.fj/id/eprint/14532/1/A%20RANKE____Frontiers%20in%20Marine%20Science%20-%202023.pdf" }),
    daniva: play("A named fish in two catches", "Fiji fisheries records list daniva among baitfish catches and also name it in a Rewa River survey. The catch tables distinguish daniva from sardines and anchovies.", "daniva", [
      card("The baitfish table gives daniva and sardines separate rows. Should you combine them into one count?", ["No", "Yes"], "No", "The report records them separately, even though both are small fish used in baitfish fisheries."),
      card("The Rewa River list includes daniva. Does that make the name a reef-only fish label?", ["No", "Yes"], "No", "The recorded Rewa catch is a reminder to check the local water and fish, rather than assume one habitat from a short English gloss.", ["tovisi", "yavula"])
    ], { label: "See daniva in Fiji fisheries records", href: "https://fjdigitallib.usp.ac.fj/greenstone3/pimris/sites/pimrissite/collect/pimris/index/assoc/HASHabe9.dir/doc.pdf" }),
    tovisi: play("The ribbonfish in a river survey", "A Fiji fisheries survey names tovisi as ribbonfish among catches from the Rewa River. The same list records yavula as tarpon; these are different fish, despite appearing in one survey.", "tovisi", [
      card("In the Rewa River list, which recorded name is paired with ribbonfish?", ["tovisi", "yavula"], "tovisi", "Tovisi is the ribbonfish entry; yavula is the tarpon entry.", ["yavula"]),
      card("Does appearing beside yavula in the survey make tovisi another name for tarpon?", ["No", "Yes"], "No", "A survey lists different catches together. It does not make their Fijian names interchangeable.", ["yavula"])
    ], { label: "Compare the Rewa River fish list", href: "https://fjdigitallib.usp.ac.fj/greenstone3/pimris/sites/pimrissite/collect/pimris/index/assoc/HASHabe9.dir/doc.pdf" }),
    yavula: play("A tarpon with two recorded names", "The Rewa River survey pairs yavula with tarpon. Another Fiji fish-name appendix gives vuvula and yavula together for the Indo-Pacific tarpon.", "yavula", [
      card("Which other recorded Fijian name is paired with yavula for the Indo-Pacific tarpon?", ["vuvula", "tovisi"], "vuvula", "The appendix pairs vuvula and yavula. Tovisi is listed separately as ribbonfish.", ["vuvula", "tovisi"]),
      card("If you find yavula in the Rewa River list, which English fish name does that list give?", ["Tarpon", "Ribbonfish"], "Tarpon", "The survey gives yavula as tarpon; the neighbouring tovisi entry is ribbonfish.", ["tovisi"])
    ], { label: "See the Rewa River survey", href: "https://fjdigitallib.usp.ac.fj/greenstone3/pimris/sites/pimrissite/collect/pimris/index/assoc/HASHabe9.dir/doc.pdf" }),
    ogo: play("A barracuda name with narrower relatives", "The Fiji Agriculture Census lists ogo among barracuda names and gives ogobuidromo specifically for pickhandle barracuda. The wider name and the more precise name serve different purposes.", "ogo", [
      card("A Fiji catch is labelled ogo. Which fish group does the census place it with?", ["Barracuda", "Snapper"], "Barracuda", "The census groups ogo with barracuda. Its snapper list uses other names, such as kake.", ["kake"]),
      card("A record says ogobuidromo. Can you discard the extra part and still claim the exact pickhandle identification from ogo alone?", ["No", "Yes"], "No", "Ogobuidromo is listed specifically for pickhandle barracuda; ogo is also used as a broader barracuda label.", ["ogobuidromo"])
    ], { label: "See barracuda names in Fiji's census list", href: "https://www.fao.org/fileadmin/templates/ess/ess_test_folder/World_Census_Agriculture/WCA_2020/WCA_2020_new_doc/FJI_QUE_ENG_2020.pdf" }),
    "bati-ni-siwa": play("The hook in a fishing line", "Bati ni siwa names a fish hook in a Fiji museum collection. A fishing account places the hook with wa ni siwa, the line; the two are connected but are not the same piece of gear.", "bati-ni-siwa", [
      card("A museum object is labelled Bati ni Siwa. Is it the hook or the fishing line?", ["The hook", "The line"], "The hook", "The museum label identifies it as a fish hook; wa ni siwa names the line.", ["wa ni siwa"]),
      card("If a fisher replaces only the wa ni siwa, have they necessarily replaced the bati ni siwa too?", ["No", "Yes"], "No", "Line and hook work together but remain distinct parts of the fishing gear.", ["wa ni siwa"])
    ], { label: "See a Fiji fish hook in the museum collection", href: "https://artsandculture.google.com/story/nai-ya-vakaviki-na-ka-mareqeti-fiji-auckland-war-memorial-museum/FwXhbA0kX3gnJw?hl=en" }),
    "wa ni siwa": play("The line, not the hook", "Wa ni siwa is a fishing line. A Fiji fishing account names it with bati ni siwa, the hook that can be attached to it.", "wa ni siwa", [
      card("In the pair wa ni siwa and bati ni siwa, which one is the line?", ["wa ni siwa", "bati ni siwa"], "wa ni siwa", "Wa ni siwa is the line; bati ni siwa names the hook.", ["bati-ni-siwa"]),
      card("If a museum display has only a bati ni siwa, does its label alone tell you what the whole fishing line was made from?", ["No", "Yes"], "No", "The hook is one piece of gear. The material and length of a particular wa ni siwa need their own evidence.", ["bati-ni-siwa"])
    ], { label: "Read about hook and line in Fiji fishing", href: "https://www.fijitimes.com.fj/na-veimataqali-qio/" }),
    iqoliqoli: play("Fishing waters and community ties", "Iqoliqoli names a customary fishing area, with its boundaries and customary interests recorded in Fiji. It refers to waters associated with a community, not a single fish or one trip to catch it.", "iqoliqoli", [
      card("A record maps an iqoliqoli boundary. Is it mapping a fishing area or naming one species of fish?", ["A fishing area", "One fish species"], "A fishing area", "Fiji's records describe iqoliqoli boundaries and customary interests; ika is a fish.", ["ika"]),
      card("Someone says they will qoliva nearby waters. Is that action the same thing as the iqoliqoli area itself?", ["No", "Yes"], "No", "Qoliva describes fishing an area; iqoliqoli names an area with a customary relationship. One is an activity, the other a place and its community context.", ["qoliva"])
    ], { label: "Read about Fiji's recorded iqoliqoli boundaries", href: "https://fijiclimatechangeportal.gov.fj/wp-content/uploads/2023/05/11.-Lease-_-Benefit-Sharing.pdf" }),
    qoliva: play("Fishing a particular stretch", "In a Fiji fisheries account, people 'qoliva na wai e tokaravita na nodra itikotiko': they fish the waters around their homes. Qoliva is the activity, while iqoliqoli names a customary fishing area.", "qoliva", [
      card("In 'qoliva na wai e tokaravita na nodra itikotiko', what is being fished?", ["The surrounding waters", "A house"], "The surrounding waters", "Na wai is the waters being fished; the rest of the phrase locates them near people's homes."),
      card("If a village identifies its iqoliqoli, have they merely used another word for the act of qoliva?", ["No", "Yes"], "No", "Iqoliqoli identifies customary fishing waters; qoliva describes fishing them. The community relationship matters to the first term.", ["iqoliqoli"])
    ], { label: "Read qoliva in a Fiji fisheries account", href: "https://www.fijitimes.com.fj/yavu-ni-veiqaravi-o-keda-kei-na-iyaubula/" }),
    qolua: play("A bamboo refuge used as a trap", "A Fiji freshwater fisheries profile describes qolua as hollow bamboo stalks set as a trap, mainly for eels. It differs from a moka, which is a stone enclosure on a tidal shore.", "qolua", [
      card("A fisher places hollow bamboo stalks for eels. Which recorded trap is this?", ["qolua", "moka"], "qolua", "The freshwater fisheries profile describes qolua with hollow bamboo; the documented moka is a stone shore trap.", ["moka", "duna"]),
      card("If a trap depends on fish entering a stone enclosure with the tide, should you call that the same gear as a bamboo qolua?", ["No", "Yes"], "No", "The materials and settings differ. The stone tidal enclosure is a moka, while the bamboo qolua mainly targets eels in freshwater fishing.", ["moka", "duna"])
    ], { label: "Read about Fiji river-fishing methods", href: "https://fiji.wcs.org/Portals/82/WCS%20Fisheries%20Profile%20290920%20WEB%20%281%29.pdf?ver=2020-10-14-024200-580" }),
    tugadra: play("A fish that brought a village together", "Tugadra is recorded as bigeye scad. A Cicia study describes villagers fishing together when tugadra appeared near Tarukua and then sharing the catch between households.", "tugadra", [
      card("In the Cicia account, what was spotted near Tarukua: tugadra or an eel called diria?", ["tugadra", "diria"], "tugadra", "The account names tugadra; fish records identify it as bigeye scad, a schooling fish.", ["diria"]),
      card("After the Tarukua villagers caught tugadra, how was that particular catch used?", ["Shared between households", "Kept by one person"], "Shared between households", "The account describes a collective fishing party and an equal share for households. It describes that event, not a rule for every tugadra catch.")
    ], { label: "Read the Cicia fishing account", href: "https://horizon.documentation.ird.fr/exl-doc/pleins_textes/2022-02/010083954.pdf" }),
    guru: play("A group name with a local relationship", "In Vanua Navakavu, guru is a broad name for damselfishes. Research also records a particular fish within that group as a clan fish totem there, so the group name alone does not identify that one species.", "guru", [
      card("If several damselfish species are called guru locally, does guru alone identify one exact scientific species?", ["No", "Yes"], "No", "The Vanua Navakavu study records guru as a broad group name. A closer identification needs the fish and local knowledge."),
      card("A particular guru is important as a fish totem in Vanua Navakavu. Does that make every fish called guru the same totem species?", ["No", "Yes"], "No", "The research distinguishes the broader damselfish category from a particular species with a clan relationship. Ask locally before attaching that relationship to another fish.")
    ], { label: "Read the Vanua Navakavu fish-name study", href: "https://spccfpstore1.blob.core.windows.net/digitallibrary-docs/files/88/88a1f351144fda547a2b74821378837f.pdf" }),
    tivitivi: play("One name across many reef fish", "Fijian fisher knowledge records tivitivi as a broad butterflyfish name. A fish list may apply it to several distinct species, whereas ulavi refers to parrotfish.", "tivitivi", [
      card("A survey lists two different butterflyfish as tivitivi. Must they be the same scientific species?", ["No", "Yes"], "No", "A broad local name can cover more than one species; the survey lists several butterflyfish under tivitivi."),
      card("If a fish is a parrotfish rather than a butterflyfish, which of these recorded names is the better clue?", ["ulavi", "tivitivi"], "ulavi", "The fisher-knowledge table puts ulavi with parrotfish and tivitivi with butterflyfish. Local identification still needs the fish and the speaker's usage.", ["ulavi"])
    ], { label: "See Fiji fisher knowledge of reef-fish groups", href: "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0098036" }),
    tabace: play("A surgeonfish name in Fiji surveys", "Fiji fisheries surveys record tabace among surgeonfish; one species list pairs it with the convict surgeonfish. Balagi is another surgeonfish name, so the family alone does not settle the local name.", "tabace", [
      card("One Fiji species list pairs tabace with which fish: convict surgeonfish or a parrotfish?", ["Convict surgeonfish", "Parrotfish"], "Convict surgeonfish", "The survey labels a convict surgeonfish tabace; ulavi is a parrotfish name.", ["ulavi"]),
      card("If two fish are both surgeonfish, may you automatically replace tabace with balagi?", ["No", "Yes"], "No", "The fisheries report lists tabace and balagi separately within the surgeonfish family. A shared family is not a licence to swap local fish names.", ["balagi"])
    ], { label: "See Fiji's surgeonfish survey", href: "https://fjdigitallib.usp.ac.fj/greenstone3/pimris/collection/pimris/document/HASH014b7f49dff7486902a751a4?ed=1" }),
    ta: play("How specific is a unicornfish name?", "A Fiji census list pairs ta with bluespine unicornfish, while FishBase records ta for several Naso species. The fish and the source matter when someone asks for an exact scientific identification.", "ta", [
      card("Which fish does the Fiji census list pair with ta?", ["Bluespine unicornfish", "Convict surgeonfish"], "Bluespine unicornfish", "That is the census pairing; tabace is used for convict surgeonfish in a separate fisheries survey.", ["tabace"]),
      card("FishBase lists ta with several unicornfish species. Can the short name alone always settle which Naso species you saw?", ["No", "Yes"], "No", "The name has multiple recorded species pairings. Describe the actual fish or seek a knowledgeable local identification.")
    ], { label: "Compare recorded ta fish names", href: "https://www.fishbase.se/country/CountryComNamesSearchList.php?Country=242&resultPage=18" }),
    tunatuna: play("A conger, rather than a river eel", "FishBase records tunatuna for a conger eel. Fiji fisheries research lists diria among freshwater eels, so the two names should not be treated as interchangeable just because both fish are long and eel-shaped.", "tunatuna", [
      card("A fish record identifies Conger cinereus. Which Fijian name is listed for it?", ["tunatuna", "diria"], "tunatuna", "FishBase pairs tunatuna with the conger; Fiji's river-eel profile identifies diria differently.", ["diria"]),
      card("Does an eel-shaped body alone tell you whether to use tunatuna or diria?", ["No", "Yes"], "No", "One record concerns a conger and the other a freshwater eel. Check the fish and its setting instead of guessing from its shape.", ["diria"])
    ], { label: "See the recorded conger identification", href: "https://www.fishbase.se/ComNames/CommonNameSearchList.php?CommonName=Tuna&crit1_operator=CONTAINS&resultPage=6&sortby=nametype&sp=n" }),
    dabea: play("A moray name with more than one match", "FishBase records dabea for two moray species in Fiji. Tunatuna is recorded for a conger eel; saying only 'eel' hides the distinction between those groups.", "dabea", [
      card("FishBase pairs dabea with two Gymnothorax species. Are those morays or congers?", ["Morays", "Congers"], "Morays", "The two listed species are morays. Tunatuna is paired with a conger eel.", ["tunatuna"]),
      card("Can dabea by itself guarantee one precise scientific species in the two Fiji FishBase records?", ["No", "Yes"], "No", "Two moray species are recorded with that name. A species label needs more evidence than the local name alone.")
    ], { label: "Compare Fiji's dabea records", href: "https://fishbase.se/ComNames/CommonNameSearchList.php?CommonName=Dab&crit1_operator=CONTAINS&language=&selected_territory=" }),
    davilai: play("A flatfish seen in Fiji records", "Fiji fish records use davilai for flatfish. FishBase pairs it with a flounder, while an older Fijian account describes the fish's flatness through a story; the story and biological identification answer different questions.", "davilai", [
      card("When a Fiji fish list gives davilai as a flounder, which body plan should you expect?", ["A flattened flatfish", "An eel-shaped fish"], "A flattened flatfish", "Davilai is a flatfish name; a moray such as dabea belongs to another fish group.", ["dabea"]),
      card("An older account tells why davilai became flat. Does that tale by itself establish the fish's scientific species?", ["No", "Yes"], "No", "The account preserves a story about the fish. Biological identification requires a specimen and a fish record; both kinds of knowledge can be read without confusing them.")
    ], { label: "Read the older davilai account", href: "https://upload.wikimedia.org/wikipedia/commons/8/80/A_Fijian_and_English_and_an_English_and_Fijian_dictionary%2C_with_examples_of_common_and_peculiar_modes_of_expression_and_uses_of_words%2C_also%2C_containing_brief_hints_on_native_customs_%28IA_fijianenglishand00hazl%29.pdf" }),
    regua: play("When a fish name has different identifications", "FishBase records regua for rivulated snapper in Fiji and also connects the same local name to sea chubs. A single English gloss cannot settle every use without a fish specimen and local context.", "regua", [
      card("One Fiji record pairs regua with Lutjanus rivulatus. What English fish group is that?", ["A snapper", "A catfish"], "A snapper", "Lutjanus rivulatus is a snapper; kaboa is a catfish name.", ["kaboa"]),
      card("Another record places regua with sea chubs. Should the snapper pairing automatically override that other local use?", ["No", "Yes"], "No", "Both pairings appear in FishBase. Keep the identification tied to the fish, place and source rather than force one species on every regua.")
    ], { label: "Compare Fiji's regua records", href: "https://www.fishbase.se/country/CountryComNamesSearchList.php?Country=242&showAll=yes" }),
    bonu: play("Which eel did you see?", "Bonu appears with several eel species in Fiji fish records, from a freshwater eel to marine morays. A location or a more specific name helps narrow the identification.", "bonu", [
      card("A Fiji fish list calls both a freshwater eel and several morays bonu. Does bonu alone tell you whether the fish came from a river or reef?", ["No", "Yes"], "No", "The recorded name spans both settings. Ask where the fish was found and what it looked like before settling on a species.", ["duna", "dabea"]),
      card("The longer name bonu dadarikai is recorded for a particular freshwater moray. Does the added word provide more identification than bonu alone?", ["Yes", "No"], "Yes", "Bonu dadarikai names a recorded freshwater moray, while plain bonu is paired with several eels. The added name narrows the search but a specimen still matters.")
    ], { label: "See Fiji's recorded bonu names", href: "https://www.fishbase.se/country/CountryComNamesSearchList.php?Country=242&showAll=yes" }),
    kaboa: play("An eel-shaped fish that is a catfish", "FishBase pairs kaboa with the striped eel catfish. Its eel-like outline is misleading: it is a catfish with barbels, and its fin spines can sting.", "kaboa", [
      card("A long fish has stripes and whisker-like barbels. Does the Fiji name kaboa lead to a catfish or a moray?", ["A catfish", "A moray"], "A catfish", "Kaboa is recorded for the striped eel catfish. Dabea is a moray name, although both fish can look eel-like at a glance.", ["dabea"]),
      card("FishBase warns that this catfish has venomous fin spines. Is its eel-like body a safe reason to handle it like a harmless eel?", ["No", "Yes"], "No", "The striped eel catfish has venomous spines. Identification matters before anyone handles a fish.")
    ], { label: "See the striped eel catfish record", href: "https://www.fishbase.se/summary/4706" }),
    uluqa: play("A snapper with more than one English name", "A Fiji fish list pairs uluqa with Paracaesio kusakarii. FishBase gives that species the English name saddleback snapper and also records Bedford.", "uluqa", [
      card("A fish list gives uluqa and ulavi. Which name is paired with the saddleback snapper?", ["uluqa", "ulavi"], "uluqa", "Uluqa is paired with saddleback snapper; ulavi names a parrotfish. Similar openings do not make the fish the same.", ["ulavi"]),
      card("A seller calls an uluqa 'Bedford'. Must that be a different species from the saddleback snapper?", ["No", "Yes"], "No", "FishBase records Bedford and saddleback snapper for the same species paired with uluqa. English fish names can vary too.")
    ], { label: "Compare names for uluqa", href: "https://fishbase.se/ComNames/CommonNamesList.php?GenusName=Paracaesio&ID=191&SpeciesName=kusakarii&StockCode=205" }),
    vocivoci: play("Spot the pufferfish", "FishBase pairs vocivoci with the white-spotted puffer, Arothron hispidus. The recorded fish is poisonous to eat, so recognising the name has a practical safety point.", "vocivoci", [
      card("A Fiji fish guide pairs vocivoci with a puffer marked by white spots. Which English name fits?", ["White-spotted puffer", "Saddleback snapper"], "White-spotted puffer", "Vocivoci is recorded for a pufferfish; uluqa is paired with a saddleback snapper.", ["uluqa"]),
      card("If someone recognises vocivoci as a fish, does that mean it is safe to eat?", ["No", "Yes"], "No", "FishBase marks this puffer poisonous to eat. A fish name and an edible-fish label are different things.")
    ], { label: "See the vocivoci fish record", href: "https://www.fishbase.se/summary/arothron-hispidus" }),
    variivoce: play("One reef fish, several local names", "NatureFiji identifies variivoce as the humphead wrasse and also records Draudrau and Dagava, the latter in Lau. Adult and young fish can look different.", "variivoce", [
      card("A speaker from Lau says Dagava. Could they be naming the fish also recorded as variivoce?", ["Yes", "No"], "Yes", "NatureFiji lists Dagava (Lau) among local names for the humphead wrasse. A regional name need not mean a different species."),
      card("Would a young variivoce always show the prominent head hump of a large adult?", ["No", "Yes"], "No", "The hump develops with growth. Age and appearance matter when trying to match a local name to a fish.")
    ], { label: "Meet the humphead wrasse in Fiji", href: "https://www.naturefiji.org/cheilinus-undulatus-humphead-maori-wrasse/" }),
    moci: play("Small prawns, important waters", "A Fiji fisheries profile identifies moci as a mangrove prawn. Another community plan records moci among the resources people collect near mangroves and estuaries.", "moci", [
      card("If a community lists moci with mangrove resources, is it talking about small prawns or reef parrotfish?", ["Small prawns", "Reef parrotfish"], "Small prawns", "Moci are prawns or shrimps; ulavi is a parrotfish name. The habitat gives another clue.", ["ulavi"]),
      card("The fisheries profile gives a female moci a maximum length of about 7 cm. Is this the same scale as the much larger banana prawn listed there?", ["No", "Yes"], "No", "The profile distinguishes the small mangrove prawn from larger commercial prawns. English 'prawn' alone hides that size difference.")
    ], { label: "Explore Fiji's prawn profiles", href: "https://fiji.wcs.org/Portals/82/WCS%20Fisheries%20Profile%20290920%20WEB%20%281%29.pdf?ver=2020-10-14-024200-580" }),
    vavaba: play("Which kind of lobster?", "Fiji fisheries material identifies vavaba as a slipper lobster, Parribacus caledonicus. Its broad, flattened shape differs from that of a spiny lobster.", "vavaba", [
      card("Would you expect a vavaba to have the broad flattened body of a slipper lobster or the long feelers of a spiny lobster?", ["Broad flattened body", "Long spiny-lobster feelers"], "Broad flattened body", "Vavaba is a slipper lobster. 'Lobster' is a broad English label, so its body shape helps identify the group."),
      card("A Fiji species list also calls Parribacus caledonicus ivinibola. Does this second recorded Fijian name necessarily mean a second species?", ["No", "Yes"], "No", "The Fiji Government lists vavaba and ivinibola for the same slipper-lobster species. Local naming and scientific identification answer different questions.")
    ], { label: "See Fiji's recorded slipper-lobster names", href: "https://www.fiji.gov.fj/Media-Centre/Speeches/English/DECISIONS-OF-THE-3RD-CABINET-MEETING-HELD-ON-17-FE" }),
    vevewai: play("A more particular ray name", "FishBase records vevewai in Fiji for Mobula birostris, the giant oceanic manta ray. Vai is a broader ray or stingray name, so the two are not interchangeable labels for every ray.", "vevewai", [
      card("A fish record says vevewai and Mobula birostris. Which English identification fits?", ["Giant oceanic manta ray", "Striped eel catfish"], "Giant oceanic manta ray", "Vevewai is paired with the giant oceanic manta; kaboa names a striped eel catfish.", ["kaboa"]),
      card("If someone says vai for a ray, can you conclude from that broad word alone that it was a vevewai?", ["No", "Yes"], "No", "Vai can refer to rays or stingrays generally. Vevewai has a particular recorded manta-ray pairing.", ["vai"])
    ], { label: "See the vevewai species record", href: "https://fishbase.se/ComNames/CommonNamesList.php?GenusName=Mobula&ID=2061&SpeciesName=birostris&StockCode=2256" }),
    "rosi ni bogi": play("Follow the fish, not the English nickname", "FishBase pairs Rosinibogi with Lutjanus malabaricus, the Malabar blood snapper. The species also has several English market names and changes habitat as it grows.", "rosi ni bogi", [
      card("A record calls a rosi ni bogi 'saddletail snapper'. Does that necessarily make it a different species from the Malabar blood snapper?", ["No", "Yes"], "No", "FishBase records both English names for Lutjanus malabaricus. Compare the species, rather than assuming every English market name denotes a different fish."),
      card("Where would FishBase lead you to look for a larger adult: the shallow inshore water used by juveniles, or deeper water?", ["Deeper water", "Only shallow inshore water"], "Deeper water", "Its species profile says juveniles tend to occupy shallow inshore water while larger fish live deeper. Age changes where the fish may be found.")
    ], { label: "See the Malabar blood snapper profile", href: "https://fishbase.se/summary/Lutjanus-malabaricus" }),
    tidaloko: play("A fish on the mangrove mud", "A Fiji mangrove study records tidaloko, also written tiloko, for mudskippers seen on wet mud and mangrove roots. The setting helps distinguish them from fish seen only underwater.", "tidaloko", [
      card("If you see a small fish moving over wet mud by mangrove roots, which recorded name fits: tidaloko or uluqa?", ["tidaloko", "uluqa"], "tidaloko", "Tidaloko is a mudskipper name in the Fiji mangrove study. Uluqa is paired with a snapper.", ["uluqa"]),
      card("The same mangrove list gives tidaloko and tiloko. Should a reader automatically treat them as two different animal species?", ["No", "Yes"], "No", "The study records both forms for mudskipper. A spelling or local-name variation is not by itself a species difference.")
    ], { label: "Explore the Fiji mangrove species list", href: "https://gec.jp/jpn/cdm-fs/2005/200516JPAnnex-TaishiDesignOffice-Fiji-MangroveReforestation.pdf" }),
    sarau: play("Look for the blue lines", "A University of the South Pacific fish guide identifies sarau, also listed as kake, with the blue-lined snapper. Its yellow body carries narrow blue lines.", "sarau", [
      card("A yellow snapper has several thin blue lines along its side. Which recorded name fits: sarau or kaboa?", ["sarau", "kaboa"], "sarau", "The Fiji guide pairs sarau with the blue-lined snapper. Kaboa is a striped eel catfish.", ["kaboa"]),
      card("If another list uses kake for that blue-lined snapper, does this alone prove a different species?", ["No", "Yes"], "No", "The USP guide lists sarau and kake together for the same blue-lined snapper. Check the actual fish and local usage before treating names as separate species.", ["kake"])
    ], { label: "See the USP Fiji fish guide", href: "https://fjdigitallib.usp.ac.fj/greenstone3/pimris/sites/pimrissite/collect/pimris/index/assoc/HASH5247.dir/doc.pdf" }),
    visako: play("Two herons near Fiji shores", "A survey of Nasoata Island records visako as a mangrove heron and belo as a reef heron. Both can be near the coast, but the survey names different birds.", "visako", [
      card("In the Nasoata bird list, which Fijian name belongs to the mangrove heron?", ["visako", "belo"], "visako", "The survey pairs visako with the mangrove heron, Butorides striatus; belo is paired with the reef heron, Egretta sacra."),
      card("Would a bird seen on a coastal mudflat be identified as visako just because mangroves are nearby?", ["No", "Yes"], "No", "The Nasoata survey records several shore birds. Habitat narrows the search, but the bird's features are needed for identification.")
    ], { label: "Read the Nasoata Island bird survey", href: "https://panorama.solutions/sites/default/files/2005_Thaman__R._et_al._Nasaota_Mangrove_Island__the_PABITRA_Coastal_Study_Site_for_Viti_Levu__Fiji_Islands.pdf" }),
    vai: play("A ray name that needs context", "A Wainunu resource plan lists vai as a ray. FishBase also records longer Fiji names such as vai da for particular rays; the extra words can narrow an identification.", "vai", [
      card("A community lists vai among coastal resources. Is it referring to a ray or a reef snapper?", ["A ray", "A reef snapper"], "A ray", "The Wainunu plan pairs vai with ray. A snapper such as uluqa belongs to a different fish group.", ["uluqa"]),
      card("FishBase records the longer name vai da for a round ribbontail ray. Does plain vai alone identify that one species?", ["No", "Yes"], "No", "The shorter name is broad. Vai da is a more particular recorded name; a confirmed species still needs a good look at the fish.", ["vevewai"])
    ], { label: "Read the Wainunu coastal-resource plan", href: "https://fiji.wcs.org/Portals/82/Wainunu%20Management%20plan%20FINAL060712.pdf" }),
    itaraki: play("The net in two Fiji stories", "A Fijian school passage places itaraki among the gear carried to a reef fishing trip. Another Fijian account lists it among ways people gathered balolo. It names a handheld net, not the catch itself.", "itaraki", [
      card("In a school passage, the group carries itaraki and siwa, while two men carry moto. Which item is the hand net?", ["itaraki", "moto"], "itaraki", "Itaraki is the hand net. Moto is a spear in that passage; the three words describe different fishing gear.", ["moto"]),
      card("An account of collecting balolo lists a bucket, itaraki and even bare hands. Is itaraki the creature being collected or a tool used to collect it?", ["A tool", "The creature"], "A tool", "Balolo is the creature in that account. Itaraki is one of the gathering tools.", ["balolo"])
    ], { label: "Read the reef-fishing school passage", href: "https://sangamedu.ac.fj/wp-content/uploads/2021/12/Home-Study-Package-Year-8-2.pdf" }),
    carawabobota: play("A stage before soft ripeness", "A Fiji school text uses carawabobota for fruit that has gone beyond its earlier ripening stage but has not yet become soft and fully ripe. Its story applies the word to vudi.", "carawabobota", [
      card("In the school story, carawabobota describes the vudi. Is the word naming the fruit's stage or a kind of fishing net?", ["The fruit's stage", "A fishing net"], "The fruit's stage", "The story describes vudi at a stage before soft ripeness. Itaraki, by contrast, is a hand net.", ["vudi", "itaraki"]),
      card("The text contrasts carawabobota with dreucavu, fruit fully ripe. Would you use both terms for exactly the same stage?", ["No", "Yes"], "No", "Carawabobota is nearly ripe but not yet soft; dreucavu marks fruit that has ripened fully. A fruit can pass from one stage to the next.", ["vudi"])
    ], { label: "Read the Fiji school word note", href: "https://fliphtml5.com/gjgbb/ixky/Na_Salavata_Ni_Nanuma_Lesu_Rua_Book/6/" }),
    "uga vule": play("The crab that comes back to shore", "A University of the South Pacific report writes this name as ugavule and identifies the coconut crab. Adults live on land, while females release larvae into the sea.", "uga vule", [
      card("If you find an adult uga vule in coastal forest, is its presence on land surprising for this species?", ["No", "Yes"], "No", "The report describes adult coconut crabs sheltering and foraging on land. They still depend on the sea at the larval stage.", ["lairo"]),
      card("Does the English name 'coconut crab' mean an uga vule eats only coconuts?", ["No", "Yes"], "No", "The Fiji report describes an omnivore that also eats other fruit, leaves and animals. A familiar name does not describe its whole diet.")
    ], { label: "Read Fiji's coconut-crab research", href: "https://www.usp.ac.fj/institute-of-marine-resources/wp-content/uploads/sites/138/2021/08/Coconut-Crab-Report-.pdf" }),
    "vosa vakavarada": play("When the setting changes the words", "Vosa vakavarada is informal or slang language. A Fijian interpreter guide recommends plain, widely understood wording when accuracy across speakers matters.", "vosa vakavarada", [
      card("In a medical conversation through an interpreter, would the guide favour vosa vakavarada or clear everyday wording?", ["Clear everyday wording", "Vosa vakavarada"], "Clear everyday wording", "The guide warns against slang in that setting because it may obscure the intended message. That does not mean friends never use informal language.", ["vosa"]),
      card("The guide lists uncommon terms, vosa vakavarada and idioms separately. Does calling something slang automatically make it an idiom?", ["No", "Yes"], "No", "They can all make interpretation harder, but slang and idioms are different kinds of expression. The context decides which description fits.")
    ], { label: "Read the Fijian interpreter guide", href: "https://anglicaresq.org.au/wp-content/uploads/2025/02/Fijian-E200010-Anglicare-Inclusive-Engagement-Toolkit.pdf" }),
    vosanisucu: play("A language a child grows into", "Vosanisucu is a mother-tongue term. A Fijian school text places it beside vosanisusu while urging families and schools to help children keep speaking their own language.", "vosanisucu", [
      card("The school text says 'nona vosanisucu se vosanisusu'. Is it naming two ways to refer to a child's mother tongue, or two kinds of fishing gear?", ["Two mother-tongue terms", "Fishing gear"], "Two mother-tongue terms", "The text uses se between the two names in a discussion of the child's language. Vosanisusu is another recorded form.", ["vosanisusu"]),
      card("If a child learns another language later at school, does vosanisucu automatically become the name of every language the child knows?", ["No", "Yes"], "No", "The term points to the language nurtured from early life. Someone may also learn and use other languages.", ["vosa", "sucu"])
    ], { label: "Read the school discussion of mother tongue", href: "https://fliphtml5.com/gjgbb/elah/Year_13_Nanuma_Lesu_Na_Noda_Vosa_13/7/" }),
    vosanisusu: play("Another way to name mother tongue", "Vosanisusu is recorded alongside vosanisucu in a Fijian school discussion of a child's own language. The pair offers two names in the same context, rather than a rule that every child speaks just one language.", "vosanisusu", [
      card("When the school text joins vosanisucu se vosanisusu, what does se help the reader recognise?", ["Alternative names here", "A new counting unit"], "Alternative names here", "The passage offers the two forms in the same mother-tongue discussion. It does not count languages or people.", ["vosanisucu"]),
      card("The passage asks adults to keep using a child's vosanisusu. Is its concern the child's language in daily life or only a word on a school list?", ["Language in daily life", "Only a list item"], "Language in daily life", "The text argues for continuing to speak and teach the language. The word carries a lived relationship, not just a vocabulary label.", ["vosa"])
    ], { label: "Read the Fijian school passage", href: "https://fliphtml5.com/gjgbb/elah/Year_13_Nanuma_Lesu_Na_Noda_Vosa_13/7/" }),
    vosararaba: play("The shared language and a family's variety", "Vosararaba names general Fijian used across communities. Fijian educators also distinguish this shared variety from the forms children learn at home and in their own communities.", "vosararaba", [
      card("If people from different districts use a shared Fijian variety, does vosararaba name that common form or one family's mother tongue?", ["The common form", "One family's mother tongue"], "The common form", "General Fijian helps communication across communities. A family's vosanisucu or vosanisusu may preserve local words and forms alongside it.", ["vosanisucu", "vosanisusu"]),
      card("A speaker uses general Fijian at school and a local variety at home. Must one erase the other?", ["No", "Yes"], "No", "Fijian language educators call for children's home varieties to be taught even while a common variety is used. Knowing both can serve different conversations.", ["vosa VakaViti Raraba"])
    ], { label: "Read the Fiji discussion of common and home varieties", href: "https://www.fbcnews.com.fj/news/use-of-vosa-vakabau-affects-itaukeis-mother-tongue/" }),
    "vosa vakaviti raraba": play("What VVR is meant to name", "Vosa VakaViti Raraba, or VVR, is the fuller name for a shared Fijian variety used across communities. The name leaves room to talk separately about local varieties and mother tongues.", "vosa VakaViti Raraba", [
      card("A worksheet asks for wording in Vosa VakaViti Raraba. Is it asking for a shared form or insisting on one family's local dialect?", ["A shared form", "One family's dialect"], "A shared form", "The phrase names a common variety. Local varieties remain real and may use different words or patterns.", ["vosararaba"]),
      card("If a child knows VVR and also a home variety, are VVR and that child's vosanisucu automatically identical?", ["No", "Yes"], "No", "A shared form may overlap with the home language without replacing its local vocabulary. Ask which form is used in the family's own speech.", ["vosanisucu"])
    ], { label: "See Vosa VakaViti Raraba in a school worksheet", href: "https://sangamedu.ac.fj/wp-content/uploads/2021/06/Vosa-VakaViti-Worksheet-5-3.pdf" }),
    "ka-": play("When a result is damaged", "Ka- appears in recorded forms such as kabasu, which describes something broken. The pattern is limited: a familiar prefix does not let us invent a new word from any base.", "ka-", [
      card("An object has broken: which recorded form belongs to the ka- family, kabasu or tasere?", ["Kabasu", "Tasere"], "Kabasu", "Kabasu names a broken result. Tasere is a different recorded form, used when something comes untied.", ["ta-"]),
      card("Does ka- in kabasu by itself tell you who broke the object?", ["No", "Yes"], "No", "The form draws attention to the broken result. A whole sentence and its context are needed to identify any person who caused it.", ["lau-"])
    ], { label: "Read a linguistic account of Fijian result forms", href: "https://openresearch-repository.anu.edu.au/bitstreams/8a27e093-c01d-4281-bfda-08fee7365afa/download" }),
    "ta-": play("When an event happens without naming an actor", "Tasere describes something coming untied. This recorded ta- form can report what happened without saying who, if anyone, brought it about.", "ta-", [
      card("In tasere, does the ta- form itself name the person who untied the thing?", ["No", "Yes"], "No", "The form reports the event or resulting state. Look at the whole phrase before deciding whether an actor is known."),
      card("Kabasu and tasere both describe results. Which one is the recorded ta- form?", ["Tasere", "Kabasu"], "Tasere", "Tasere belongs with ta-. Kabasu belongs with ka-, a different limited pattern associated here with a damaged result.", ["ka-"])
    ], { label: "Read about Fijian spontaneous forms", href: "https://openresearch-repository.anu.edu.au/bitstreams/8a27e093-c01d-4281-bfda-08fee7365afa/download" }),
    "ca-": play("A sound in the word", "Cabolo and calidi are recorded ca- forms associated with sounds. One can describe a loud report; the other can describe a sharp click or detonation. The complete word and context tell you which sound is meant.", "ca-", [
      card("A sudden loud report is described as cabolo. Does the ca- pattern point here to sound or to a place name?", ["Sound", "A place name"], "Sound", "The recorded example cabolo belongs to the sound-associated ca- family."),
      card("Can ca- alone tell you whether the sound is the loud report of cabolo or the sharper click that calidi can describe?", ["No", "Yes"], "No", "The prefix alone does not identify an exact sound. The rest of the word and its context matter; ca- is not a free recipe for coining new sound words.", ["ka-", "ta-"])
    ], { label: "Read about the Fijian ca- family", href: "https://openresearch-repository.anu.edu.au/bitstreams/8a27e093-c01d-4281-bfda-08fee7365afa/download" }),
    "tago-": play("Hear the word in beats", "In Fijian language teaching, a tago is a spoken syllable. A word can have a different number of letters and tago; the beat you hear is what matters here.", "tago-", [
      card("Say vosa slowly as vo-sa. Does it have two tago or four?", ["Two", "Four"], "Two", "Vo-sa has two spoken syllables, though vosa has four written letters.", ["vosa"]),
      card("Say vinaka as vi-na-ka. With a short final vowel, which syllable normally carries the main stress?", ["Na", "Vi"], "Na", "The middle syllable is next to last. Fijian stress often falls there when the final syllable is short; long final vowels and other patterns need their own check.", ["vinaka"])
    ], { label: "Read the Fijian teaching handbook on syllables", href: "https://paperzz.com/doc/8937213/fij101-hand-book" }),
    cabarakuraku: play("When haste costs you the message", "Cabarakuraku is more than moving fast: the explanation recorded in Fijian includes failing to hear properly what was said to you. A Fiji writer brought this older word back to readers in a 2025 column.", "cabarakuraku", [
      card("Someone walks quickly but listens carefully to an instruction. Is speed alone enough to show cabarakuraku?", ["No", "Yes"], "No", "The recorded explanation includes both quick movement and not hearing what was said properly. Speed by itself leaves out the important detail.", ["lako"]),
      card("The word appears in an older list discussed in a 2025 column. Does that prove every community uses it in everyday speech now?", ["No", "Yes"], "No", "A historical record establishes that the word was recorded, not how widely it is used today. A complete local example from a speaker would tell us more.")
    ], { label: "Read the Fiji Times discussion of older Fijian words", href: "https://www.fijitimes.com.fj/oqo-na-noqu-vosa/" }),
    matailalai: play("Small details, close attention", "Matailalai can point to fine detail. In a Fiji education notice, it qualifies itukutuku: the fuller information that readers can use to plan. A Fiji conservation plant list also uses it with leaves.", "matailalai", [
      card("A public notice promises itukutuku matailalai. Should you expect detailed information or just a list of tiny objects?", ["Detailed information", "Tiny objects"], "Detailed information", "In that setting, matailalai is about the level of detail in the information, not the physical size of a thing."),
      card("A plant list names drau ni danidani matailalai. Is the word qualifying written instructions or the leaves being described?", ["The leaves", "Written instructions"], "The leaves", "The same form appears in a different setting: a plant's leaves. Read the whole phrase before deciding whether fine detail is about text, workmanship or a visible feature.")
    ], { label: "See matailalai in a Fiji education notice", href: "https://www.education.gov.fj/wp-content/uploads/2025/05/Vosa-VakaViti-Translation_Education-Act_Public-Consultation-1.pdf" }),
    "adi senitoa": play("A flower in the name of a festival", "Adi Senitoa is used as a Fijian name for Fiji's Hibiscus Festival. A Fiji TV bilingual event list pairs the names; the senitoa flower also appears in Fiji's festival history.", "Adi Senitoa", [
      card("In Fiji TV's list of events it broadcast, Adi Senitoa is paired with which English event: the Hibiscus Festival or a rugby sevens tournament?", ["The Hibiscus Festival", "A rugby sevens tournament"], "The Hibiscus Festival", "The bilingual list names the same public festival in Fijian and English. Rugby sevens appears as a separate event in that list."),
      card("Does the senitoa in Adi Senitoa mean the festival has no connection to a real flower?", ["No", "Yes"], "No", "Senitoa also names hibiscus. A Pacific plant guide describes Fiji's hibiscus flower and a commemorative stamp celebrating the festival. The event name reaches beyond the plant itself.")
    ], { label: "See the Fiji TV bilingual event list", href: "https://announcements.spx.com.fj/ftp/news/021726927.PDF" }),
    imasuti: play("Who hears the call?", "An imasuti is the person named or addressed after an expressive call. In 'Isa na luvequ', the call is Isa and na luvequ identifies the child being addressed.", "imasuti", [
      card("In 'Isa na luvequ', which part identifies the person being addressed?", ["Na luvequ", "Isa"], "Na luvequ", "Isa is the expressive call; na luvequ points to the child. Together they show how the call can be directed to someone.", ["ikurau"]),
      card("Must an imasuti always be a personal name? Compare 'Sobo Setoki' with 'Isa na luvequ'.", ["No", "Yes"], "No", "The first example names Setoki; the second uses a relationship phrase, na luvequ. Both can identify whom the expressive call concerns.")
    ], { label: "Read a Fijian speaker's use of Isa na luvequ", href: "https://fijisun.com.fj/news/nation/mum-weeps-loss-of-baby-boy-after-house-burns" }),
    vuveisoli: play("An action between participants", "A vuveisoli is a vei- form that expresses an action between participants. Veiraici can describe people looking at one another; veibolebolei can involve challenging one another. The rest of the word matters as much as vei-.", "vuveisoli", [
      card("When a passage says 'e ratou sa veiraici', is it describing people looking at one another or a single person looking at a wall?", ["At one another", "At a wall"], "At one another", "The context describes several people facing and looking at one another. The action is shared among participants.", ["vei-"]),
      card("A historical account uses veibolebolei around warlike challenges. Does a vuveisoli have to be a friendly exchange?", ["No", "Yes"], "No", "Vei- can help express a two-way action, but the base and context tell us whether the participants are looking, challenging or doing something else.", ["vuwale"])
    ], { label: "See veibolebolei in a Fijian historical account", href: "https://www.fijitimes.com.fj/veikau-mai-nakauvadra-ki-vadranasiga-ko-tunakauvadra/" }),
    salanicagi: play("Follow the air", "Salanicagi names the passage that carries air on its way from the lungs toward the voice. A Fijian diagram of speech places it between yatevuso and the parts of the throat that shape sound.", "salanicagi", [
      card("In the diagram of the voice, does air reach the salanicagi from the yatevuso or from the bati?", ["Yatevuso", "Bati"], "Yatevuso", "The yatevuso are the lungs. The air then travels along the salanicagi; bati are teeth, farther along in shaping some sounds.", ["bati"]),
      card("Does salanicagi name the air passage or the uanidomo that vibrate when someone speaks?", ["The air passage", "The vibrating vocal folds"], "The air passage", "The diagram labels salanicagi as the route for air and uanidomo as the folds that can vibrate. Breathing supplies the air; vibration helps make the voiced sound.", ["cagi"])
    ], { label: "See the Fijian diagram of the voice", href: "https://cfp2.jw-cdn.org/a/a15420/1/o/be_FN.pdf#page=183" }),
    "rūrū": play("Listen to the r sound", "Rūrū is recorded as a name for the trilled r sound. A linguistic account describes Fijian r as ranging from a brief tongue tap to a longer trill; it treats dr separately.", "rūrū", [
      card("Does every Fijian r have to be held for a long roll?", ["No", "Yes"], "No", "The pronunciation account describes a range from a short tap to a trill. Listen to the speaker and the whole word, rather than fixing one length for every r."),
      card("When you see dr in a Fijian word, is it simply another way of writing the plain r sound?", ["No", "Yes"], "No", "The consonant account lists r and dr separately. The sound written dr has a nasal beginning, so the extra letter signals a real pronunciation difference.")
    ], { label: "Read the Fijian consonant account", href: "https://manifold.uhpress.hawaii.edu/projects/the-fijian-language" }),
    burogo: play("Which beetle is meant?", "An older Fijian word list calls burogo a small beetle with an unpleasant smell. A later Fijian translation uses the word in an article about a dung beetle. Those descriptions do not establish one scientific species for every use.", "burogo", [
      card("An older word list notes the smell of a burogo. Does that detail alone identify its scientific species?", ["No", "Yes"], "No", "Many beetles can have a noticeable smell. The older description does not give a species name, so a particular identification still needs local evidence.", ["manumanu"]),
      card("A Fijian article uses burogo for a dung beetle. Does that prove the older strong-smelling beetle and the article's dung beetle are one exact species?", ["No", "Yes"], "No", "The article is a translation about a dung beetle; the older list gives a different description. A shared Fijian label in these sources does not settle the insect's species.")
    ], { label: "See burogo in a Fijian article", href: "https://www.jw.org/fj/ka-e-vakarautaki/mekesini/g201406/" })
  };
  for (const [key, activity] of Object.entries(additions)) {
    if (Object.hasOwn(window.NAISEMA_WORD_PLAY, key)) throw new Error(`Repeated inquiry key: ${key}`);
    window.NAISEMA_WORD_PLAY[key] = activity;
  }
})();
