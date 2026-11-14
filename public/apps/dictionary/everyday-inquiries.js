// Two distinct, checked inquiries for ordinary words. Questions stay with the starting entry.
(() => {
  const card = (question, options, correct, answer, clues = []) => ({ question, options, correct, answer, clues });
  const play = (title, intro, word, cards, link) => ({ title, intro, cards: cards.map(item => ({ word, ...item })), ...(link ? { link } : {}) });
  const additions = {
    drano: play("An inland place, not a water quality", "Drano names an inland lake or related standing-water place. Dranu, with a different final vowel, describes freshwater.", "drano", [
      card("If a story leads you to a drano, are you looking for an inland water place or simply a glass without salt?", ["An inland water place", "A glass without salt"], "An inland water place", "The word names a lake, pond, or freshwater swamp depending on the variety; dranu describes the water's fresh quality.", ["dranu"]),
      card("Bauan drano can include a freshwater swamp; Wayan drano can include a pond. What stays shared?", ["An inland standing-water place", "A saltwater fish"], "An inland standing-water place", "The comparative record shows related but not identical ranges in the two Fijian varieties.", ["dranu", "ika"])
    ], { label: "See drano across Fijian varieties", href: "https://openresearch-repository.anu.edu.au/bitstreams/2c665103-7937-4d1b-87a4-1939b258f782/download" }),
    buta: play("When is it ready?", "Buta can describe food that is cooked; other recorded senses concern removing cooked food or heat affecting skin.", "buta", [
      card("In Sa buta na kakana? (‘Is the food cooked?’), what is being checked?", ["Whether the food is ready", "Whether the pot is empty"], "Whether the food is ready", "Buta concerns the food's cooked state in this question. A different construction can use buta for taking cooked food out.", ["kakana"]),
      card("If a description says skin is buta, would you read it as a meal ready to eat?", ["No", "Yes"], "No", "The historical skin sense concerns scorching or blistering. The surrounding noun changes which sense of buta fits.", ["matanauni"])
    ], { label: "See the cooked-food question in use", href: "https://www.learnfijian.org/phrases" }),
    ca: play("Bad in which way?", "Ca can judge damage, poor condition, or moral wrong; context tells you how strong the judgment is.", "ca", [
      card("In the public phrase e ca na nomu basikeli (‘your bicycle is damaged’), is the bicycle being called morally evil?", ["No", "Yes"], "No", "Here ca describes something wrong with the bicycle. Moral judgment is another use, not the reading forced by every object.", ["basikeli"]),
      card("If ca names badness or harm itself, is that the same use as describing a damaged bicycle?", ["No", "Yes"], "No", "The dictionary keeps the quality or harm sense apart from the descriptive use. A complete phrase shows which one is active.", ["nauni", "matavu"])
    ], { label: "Read ca with basikeli in a Fiji speech", href: "https://www.pmoffice.gov.fj/prime-minister-josaia-voreqe-bainimaramas-statement-na-i-lalakai-program-sigatabu-6-jiune-2021-itaukei-translation/" }),
    cadra: play("A sunrise and a new beginning", "Cadra can describe a heavenly body rising; it can also evoke something new appearing.", "cadra", [
      card("In na cadra ni dua na matanisiga vou (‘the dawn of a new sun’), is cadra about an arrival or a sunset?", ["An arrival or rising", "A sunset"], "An arrival or rising", "A Fiji report uses the rising-sun image for a new beginning. The astronomical meaning makes the metaphor work.", ["siga"]),
      card("Does cadra only apply to the sun, never to the moon or an emerging tooth?", ["No", "Yes"], "No", "The recorded meaning includes other things coming into view or through a surface. The phrase identifies what is emerging.", ["matavu"])
    ], { label: "See the rising-sun image in a Fiji report", href: "https://www.parliament.gov.fj/wp-content/uploads/2022/08/iTaukei-Trust-Fund-Board-Annual-Report-2020.pdf" }),
    dredre: play("The task, or the time?", "Dredre says something is difficult; it can describe a job to do or a hard period of life.", "dredre", [
      card("If a report calls a year yabaki dredre (‘a difficult year’), is it weighing the year on a scale?", ["No", "Yes"], "No", "Dredre describes hardship or difficulty. Bibi can mean physically heavy or serious; that is a different starting image.", ["bibi"]),
      card("When a task is dredre, does the word by itself say that the task is impossible?", ["No", "Yes"], "No", "Difficult is not the same as impossible. Rawa concerns whether something can be done.", ["rawa"])
    ], { label: "Read yabaki dredre in a Fiji annual report", href: "https://www.parliament.gov.fj/wp-content/uploads/2022/08/iTaukei-Trust-Fund-Board-Annual-Report-2020.pdf" }),
    yawa: play("Distance, or a fish?", "Yawa can express distance. A separate recorded sense uses the same spelling for a coastal fish.", "yawa", [
      card("In a question about the yawa between a village and Suva, which sense fits?", ["Distance", "A fish"], "Distance", "The question asks how far the village is from Suva; it does not identify a fish.", ["gauna", "ika"]),
      card("If a speaker names an animal as yawa, can the distance meaning identify its species?", ["No", "Yes"], "No", "The fish sense has its own identification questions. One spelling can carry unrelated senses, and the complete context matters.", ["ika", "saku vorowaqa"])
    ], { label: "See a Fijian question about distance", href: "https://www.learnfijian.org/phrases" }),
    lade: play("A leap is more specific than travel", "Lade focuses on jumping or leaping; lako can speak more broadly of going.", "lade", [
      card("If someone moves by leaving the ground in a leap, which word captures that movement?", ["lade", "lako alone"], "lade", "Lade identifies the leap. Lako can say someone goes without telling you that they jump.", ["lako"]),
      card("Does lade alone tell you where a person lands?", ["No", "Yes"], "No", "The landing place has to come from more context. A motion word need not specify a destination.", ["matavu", "lako"])
    ]),
    tale: play("Returning, or doing it again?", "Tale adds a return or repetition idea in context; its precise reading depends on the surrounding action.", "tale", [
      card("In Au na qai lesu tale mai nimataka (‘I will come back tomorrow’), what does tale reinforce?", ["Coming back", "Leaving for good"], "Coming back", "Lesu mai already points to returning; tale makes the return idea explicit in this sentence.", ["nimataka", "lako"]),
      card("If tale accompanies a different action, must it always mean physical travel back?", ["No", "Yes"], "No", "With another predicate it can mark doing something again. Read the action beside it.", ["vu", "rawa"])
    ], { label: "Read a return-tomorrow sentence", href: "https://www.learnfijian.org/phrases-topics/time-plans?comp-mktaw2y1_page=2" }),
    rawa: play("Possible is not completed", "Rawa can concern ability or possibility after a predicate. It does not itself report a finished event.", "rawa", [
      card("If a plan says it can be done, does rawa by itself prove it has already happened?", ["No", "Yes"], "No", "Rawa expresses possibility or ability; another marker or context is needed for a completed event.", ["sa", "duru"]),
      card("Which word better tests whether a difficult task is achievable: rawa or dredre?", ["rawa", "dredre"], "rawa", "Dredre says it is hard; rawa addresses whether it can be done. Both can be true of one task.", ["dredre"])
    ], { label: "Read rawa in a Fiji audit report", href: "https://www.parliament.gov.fj/wp-content/uploads/2021/12/188-OAG-Performance-Audit-on-the-Monitoring-of-Implementation-of-the-Sugarcane-Development-and-Farmers-Assistance-Program.pdf" }),
    sara: play("Very, or a fish name?", "Sara can strengthen an expression. A separate fish entry shares the spelling; the setting tells you which one is meant.", "sara", [
      card("In a statement saying an issue is bibi sara (‘very serious’), which sara sense fits?", ["An intensifier", "A silverside fish"], "An intensifier", "The issue is being described as very serious. The fish sense belongs to a different context.", ["bibi", "ika"]),
      card("If a catch list includes sara beside other fish, should you read it as ‘very’?", ["No", "Yes"], "No", "In a fish list the separate animal sense may be intended. The nearby words disambiguate the spelling.", ["ika", "kawakawa"])
    ]),
    nanoa: play("Look one day back", "Nanoa locates an event yesterday. It is a time expression, not a hidden na- prefix plus a separate base.", "nanoa", [
      card("In Au a yaco mai nanoa (‘I arrived yesterday’), when did the arrival happen?", ["Yesterday", "Tomorrow"], "Yesterday", "The time word nanoa locates the arrival before today.", ["nikua", "nimataka"]),
      card("Does the written start of enanoa prove that nanoa begins with the noun-phrase marker na?", ["No", "Yes"], "No", "The Tuvavosa time analysis treats enanoa or nanoa as a whole time expression, rather than splitting its letters into invented markers.", ["matanauni gauna", "mata"])
    ], { label: "Read a yesterday sentence", href: "https://www.learnfijian.org/phrases-topics/time-plans?comp-mktaw2y1_page=2" }),
    edaidai: play("Today, or the present time", "Edaidai can point to today or, in context, the present period. It is grouped with Fijian time expressions.", "edaidai", [
      card("If edaidai contrasts with nanoa, which time is on the current side?", ["edaidai", "nanoa"], "edaidai", "Nanoa means yesterday; edaidai points to today or the present.", ["nanoa", "nikua"]),
      card("Does the initial e in edaidai automatically make e a separate noun-phrase marker?", ["No", "Yes"], "No", "The recorded Tuvavosa analysis treats edaidai as a whole matanauni gauna without a separately identified mata.", ["matanauni gauna", "mata"])
    ], { label: "See the paired time words in a Fijian text", href: "https://www.churchofjesuschrist.org/bc/content/shared/content/fijian/pdf/language-materials/59012_fij.pdf" }),
    nikua: play("Today is the reference point", "Nikua is today. Comparing it with nanoa and nimataka creates a useful three-day sequence.", "nikua", [
      card("In the recorded contrast nimataka, sega ni nikua (‘tomorrow, not today’), which word identifies today?", ["nikua", "nimataka"], "nikua", "The clause explicitly rejects today and chooses tomorrow.", ["nimataka", "nanoa"]),
      card("If an event is put at nikua, has the word alone told you whether it happened earlier or later in this day?", ["No", "Yes"], "No", "Nikua locates the day, not the exact hour or completion status. More of the sentence must supply those.", ["gauna", "duru"])
    ], { label: "Read the today–tomorrow contrast in a USP study", href: "https://repository.usp.ac.fj/id/eprint/13296/1/The_Fijian_Transitive_Ending_-%28C%29aki_a_in_Loan_Words.pdf" }),
    nimataka: play("A day ahead", "Nimataka points to tomorrow. It does not itself say that a future plan is certain.", "nimataka", [
      card("In Au na kania na apolo nimataka (‘I will eat the apple tomorrow’), which word sets the day?", ["nimataka", "na"], "nimataka", "Nimataka supplies tomorrow; the other words tell you what is planned.", ["nikua", "apolo"]),
      card("In the contrast nimataka, sega ni nikua, are both words names for the same day?", ["No", "Yes"], "No", "The speaker contrasts tomorrow with today. The words are distinct time expressions.", ["nikua", "matanauni gauna"])
    ], { label: "Read a tomorrow sentence", href: "https://www.learnfijian.org/phrases-topics/time-plans?comp-mktaw2y1_page=2" }),
    bibi: play("Weight can be physical or serious", "Bibi can describe something heavy in weight or important and serious in discussion.", "bibi", [
      card("When Parliament speaks of an ulutaga bibi (‘important topic’), is it weighing a physical object?", ["No", "Yes"], "No", "The topic is serious or weighty in importance, not heavy on a scale.", ["matavu", "sara"]),
      card("If an object is bibi to carry, is that the same use as calling an issue bibi?", ["No", "Yes"], "No", "The first concerns physical weight; the second concerns significance. The shared word invites a metaphor, but the contexts remain different.", ["dredre"])
    ], { label: "Read ulutaga bibi in Fiji parliamentary debate", href: "https://parliament.gov.fj/wp-content/uploads/2023/08/Daily-Hansard-Tuesday-11th-July-2023-1.pdf" }),
    ilavo: play("Money, or an amount?", "Ilavo names money; a phrase may then specify who holds it, earns it, or uses it.", "ilavo", [
      card("In a public discussion of ilavo votai (‘allocated money’), has ilavo itself told you the amount?", ["No", "Yes"], "No", "The word names money; the allocation and amount come from surrounding words and figures.", ["wiliwili", "taukeni dina"]),
      card("If a sentence says someone has ilavo, can you infer whether it was earned, donated, or borrowed from ilavo alone?", ["No", "Yes"], "No", "Ilavo identifies the resource, not its history. The action and context establish that relationship.", ["matavu", "dinau"])
    ], { label: "See ilavo votai in a Fiji audit report", href: "https://www.parliament.gov.fj/wp-content/uploads/2021/12/188-OAG-Performance-Audit-on-the-Monitoring-of-Implementation-of-the-Sugarcane-Development-and-Farmers-Assistance-Program.pdf" }),
    vuaka: play("The animal and its food sense", "Vuaka names a pig; in a food setting it can also refer to pork.", "vuaka", [
      card("If a vuaka is running in a yard, which sense fits?", ["The living pig", "Cooked pork"], "The living pig", "The animal is alive in that context. A meal setting can select the meat sense.", ["manumanu", "kakana"]),
      card("Does a record of vuaka among Fijian food taboos automatically mean every community treats pigs identically?", ["No", "Yes"], "No", "The research records local food knowledge and variation; the word for the animal does not dictate a universal custom.", ["kakana"])
    ], { label: "Explore research on Fiji food knowledge", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2992713/" }),
    basikeli: play("A bicycle in a Fijian sentence", "Basikeli is a bicycle. Its final vowel belongs to the adapted Fijian word.", "basikeli", [
      card("In kevaka e ca na nomu basikeli (‘if your bicycle is damaged’), what does basikeli name?", ["The bicycle", "The damage"], "The bicycle", "Ca describes its bad condition; basikeli names the vehicle.", ["ca", "nauni"]),
      card("Would the English spelling bicycle be the same written Fijian word as basikeli?", ["No", "Yes"], "No", "The borrowing has been adapted to Fijian sound and spelling patterns; the dictionary keeps the Fijian form.", ["vosa", "ca"])
    ], { label: "See basikeli in a Fiji public statement", href: "https://www.pmoffice.gov.fj/prime-minister-josaia-voreqe-bainimaramas-statement-na-i-lalakai-program-sigatabu-6-jiune-2021-itaukei-translation/" }),
    bebe: play("A flying insect, not one species", "Bebe can name a butterfly and in some regional speech a moth; the word is broader than one scientific species.", "bebe", [
      card("Does bebe alone identify Fiji's endemic swallowtail, Papilio schmeltzii?", ["No", "Yes"], "No", "The Fiji study identifies that particular species; bebe is a broader insect word and does not give a species name by itself.", ["manumanu"]),
      card("If a speaker uses bebe for a night-flying moth, must that invalidate the butterfly sense?", ["No", "Yes"], "No", "Some regional usage covers moths too. Ask which insect the speaker means instead of assuming one English label everywhere.", ["manumanu", "vosa"])
    ], { label: "Explore a Fiji butterfly study", href: "https://fiji.wcs.org/LinkClick.aspx?fileticket=SyHrNMCR7j0%3D&tabid=3427" }),
    drokadroka: play("A green word in the landscape", "Drokadroka names green, especially of vegetation; a green plant is a good place to test the colour sense.", "drokadroka", [
      card("If a leaf is described as drokadroka, is the word pointing to colour or the leaf's size?", ["Colour", "Size"], "Colour", "It gives the green colour. Levu or lailai can instead describe size in a suitable phrase.", ["levu", "nauni qali"]),
      card("Can you prove that drokadroka simply means ‘twice as green’ by its repeated shape?", ["No", "Yes"], "No", "A repeated-looking word needs its own checked meaning. Here the whole word means green; drua does not supply a fixed multiplication rule.", ["drua"])
    ], { label: "See green in a Fijian word list", href: "https://ldtcsites.org/languages/fijian/wordlist.html" }),
    bukete: play("A person and a condition", "Bukete can describe a pregnant person and can also name pregnancy as a condition.", "bukete", [
      card("If bukete describes a person, is it naming the person’s condition or a food?", ["The condition", "A food"], "The condition", "The descriptive sense is about pregnancy. A full phrase is needed to identify the person involved.", ["matanauni", "vu"]),
      card("If a sentence discusses bukete as a state, does that force every occurrence to be the same phrase role?", ["No", "Yes"], "No", "The same spelling has both a descriptive and a nominal use in the reviewed entries. The complete Fijian phrase settles the role.", ["nauni", "matavu"])
    ]),
    moku: play("A hit is not a blame", "Moku concerns striking or hitting. Beitaka concerns laying blame on someone.", "moku", [
      card("If someone is physically struck, which word is closer: moku or beitaka?", ["moku", "beitaka"], "moku", "Moku names a physical hit; beitaka assigns blame. They are different actions.", ["beitaka"]),
      card("Does moku alone identify the exact body part hit or the way the blow was delivered?", ["No", "Yes"], "No", "A fuller phrase would need to provide the target and manner. Do not turn the broad word into a specific slap without that context.", ["matavu", "dewa"])
    ]),
    caga: play("Measure with your hand", "Caga is a hand span, a length measured between the outstretched thumb and little finger.", "caga", [
      card("If a mat is two caga wide, are you counting two hand spans or two whole hands laid flat?", ["Two hand spans", "Two flat hands"], "Two hand spans", "The unit uses the distance between fingertips when the hand is stretched.", ["wiliwili"]),
      card("Would one person's caga necessarily equal another person's in centimetres?", ["No", "Yes"], "No", "The unit is based on a person's hand, so its physical length can vary. It is a traditional measure, not a fixed centimetre value.", ["wiliwili"])
    ], { label: "Explore the comparative record for caga", href: "https://pollex.org.nz/entry/haga.1/" }),
    bite: play("Dew is not a rainfall", "Bite is dew: moisture that forms on a surface overnight, especially when it cools.", "bite", [
      card("If grass is wet with bite at dawn, must rain have fallen in the night?", ["No", "Yes"], "No", "Dew can form by condensation on a cool surface without rainfall.", ["gauna"]),
      card("Is bite a time word like nanoa, or the moisture you might notice in the morning?", ["The moisture", "A time word"], "The moisture", "Nanoa places an event yesterday; bite names a physical substance or condition on a surface.", ["nanoa", "matanauni gauna"])
    ]),
    vumatua: play("When vaka- strengthens an action", "Vumatua labels a vaka- use that strengthens the action or quality of its base.", "vumatua", [
      card("In this Tuvavosa use, does vaka- intensify the base or make someone else cause it?", ["Intensify the base", "Make someone else cause it"], "Intensify the base", "The latter is the vuvakavu pattern. The whole recorded word and phrase decide which use applies.", ["vaka-", "vuvakavu"]),
      card("Can you label every new vaka- word vumatua solely because it begins with those letters?", ["No", "Yes"], "No", "Vaka- has several functions. A complete attested form and phrase are needed before assigning this stronger-action reading.", ["vaka-", "matavu"])
    ], { label: "Read a Fijian grammar on vaka- uses", href: "https://manifold.uhpress.hawaii.edu/projects/the-fijian-language" }),
    vuvakavu: play("When vaka- brings about a result", "Vuvakavu labels a vaka- use that makes an event or state happen.", "vuvakavu", [
      card("Does this use of vaka- point to causing a result or simply making a base more intense?", ["Causing a result", "Only making it stronger"], "Causing a result", "Strengthening is the separate vumatua use. Neither label follows automatically from the prefix alone.", ["vaka-", "vumatua"]),
      card("Before calling a whole word vuvakavu, what should you inspect?", ["Its base and complete phrase", "Only its first four letters"], "Its base and complete phrase", "The added prefix is a clue; the recorded word and its participants show whether causation is involved.", ["vaka-", "matavu"])
    ], { label: "Read a Fijian grammar on causative vaka-", href: "https://manifold.uhpress.hawaii.edu/projects/the-fijian-language" })
  };
  for (const [key, activity] of Object.entries(additions)) {
    if (Object.hasOwn(window.NAISEMA_WORD_PLAY, key)) throw new Error(`Duplicate dictionary inquiry: ${key}`);
    window.NAISEMA_WORD_PLAY[key] = activity;
  }
})();
