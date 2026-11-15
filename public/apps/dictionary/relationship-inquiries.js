// Entry-specific questions about possession, number, and word formation.
// Their full Fijian examples are checked against the Tuvavosa pages and
// independently published phrase patterns before being offered to readers.
(() => {
  const card = (question, options, correct, answer, clues = []) => ({ question, options, correct, answer, clues });
  const play = (title, intro, word, cards) => ({ title, intro, cards: cards.map(item => ({ word, ...item })) });
  const additions = {
    "matanauni taukeni": play("Which relationship is inside the phrase?", "A matanauni taukeni connects what is named with a person or another thing; the connection can be expressed in more than one place.", "matanauni taukeni", [
      card("In na vale nei Luke, does the phrase name the house or Luke alone?", ["The house linked to Luke", "Luke alone"], "The house linked to Luke", "Vale names the house; nei Luke identifies the person connected to it.", ["vale", "nei"]),
      card("If Luke says na noqu vale, where is the possessor signaled?", ["Before vale", "After vale as a name"], "Before vale", "Noqu points to the speaker before the base. The phrase can express the relationship without repeating Luke's name.", ["taukeni sosomi", "taukeni dina"])
    ]),
    "taukeni dina": play("Owned, made, or performed?", "Nei can connect a named person to a house, a song they sing, or another thing associated with them.", "taukeni dina", [
      card("In na vale nei Luke, is Luke the named person linked to the house?", ["Yes", "No"], "Yes", "Nei Luke identifies the person associated with the house; the phrase does not say who built it.", ["nei", "vale"]),
      card("In na sere nei Mere, is Mere the subject of the song or the one singing it?", ["The one singing it", "Only its subject"], "The one singing it", "Nei presents Mere as the performer in this example. Na sere kei Lia instead makes Lia the person the song is about.", ["kei", "taukeni bale"])
    ]),
    "taukeni bale": play("About someone, or intended for them", "Kei can point to a person whom a song concerns or for whom something is intended.", "taukeni bale", [
      card("In na sere kei Lia, is the song about Lia or sung by Lia?", ["About Lia", "Sung by Lia"], "About Lia", "Kei Lia makes Lia the person the song is about here; nei Mere in another phrase marks the performer.", ["kei", "nei"]),
      card("In na dai kei Leone, is Leone named as the trap's maker?", ["No", "Yes"], "No", "The trap is intended for Leone in this phrase. The same kei marker takes its precise reading from dai and the situation.", ["kei", "taukeni dina"])
    ]),
    "taukeni kana": play("Who is meant to eat it?", "Kei can link food or another consumable to the person meant to consume it.", "taukeni kana", [
      card("In na dalo kei Sami, does kei say Sami grew the taro?", ["No", "Yes"], "No", "Here the dalo is for Sami to eat. Ownership or growing would be a different relationship.", ["kei", "taukeni dina"]),
      card("Would na yaqona mei Tui use the same drinking relationship as na dalo kei Sami?", ["No", "Yes"], "No", "Mei marks a drink for Tui; kei marks food for Sami in these phrases. What is consumed guides the form.", ["mei", "taukeni gunu"])
    ]),
    "taukeni gunu": play("A drink for whom?", "Mei points to the person who will drink what the phrase names.", "taukeni gunu", [
      card("In na yaqona mei Tui, who is the intended drinker?", ["Tui", "The speaker"], "Tui", "Mei Tui names the person for whom the yaqona is to drink.", ["mei", "yaqona"]),
      card("Does na yaqona nei Jo say exactly the same thing as na yaqona mei Jo?", ["No", "Yes"], "No", "Nei can link Jo to yaqona as an owner or preparer. Mei makes Jo the intended drinker.", ["nei", "taukeni dina"])
    ]),
    "taukeni kuri": play("A close part or family link", "The named person can follow a body part or close relation after the separate linker i.", "taukeni kuri", [
      card("In na luve i Jo, does i Jo identify a parent or the child?", ["The parent", "The child"], "The parent", "Luve names the child; i Jo supplies the person to whom the child is related.", ["i", "ni"]),
      card("In na balu i Sisi dakoba, can dakoba be moved before i Sisi without changing this construction?", ["No", "Yes"], "No", "The relationship to Sisi is completed before dakoba qualifies balu. Read the full phrase before moving a description.", ["kilanauni", "matanauni taukeni"])
    ]),
    nei: play("Whose house, whose song?", "Nei before a name marks a general association; context tells you whether it is ownership, making, or performing.", "nei", [
      card("In na vale nei Luke, which piece introduces the named person?", ["nei", "na"], "nei", "Nei introduces Luke after the nominal base vale. Na opens the whole phrase.", ["taukeni dina", "mata"]),
      card("Would na sere kei Lia necessarily mean Lia sings it, as na sere nei Mere does?", ["No", "Yes"], "No", "Kei Lia makes the song about Lia; nei Mere presents Mere as its singer. The same English 'of' would hide this difference.", ["kei", "taukeni bale"])
    ]),
    kei: play("The same marker, different links", "Kei before a name can mark what concerns a person or what they are meant to consume.", "kei", [
      card("In na sere kei Lia, what is Lia's connection to the song?", ["It is about Lia", "Lia necessarily sings it"], "It is about Lia", "The phrase is about Lia. A singer can be expressed with nei in a different construction.", ["taukeni bale", "nei"]),
      card("In na dalo kei Sami, what changes from the song example?", ["The person is to eat it", "The person becomes a place name"], "The person is to eat it", "Dalo is food for Sami. The base and situation distinguish taukeni kana from taukeni bale even though both use kei.", ["taukeni kana", "dalo"])
    ]),
    mei: play("A drink set aside", "Mei before a named person marks a drink intended for that person.", "mei", [
      card("In na yaqona mei Tui, which piece points to Tui as the drinker?", ["mei", "na"], "mei", "Mei Tui follows yaqona and names who is meant to drink it.", ["taukeni gunu", "yaqona"]),
      card("If Jo instead owns the yaqona, would mei still be the clear choice?", ["No", "Yes"], "No", "For ownership, na yaqona nei Jo uses nei. Mei Jo would change the relationship to an intended drinker.", ["nei", "taukeni dina"])
    ]),
    i: play("A small linker, a close relationship", "I can link a body part or family member to the named person after it; check the full phrase before assigning that role.", "i", [
      card("In na luve i Jo, which separate word links luve to Jo?", ["i", "na"], "i", "I stands before Jo in this taukeni kuri phrase; na introduces the larger nominal phrase.", ["taukeni kuri", "mata"]),
      card("Does i Jo in na luve i Jo have the same relationship as nei Luke in na vale nei Luke?", ["No", "Yes"], "No", "I links a close relation here, while nei expresses a general association with Luke's house.", ["nei", "taukeni dina"])
    ]),
    ni: play("A common noun follows", "Ni can join one nominal base to another common-noun base, but it does not give one fixed English relationship.", "ni", [
      card("In na ulu ni vuaka, is vuaka a personal name like Jo?", ["No", "Yes"], "No", "Vuaka is the common nominal base for pig. Ulu names its head; ni links the two bases.", ["nauni raraba", "taukeni kuri"]),
      card("Does ni mean exactly the same relation in na vale ni koli and na ulu ni vuaka?", ["No", "Yes"], "No", "A house can belong to a dog; a head is a body part of a pig. Ni is the same visible linker, but the nouns determine the relationship.", ["vale", "vuaka"])
    ]),
    "no-/ne-": play("A general possessive link", "No- and ne- join person endings in forms for a general ownership or related action.", "no-/ne-", [
      card("In noqu vale, which piece says what kind of possessive link precedes -qu?", ["no-", "-qu"], "no-", "No- is the relationship element; -qu identifies the speaker. Vale names the house.", ["-qu", "vale"]),
      card("Does neitou include the listener merely because it ends in -itou?", ["No", "Yes"], "No", "Neitou points to the speaker's few-person group excluding the listener. An attached ending is not the same as free tou in another phrase.", ["keitou", "ikuri sosomi"])
    ]),
    "ke-": play("What is the person meant to do with it?", "Ke- can appear in possessive forms for something about a person or food meant for them.", "ke-", [
      card("In kemu uvi, is the food meant for the listener to eat or drink?", ["Eat", "Drink"], "Eat", "Uvi is food. Ke- in kemu fits the eating relationship; -mu identifies the listener.", ["taukeni kana", "ikuri sosomi"]),
      card("In keda vere, does the same ke- have to mean food?", ["No", "Yes"], "No", "Vere is a plan or plot concerning the group; ke- also appears in a taukeni bale relationship.", ["taukeni bale", "taukeni kana"])
    ]),
    "me-": play("When the item is a drink", "Me- appears before person endings in possessive forms for a drink intended for someone.", "me-", [
      card("In memudou ti, which part marks the drinking relationship?", ["me-", "-mudou"], "me-", "Me- marks the relationship to tea as a drink; -mudou identifies the listeners.", ["taukeni gunu", "ikuri sosomi"]),
      card("Would ke- in kemu uvi be the same drinking marker as me-?", ["No", "Yes"], "No", "Kemu uvi concerns food to eat. Memudou ti concerns tea to drink; the first element differs.", ["ke-", "taukeni kana"])
    ]),
    "-qu": play("Where is 'my' attached?", "The ending -qu can attach directly to a body-part noun, while a house uses a different possessive form.", "-qu", [
      card("In na batiqu, is -qu attached to bati or standing before it as a separate word?", ["Attached", "Separate"], "Attached", "Batiqu puts the speaker ending on bati, the teeth.", ["bati", "ikurimuri"]),
      card("Can you normally make 'my house' by writing *valequ on the pattern of batiqu?", ["No", "Yes"], "No", "For the house use na noqu vale; direct -qu attachment belongs to a different relationship class here.", ["vale", "taukeni sosomi"])
    ]),
    vica: play("A question or a small number", "Vica can ask for a count or state an indefinite small number; the sentence tells you which.", "vica", [
      card("In E vica na roti o kania?, is the speaker asking how many or saying several?", ["Asking how many", "Saying several"], "Asking how many", "The question asks how many roti were eaten. Vica asks for the number here.", ["wiliwili", "rua"]),
      card("In E vica na koro, does vica name an exact count like rua?", ["No", "Yes"], "No", "It gives a few or several villages without specifying an exact number.", ["rua", "vuqa"])
    ]),
    vuqa: play("Many, but how many?", "Vuqa expresses a large number without giving an exact count.", "vuqa", [
      card("Does vuqa tell you an exact number as ciwa does?", ["No", "Yes"], "No", "Ciwa is nine; vuqa leaves the amount open while saying there are many.", ["ciwa", "wiliwili"]),
      card("Which is the closer contrast to vuqa: vica as 'a few' or rua as 'two'?", ["vica as 'a few'", "rua as 'two'"], "vica as 'a few'", "Vica and vuqa can both give inexact quantities, but one suggests a few and the other many.", ["vica", "levu"])
    ]),
    levu: play("Size or quantity?", "Levu may describe a large thing or contribute a large-quantity reading; inspect what it qualifies.", "levu", [
      card("In na vale levu, is levu about the house's size or a count of houses?", ["Its size", "A count"], "Its size", "Levu follows vale and describes a large house in this nominal phrase.", ["vale", "kilanauni vu"]),
      card("In E levu na koro, does levu mean one large village?", ["No", "Yes"], "No", "The phrase concerns a large number of villages. The same form can contribute quantity rather than the size of one building.", ["wiliwili", "vuqa"])
    ]),
    "vei-": play("Together, toward each other, or a group", "Vei- is a clue to more than one word-building pattern; check the full derived word.", "vei-", [
      card("In rau sā veidomoni, does the action involve the two people toward each other?", ["Yes", "No"], "Yes", "Veidomoni expresses a mutual relationship here. The whole word, not vei- alone, carries this reading.", ["vuveisoli", "ikuriliu"]),
      card("Does veidogo, a stand of mangroves, mean two mangroves acting on each other?", ["No", "Yes"], "No", "Here vei- helps form a collective or place-related noun from dogo. The prefix has different effects in different words.", ["dogo", "nauni raraba"])
    ]),
    "vaka-": play("One beginning, several effects", "Vaka- can help form a causative action or a manner word; a complete word decides which.", "vaka-", [
      card("In vakalevutaka, does the longer form make something become large or merely name a large thing?", ["Make it large", "Merely name it"], "Make it large", "Vaka- participates in a causative formation with levu here; the complete form matters.", ["levu", "vuvakavu"]),
      card("Does vakatotolo express that same 'make large' effect?", ["No", "Yes"], "No", "Vakatotolo expresses quick manner. Compare whole derived words before giving vaka- a meaning.", ["vakatotolo", "kilavu tale"])
    ]),
    "i-": play("A noun built from an action", "I- can help form a noun from a predicate base, but the result needs its own checked meaning.", "i-", [
      card("In ilakolako, which part is the attached beginning before repeated lako?", ["i-", "na"], "i-", "The word combines i- with repeated lako and can name a journey.", ["ilakolako", "drua"]),
      card("Is i- inside ilakolako the same as separate i before Jo in na luve i Jo?", ["No", "Yes"], "No", "The first is attached to a derived word; the second links a family relation to a name inside a phrase.", ["i", "taukeni kuri"])
    ]),
    veitabui: play("Which orders are blocked?", "A veitabui restriction applies to a particular combination or order; check the two forms together.", "veitabui", [
      card("Can era yabe vata yani be reordered as era yabe yani vata here?", ["No", "Yes"], "No", "For this meaning, vata precedes the direction word yani.", ["yani", "durumuri"]),
      card("In sā curuma cake tiko, can tiko move before cake without changing this construction?", ["No", "Yes"], "No", "Cake gives upward direction before tiko marks continuation. Their order matters here.", ["cake", "tiko"])
    ]),
    "vūtū": play("Does the actor stay the same?", "In this vu class, the base can stand without dewa and the actor remains the actor when a dewa form is used.", "vūtū", [
      card("Across cici and ciciva, does the runner stop being the actor?", ["No", "Yes"], "No", "The runner remains the actor-like participant in both constructions.", ["cici", "sau"]),
      card("Is that the same participant shift illustrated by sogo and sogota?", ["No", "Yes"], "No", "Sogo and sogota illustrate a different class, vusaumaki, where the closing thing can shift to the affected role.", ["vusaumaki", "qali"])
    ]),
    druabalavu: play("Which part repeats?", "Druabalavu repeats a longer part of a base; the new word's meaning still needs its own context.", "druabalavu", [
      card("In culacula, which complete part is repeated?", ["cula", "cu"], "cula", "Cula repeats as a whole: cula + cula. This is the longer repetition pattern.", ["drua", "drualeka"]),
      card("Does lelewa show the same whole-base repetition as culacula?", ["No", "Yes"], "No", "Lelewa repeats a shorter opening part instead. Compare its shape with the full cula repeat.", ["drualeka", "drua"])
    ]),
    drualeka: play("A short repeat at the start", "Drualeka repeats a shorter part rather than the whole base.", "drualeka", [
      card("In kekeli, which opening part is repeated?", ["ke", "keli"], "ke", "Ke repeats before keli; this is a shorter repeated span.", ["drua", "druabalavu"]),
      card("Is cula + cula in culacula another drualeka?", ["No", "Yes"], "No", "It repeats the whole base and belongs to the longer druabalavu pattern.", ["druabalavu", "yavu drua"])
    ])
  };
  for (const [key, activity] of Object.entries(additions)) {
    if (Object.hasOwn(window.NAISEMA_WORD_PLAY, key)) throw new Error(`Duplicate dictionary inquiry: ${key}`);
    window.NAISEMA_WORD_PLAY[key] = activity;
  }
})();
