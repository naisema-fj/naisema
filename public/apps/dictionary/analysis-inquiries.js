// Tuvavosa questions grounded in the supplied teaching examples and checked school usage.
(() => {
  const card = (question, options, correct, answer, clues = []) => ({ question, options, correct, answer, clues });
  const play = (title, intro, word, cards, link) => ({ title, intro, cards: cards.map(item => ({ word, ...item })), ...(link ? { link } : {}) });
  const additions = {
    "dau-": play("A person formed from an activity", "Attached dau- can help make a word for someone who habitually does or knows an activity.", "dau-", [
      card("In dauqoli, which part points to a habitual or skilled person?", ["dau-", "qoli alone"], "dau-", "Dau- is attached to the base; dauqoli names a person associated with fishing.", ["dauqoli", "nauni"]),
      card("Is attached dau- in dauqoli the same written construction as a separate dau before a predicate?", ["No", "Yes"], "No", "The attached form builds a word for a person. Separate dau can indicate that an action happens habitually; the whole phrase decides its role.", ["dauqoli", "vu"])
    ]),
    dauqoli: play("One catch or a fisher?", "Dauqoli names a person associated with fishing as an occupation, habit, or skill.", "dauqoli", [
      card("If someone catches one fish once, does that single event by itself establish that they are a dauqoli?", ["No", "Yes"], "No", "The word suggests a habitual or skilled fisher, not merely one completed catch.", ["dau-", "ika"]),
      card("In dauqoli, does the whole word name the person or the fish?", ["The person", "The fish"], "The person", "The attached dau- helps form a person word; ika is a broad word for fish.", ["dau-", "ika"])
    ]),
    "kuri sosomi": play("Who is attached to the noun?", "A kuri sosomi identifies the related person or group in an attached form.", "kuri sosomi", [
      card("In na yavaqu, which ending identifies the speaker?", ["-qu", "na"], "-qu", "The ending attaches to yava. Na introduces the larger nominal phrase.", ["-qu", "mata"]),
      card("In na luveikeimami, is -ikeimami placed before luve as a separate possessive word?", ["No", "Yes"], "No", "It follows the base as an attached form. Na neimami gone uses a different, preposed possessive pattern.", ["nauni taukeni kuri", "taukeni sosomi"])
    ]),
    ikurisosomi: play("An ending or a separate word?", "Ikurisosomi concerns a person ending attached directly to a suitable nominal base.", "ikurisosomi", [
      card("In batiqu, is the speaker ending part of the written word?", ["Yes", "No"], "Yes", "Bati and -qu are written together. Na noqu vale expresses a different possessive pattern.", ["bati", "-qu"]),
      card("Does na neirau dra put the same ending directly on dra as na dakuikeirau puts on daku?", ["No", "Yes"], "No", "Neirau stands before dra; -ikeirau follows daku in a directly suffixed form. Similar ownership does not erase the different construction.", ["nauni taukeni kuri", "taukeni sosomi"])
    ]),
    "yavu ni matavu": play("Find the predicate's core", "The yavu carries the central meaning of a matavu; it is identified in the complete phrase.", "yavu ni matavu", [
      card("In Au sa lako mai, which word is the yavu?", ["lako", "sa"], "lako", "Au and sa precede it; mai follows it. Lako is the meaning-bearing base of this predicate phrase.", ["lako", "duru"]),
      card("Must every yavu ni matavu be a vu rather than a nauni?", ["No", "Yes"], "No", "A photographed teacher example places qasenivuli, a nominal base, in the yavu position. Read the phrase before naming its role.", ["nauni", "vu"])
    ]),
    "kilavu tale": play("A later place for some qualifiers", "Some qualifiers can follow the durumuri; another qualifier may be restricted to an earlier place.", "kilavu tale", [
      card("In Drau lako mai vakatotolo, which word is the later qualifier?", ["vakatotolo", "mai"], "vakatotolo", "Mai supplies direction; vakatotolo follows it and describes the manner of going.", ["vakatotolo", "durumuri"]),
      card("Can you move butako after tiko merely because vakatotolo can appear after mai?", ["No", "Yes"], "No", "The photographed contrast permits two positions for vakatotolo here but rejects that later position for butako. Check each word and phrase.", ["veitabui", "vakatotolo"])
    ]),
    "mataqali vu": play("Two tests for a predicate class", "The class depends on whether a dewa form occurs and what happens to the participants.", "mataqali vu", [
      card("Which pair keeps the runner as the actor-like participant?", ["cici / ciciva", "sogo / sogota"], "cici / ciciva", "The cited analysis uses this pair for vūtū, where the runner stays the runner across the contrast.", ["vūtū", "dewa"]),
      card("Which pair illustrates a shift in the closing thing's role?", ["sogo / sogota", "cici / ciciva"], "sogo / sogota", "The photographed vusaumaki contrast changes how the closing thing participates. The suffix alone cannot tell you the class.", ["vusaumaki", "vu dewa"])
    ]),
    "lawa cocoko": play("A restricted order", "Some word combinations allow only a tightly limited arrangement in a given construction.", "lawa cocoko", [
      card("In the cited contrast e rairai via lako, is *e via rairai lako offered as the same acceptable order?", ["No", "Yes"], "No", "The asterisk marks the rejected rearrangement in that teaching example. It is a specific contrast, not a universal ban on via.", ["duruliu", "veitabui"]),
      card("Does a restricted pair justify treating every Fijian phrase as fixed in the same way?", ["No", "Yes"], "No", "The position of vakatotolo around mai is more flexible in another cited phrase. A lawa cocoko applies where the actual construction restricts it.", ["lawa cicila", "kilavu tale"])
    ]),
    "lawa cicila": play("Where does the order have room?", "A lawa cicila permits variation in a particular phrase pattern; the permission is not automatic for every word.", "lawa cicila", [
      card("Are both Drau lako mai vakatotolo and Drau lako vakatotolo mai offered in the cited example?", ["Yes", "No"], "Yes", "The qualifier vakatotolo can occur on either side of mai in that recorded contrast.", ["vakatotolo", "kilavu tale"]),
      card("Does that mean butako can also move after tiko in its own example?", ["No", "Yes"], "No", "The source restricts butako in its own construction. Variation has to be checked with the actual qualifier.", ["lawa cocoko", "veitabui"])
    ]),
    semavosa: play("Inside a word or between words?", "Semavosa studies how bases and additions combine; a similar-looking piece may instead be a separate phrase word.", "semavosa", [
      card("In ilakolako, is i- attached to the repeated lako base?", ["Yes", "No"], "Yes", "The beginning is part of the derived word. The repetition must be examined with the whole form's meaning.", ["i-", "drua"]),
      card("Is the separate i in na luve i Jo attached to luve in the same way?", ["No", "Yes"], "No", "That i links a family relation to a name in a phrase; it is not the word-forming i- of ilakolako.", ["i", "taukeni kuri"])
    ]),
    "vosa veibasai": play("A contrast in meaning", "Vosa veibasai are words with opposed meanings in a given use.", "vosa veibasai", [
      card("In a Fijian school exercise, which answer contrasts with lelevu?", ["lalai", "vuqa"], "lalai", "The teacher's guide gives lelevu and lalai as an opposite pair. The words still need their sentence for precise use.", ["levu", "vuqa"]),
      card("If a task instead seeks a near meaning of vuqa, should you use vosa veibasai?", ["No", "Yes"], "No", "A near meaning belongs under vosa tautauvata; the guide pairs vuqa with levu for that task.", ["vosa tautauvata", "vuqa"])
    ], { label: "See a Fijian teacher's contrast and similarity exercises", href: "https://fliphtml5.com/gjgbb/znkq/Year_10_SALAVATA_NI_NANUMA_LESU_10_Teacher_s_Guide/" }),
    "vosa tautauvata": play("Near meaning, not automatic substitution", "Vosa tautauvata are words with similar meanings; the phrase still decides whether either fits.", "vosa tautauvata", [
      card("Which pair does a Fijian teacher's guide place together as near in meaning?", ["vuqa / levu", "lelevu / lalai"], "vuqa / levu", "The guide offers vuqa and levu as a similarity pair; lelevu and lalai are an opposite pair.", ["vuqa", "levu"]),
      card("Does that exercise prove vuqa and levu are interchangeable in every sentence?", ["No", "Yes"], "No", "A similarity exercise identifies a relation in meaning, not a licence to swap the words in every Fijian construction.", ["vosa veibasai", "matavosa"])
    ], { label: "Read the teacher's similarity examples", href: "https://fliphtml5.com/gjgbb/znkq/Year_10_SALAVATA_NI_NANUMA_LESU_10_Teacher_s_Guide/" }),
    veitacini: play("A relationship, not an action", "Veitacini names siblings in a particular kin relation; its vei- does not by itself mean that they are acting on each other.", "veitacini", [
      card("In Rau tawase na veitacini ena rakavi, is veitacini naming one person alone?", ["No", "Yes"], "No", "The news heading speaks of siblings on different sides in rugby. The word supplies the kin relationship.", ["vei-", "nauni"]),
      card("Does the vei- in veitacini automatically give the same mutual-action reading as in every vei- predicate?", ["No", "Yes"], "No", "Here the whole word names a kin relationship. The attached beginning has several uses across Fijian words.", ["vei-", "taukeni kuri"])
    ], { label: "Read veitacini in a Fiji news heading", href: "https://www.fijitimes.com.fj/rau-tawase-na-veitacini-ena-rakavi/" }),
    taucoko: play("Many or the whole total?", "Taucoko says complete or whole; in a count it can make clear that a number is the total.", "taucoko", [
      card("In e 105 taucoko na koro, is 105 presented as the total or as an extra 105?", ["The total", "An extra 105"], "The total", "The iTaukei Affairs account counts the province's villages in all.", ["wiliwili"]),
      card("If vuqa says there are many villages, does it also tell you the set is complete?", ["No", "Yes"], "No", "Vuqa says the number is large; taucoko speaks to completeness. The words answer different questions.", ["vuqa", "levu"])
    ], { label: "See taucoko in an iTaukei Affairs account", href: "https://tab.gov.fj/2025/10/30/siga-damu-a-vanua-dolava-na-bose-ni-yasana-o-macuata/" })
  };
  for (const [key, activity] of Object.entries(additions)) {
    if (Object.hasOwn(window.NAISEMA_WORD_PLAY, key)) throw new Error(`Duplicate dictionary inquiry: ${key}`);
    window.NAISEMA_WORD_PLAY[key] = activity;
  }
})();
