// Phrase questions remain inside their dictionary entries. The Fijian forms
// below come from the project's reviewed Tuvavosa examples and charts.
// A possible answer is never treated as a newly attested sentence.
(() => {
  const card = (question, options, correct, answer, clues = []) => ({question, options, correct, answer, clues});
  const play = (title, intro, word, cards) => ({title, intro, cards: cards.map(item => ({word, ...item}))});

  const additions = {
    duru: play("Find the supporting pieces", "A duru works alongside a yavu inside a phrase; its position and job matter.", "duru", [
      card("In Au sa lako, which pieces support the base lako?", ["Au and sa", "Lako alone"], "Au and sa", "Au identifies the speaker and sa marks time or aspect; lako is the yavu they accompany.", ["durusau", "yavu"]),
      card("Must every duru come before the base?", ["No", "Yes"], "No", "No. A durumuri such as mai can follow lako. Duruliu and durumuri name different positions.", ["duruliu", "durumuri"])
    ]),
    duruliu: play("Before the base", "Duruliu names the supporting position before a predicate's yavu.", "duruliu", [
      card("In Au sa lako, where are au and sa relative to lako?", ["Before it", "After it"], "Before it", "They are duruliu in this phrase. Their separate jobs are not erased by their shared position.", ["durusau", "duru"]),
      card("In Au sa lako mai, is mai another duruliu?", ["No", "Yes"], "No", "Mai follows the base, so examine it as a durumuri rather than moving it into the earlier slot.", ["durumuri", "lako"])
    ]),
    durumuri: play("After the base", "A durumuri follows the main base and can add direction or another nuance.", "durumuri", [
      card("Which word follows lako in Au sa lako mai?", ["mai", "sa"], "mai", "Mai comes after the base and adds direction. Sa precedes the base.", ["lako", "duruliu"]),
      card("In Oni bula vinaka sara, which final word comes after vinaka?", ["sara", "Oni"], "sara", "The analyzed phrase places sara after vinaka as a following duru; Oni refers to the addressee.", ["bula", "kilavu vu"])
    ]),
    durusau: play("Who is doing it?", "Durusau points to the participant by person and number within a matavu.", "durusau", [
      card("In Au sa lako, which word points to the speaker?", ["Au", "Lako"], "Au", "Au is durusau in this matavu. Lako supplies the predicate base.", ["au", "vu"]),
      card("In Era lade e na marau, does Era point to one speaker or a group?", ["A group", "One speaker"], "A group", "Era points to several people in this phrase. Compare au in Au sa lako before choosing the actor marker.", ["era", "au"])
    ]),
    dewa: play("What changes on the predicate?", "A dewa is an attached ending on certain predicate bases; the affected participant helps choose the form.", "dewa", [
      card("Which form stands before the personal name Jo: raici or raica?", ["raici", "raica"], "raici", "Au raici Jo tiko has -i with the personal name immediately after the predicate. The whole phrase determines the choice.", ["nauni qali", "vu dewa"]),
      card("Which form occurs in Au raica tiko na gone?", ["raica", "raici"], "raica", "Raica appears with na gone in the contrast. Do not swap the endings from English object order alone.", ["matanauni raraba", "nauni qali"])
    ]),
    isema: play("What joins the phrase?", "An isema connects a clause or predicate phrase to another part of a sentence.", "isema", [
      card("In me da tekivu, which opening is the connector?", ["me", "da"], "me", "Me connects the clause; da refers to the inclusive group. Their jobs differ although both stand before tekivu.", ["daru", "duruliu"]),
      card("In se ra sa yaco mai, which word introduces the connected clause?", ["se", "ra"], "se", "Se is the connector. Ra refers to the participants; its shorter shape after se follows a durusau pattern.", ["durusau", "duruliu"])
    ]),
    mata: play("Open the noun phrase", "A mata introduces the whole matanauni; it is not an attached beginning of the noun.", "mata", [
      card("In na vale, which piece introduces the phrase?", ["na", "vale"], "na", "Na is the mata; vale is the nominal base. Together they form a matanauni.", ["na", "nauni"]),
      card("Would you expect the same mata before a personal name such as Mere?", ["No", "Yes"], "No", "The pattern uses o Mere. The marker changes with the kind of phrase; na is not a universal translation of 'the'.", ["matanauni yaca", "matanauni raraba"])
    ]),
    matanauni: play("A word or a whole phrase?", "Matanauni names the whole nominal phrase, which may refer to a person, place, thing, or time.", "matanauni", [
      card("In na vale, is the matanauni vale alone or na vale together?", ["na vale together", "vale alone"], "na vale together", "The whole na vale is the matanauni. Vale is its yavu.", ["vale", "mata"]),
      card("Can a matanauni lack na, as in kei Jone?", ["Yes", "No"], "Yes", "Kei Jone is a matanauni toka built around a personal name. Do not require na in every nominal phrase.", ["matanauni toka", "matanauni yaca"])
    ]),
    matavu: play("Read the predicate phrase", "A matavu gathers a predicate base and its relevant supporting pieces.", "matavu", [
      card("Which group is a matavu: Au sa lako mai or na vale?", ["Au sa lako mai", "na vale"], "Au sa lako mai", "Au sa lako mai expresses going with its speaker and direction. Na vale is a nominal phrase.", ["lako", "matanauni"]),
      card("In Oni bula vinaka sara, is bula the yavu of a predicate phrase here?", ["Yes", "No"], "Yes", "Bula is the base of this matavu. In na nona bula taucoko, the same form has a nominal use; the phrase decides.", ["bula", "vu"])
    ]),
    nauni: play("Find the nominal base", "Nauni points to the base, not automatically to the whole phrase around it.", "nauni", [
      card("In na vale, which part names the building?", ["vale", "na"], "vale", "Vale is the nauni base; na introduces the whole phrase.", ["vale", "mata"]),
      card("Does calling vale a nauni also make na vale a single word?", ["No", "Yes"], "No", "Na vale is a matanauni with more than one piece. Keep the word's role and the phrase's role separate.", ["matanauni", "yavu"])
    ]),
    vu: play("Follow the predicate base", "A vu carries the central predicate meaning in a matavu; one form can have another role elsewhere.", "vu", [
      card("In Au sa lako, which word carries the going?", ["lako", "sa"], "lako", "Lako is the predicate base; sa is a time or aspect marker before it.", ["lako", "duruliu"]),
      card("Does bula keep a vu role in na nona bula taucoko?", ["No", "Yes"], "No", "There bula has a nominal use meaning life. In Oni bula vinaka sara it is a vu. Read the phrase before labeling the word.", ["bula", "nauni"])
    ]),
    "iyatuvosa matanauni": play("A sentence of nominal phrases", "Fijian can put nominal phrases together without an overt predicate word.", "iyatuvosa matanauni", [
      card("In [o yau] [na vunivai], must a word for English 'is' be inserted?", ["No", "Yes"], "No", "The nominal-sentence pattern places two nominal phrases side by side; English may translate the relation with 'is'.", ["matanauni", "yau"]),
      card("What does [nikua] [na soqo] show about a time expression?", ["It can be one nominal phrase in the sentence", "It must be a predicate verb"], "It can be one nominal phrase in the sentence", "Nikua stands as a time phrase beside na soqo in the nominal sentence.", ["matanauni gauna", "iyatuvosa"])
    ]),
    "matanauni raraba": play("Notice the na", "MNR is the nominal-phrase type that includes na in its marker pattern.", "matanauni raraba", [
      card("Which phrase fits MNR: na vale or kei Jone?", ["na vale", "kei Jone"], "na vale", "Na vale has na. Kei Jone belongs to a na-less matanauni pattern.", ["mata", "matanauni toka"]),
      card("Can an MNR have another marker before na, as in e na marau?", ["Yes", "No"], "Yes", "The analysis has both e and na before marau. The presence of na still matters to the MNR classification.", ["na", "marau"])
    ]),
    "matanauni toka": play("A nominal phrase without na", "MNT groups nominal phrases whose structure does not use na; inspect what comes after their marker.", "matanauni toka", [
      card("Why can kei Jone count as MNT?", ["It has no na", "It contains na"], "It has no na", "Kei Jone is a na-less phrase built around a person's name; its narrower type is MNY.", ["matanauni yaca", "na"]),
      card("Is vei koya also a na-less matanauni even though it points to a pronoun?", ["Yes", "No"], "Yes", "Vei koya is an MNT with a pronoun. Its more specific type is matanauni sosomi.", ["matanauni sosomi", "koya"])
    ]),
    "matanauni yatuvosa": play("A whole clause in a nominal role", "MNYt is a clause that fills a nominal-phrase position; it is not merely a clause describing one noun.", "matanauni yatuvosa", [
      card("In a pattern such as ni via kana, what can the whole ni-clause do?", ["Fill a nominal role", "Only name one object"], "Fill a nominal role", "The analysis treats the whole clause as one nominal unit when a suitable predicate takes it.", ["isema", "matanauni"]),
      card("Does the clause after kaloko in na kaloko [au a solia vei iko enanoa] have that same whole-phrase role?", ["No, it qualifies kaloko", "Yes, it replaces kaloko"], "No, it qualifies kaloko", "That bracketed clause is kilanauni yatuvosa: it describes kaloko. MNYt instead occupies the nominal slot itself.", ["kilanauni yatuvosa", "nauni"])
    ]),
    "matanauni gauna": play("Time as a whole phrase", "MNG can place a time expression where a nominal phrase belongs without adding na.", "matanauni gauna", [
      card("Which form can stand as an MNG meaning today?", ["nikua", "na vale"], "nikua", "Nikua is a whole time expression in the nominal-sentence pattern.", ["iyatuvosa matanauni", "siga"]),
      card("Is na siga qo the same no-na pattern as nikua?", ["No", "Yes"], "No", "Na siga qo contains na and a nominal base. Compare its structure with standalone nikua before assigning the MNG label.", ["mata", "kilanauni dusi"])
    ]),
    "matanauni yaca": play("A person's name in the phrase", "MNY is the na-less nominal-phrase type built around a personal name.", "matanauni yaca", [
      card("Which part makes kei Jone a name phrase?", ["Jone", "kei"], "Jone", "Jone is the personal name; kei introduces the phrase in this pattern.", ["mata", "matanauni toka"]),
      card("Would i Viti be MNY merely because Viti has a capital letter?", ["No", "Yes"], "No", "Viti names a place, so inspect matanauni yacanivanua rather than the personal-name type.", ["matanauni yacanivanua"])
    ]),
    "matanauni sosomi": play("A pronoun in the whole phrase", "MNS names a marked phrase built around a nauni sosomi; it does not label the pronoun alone.", "matanauni sosomi", [
      card("In o yau, which is the whole MNS?", ["o yau", "yau alone"], "o yau", "O is the marker and yau the pronoun. Together they make the phrase being classified.", ["yau", "mata"]),
      card("Does kei Jone become MNS because it also starts with a marker?", ["No", "Yes"], "No", "Jone is a personal name, so kei Jone belongs to MNY. The type depends on the base as well as the marker.", ["matanauni yaca", "isosomi"])
    ]),
    "matanauni yacanivanua": play("A place name in the phrase", "MNYV is a na-less nominal phrase built around the name of a place.", "matanauni yacanivanua", [
      card("In i Viti, what makes the phrase a place-name type?", ["Viti names a place", "i is a verb"], "Viti names a place", "I Viti contains the place name Viti after its marker.", ["mata"]),
      card("Would i tuba also be MNYV?", ["No", "Yes"], "No", "I tuba gives a location without naming a particular place; compare matanauni vanua.", ["matanauni vanua"])
    ]),
    "matanauni vanua": play("Where, but not which named place?", "MNV locates or directs without building the phrase around a place name.", "matanauni vanua", [
      card("Which expression gives a location without a proper place name: e ke or i Viti?", ["e ke", "i Viti"], "e ke", "E ke points to a location. I Viti names a particular place and belongs to MNYV.", ["matanauni yacanivanua", "mata"]),
      card("In i tuba, is tuba functioning as a place name such as Lautoka?", ["No", "Yes"], "No", "I tuba locates something outside without naming a particular town or village.", ["matanauni yacanivanua"])
    ]),
    "matanauni sema": play("Two nominal phrases, one role", "A sema links or places nominal phrases together so they serve one part of the sentence.", "matanauni sema", [
      card("If two phrases refer to different things, which connection should you inspect?", ["sosoqoni", "veitokoni"], "sosoqoni", "Sosoqoni groups different referents. Check whether the phrase uses kei, se, or no spoken linker in its context.", ["sosoqoni", "isema"]),
      card("If two phrases identify the same person, which connection should you inspect?", ["veitokoni", "sosoqoni"], "veitokoni", "Veitokoni places two descriptions of one referent side by side in the pattern.", ["veitokoni", "matanauni"])
    ]),
    sosoqoni: play("Different people or things together", "Sosoqoni joins nominal expressions for distinct referents in one sentence role.", "sosoqoni", [
      card("If na sabutu and na kawago name two different things, which relation fits?", ["sosoqoni", "veitokoni"], "sosoqoni", "Different referents are grouped in sosoqoni. Veitokoni is for descriptions of the same referent.", ["veitokoni", "matanauni sema"]),
      card("Does every sosoqoni require an audible kei?", ["No", "Yes"], "No", "The patterns can use kei, se, or no spoken link. Their meanings are not interchangeable; read the whole sentence.", ["isema", "veitokoni"])
    ]),
    veitokoni: play("Two descriptions, one person", "Veitokoni puts nominal phrases for the same referent side by side.", "veitokoni", [
      card("In na turaga na rātū, do the two phrases identify one person or two?", ["One", "Two"], "One", "The contrast uses the second phrase to identify the same person further.", ["matanauni sema", "sosoqoni"]),
      card("Would inserting kei preserve that same side-by-side identification pattern?", ["No", "Yes"], "No", "The veitokoni pattern has no kei. Kei can instead link distinct referents in sosoqoni.", ["sosoqoni", "isema"])
    ]),
    "kilanauni dusi": play("Point to the one you mean", "A kilanauni dusi follows a nominal base and identifies which one is meant.", "kilanauni dusi", [
      card("In na siga qo, which word points to this day?", ["qo", "siga"], "qo", "Qo follows siga and narrows which day the phrase names.", ["siga", "matanauni"]),
      card("Is standalone oqori in Kauta mai oqori serving that same after-the-base role?", ["No", "Yes"], "No", "Oqori stands as a whole pointing phrase there; qo after siga qualifies a base. The position changes the analysis.", ["matanauni dusi", "mata"])
    ]),
    "kilanauni nauni": play("Which kind of thing?", "A nauni base can qualify another nominal base inside one phrase.", "kilanauni nauni", [
      card("In na kali vesi levu qori, which word tells what kind of kali?", ["vesi", "qori"], "vesi", "Vesi qualifies kali with a material or kind; qori points to the item.", ["kilanauni dusi", "nauni"]),
      card("Which word in that phrase tells size rather than material?", ["levu", "vesi"], "levu", "Levu is a kilanauni vu in this analysis. Vesi supplies the nauni-based qualifier.", ["kilanauni vu", "levu"])
    ]),
    "kilanauni vu": play("Add a property to the noun", "A vu base can qualify a nominal base without becoming the head of the phrase.", "kilanauni vu", [
      card("In na kali vesi levu qori, which word tells you the kali is large?", ["levu", "vesi"], "levu", "Levu supplies the size description after the base and nauni-based qualifier.", ["levu", "kilanauni nauni"]),
      card("In na vale levu, has levu replaced vale as the main nominal base?", ["No", "Yes"], "No", "Vale remains the base; levu qualifies it. Compare the unqualified na vale.", ["vale", "nauni"])
    ]),
    kilanauni: play("What describes the nominal base?", "Kilanauni is the wider family of qualifiers inside a matanauni.", "kilanauni", [
      card("In na kali vesi levu qori, is kali itself the kilanauni?", ["No", "Yes"], "No", "Kali is the nominal base. Vesi, levu, and qori give different kinds of added information after it.", ["nauni", "kilanauni nauni"]),
      card("Does the pointing word qori have the same subtype as size word levu?", ["No", "Yes"], "No", "Qori is a kilanauni dusi; levu is a kilanauni vu. Both qualify the base, but they do different jobs.", ["kilanauni dusi", "kilanauni vu"])
    ]),
    "matanauni dusi": play("Can the pointing form stand alone?", "MND lets a pointing form fill the whole nominal phrase rather than merely describe a noun.", "matanauni dusi", [
      card("In Kauta mai oqori, is oqori standing as the whole pointing phrase?", ["Yes", "No"], "Yes", "Oqori supplies the whole nominal expression in this example.", ["matanauni", "kilanauni dusi"]),
      card("In na siga qo, does qo fill the whole nominal-phrase role by itself?", ["No", "Yes"], "No", "Qo follows siga to point out which day; here it is a kilanauni dusi, not a standalone MND.", ["kilanauni dusi", "siga"])
    ]),
    "nauni sosomi": play("A pronoun as the base", "The nauni sosomi chart lists independent pronouns by person, group size, and listener inclusion.", "nauni sosomi", [
      card("In o yau, is yau the pronoun or the marker?", ["The pronoun", "The marker"], "The pronoun", "Yau is the independent pronoun; o introduces the whole matanauni sosomi.", ["yau", "matanauni sosomi"]),
      card("If 'we two' includes the listener, does the chart choose kedaru or keirau?", ["kedaru", "keirau"], "kedaru", "Kedaru includes the listener. Keirau names two people while leaving the listener out.", ["kedaru", "keirau"])
    ]),
    drua: play("Spot the repeated piece", "Drua names repetition in a word, but a repeated-looking shape needs a checked base and meaning.", "drua", [
      card("Which part repeats in the word ilakolako?", ["lako", "i-"], "lako", "Ilakolako shows i- together with repeated lako. Its meaning is a journey; repetition alone would not tell you that meaning.", ["ilakolako", "lako"]),
      card("Can every doubled-looking word be analyzed safely by repeating an imagined base?", ["No", "Yes"], "No", "No. First find the actual base, repeated span, and use. Drua is a pattern to investigate, not a licence to invent a word.", ["drualeka", "yavu"])
    ]),
    durugauna: play("Now or later?", "Durugauna helps place a predicate in time or aspect; read the whole phrase to see its force.", "durugauna", [
      card("In Au sa lako, which word adds current relevance to going?", ["sa", "Au"], "sa", "Sa is the durugauna in this phrase. Au points to the speaker.", ["sa", "durusau"]),
      card("If Au na lako points ahead, would replacing na with sa leave the same time reading?", ["No", "Yes"], "No", "Na points ahead in that comparison; sa presents the going differently. Both belong beside the predicate, but they are not interchangeable.", ["na", "sa"])
    ]),
    ikurau: play("A word set apart", "Ikurau can stand as an expressive call rather than filling a slot inside an ordinary phrase.", "ikurau", [
      card("Does Isa! need a nauni after it to be an expressive call?", ["No", "Yes"], "No", "Isa! can stand as its own exclamation; its feeling depends on the situation.", ["matavosa", "nauni"]),
      card("Is Sobo! doing the same job as au in Au sa lako?", ["No", "Yes"], "No", "Sobo! is an expressive form. Au serves as durusau within the predicate phrase.", ["durusau", "au"])
    ]),
    ikuriliu: play("Attached before the base", "Ikuriliu is an addition to a word, unlike a separate mata opening a phrase.", "ikuriliu", [
      card("In ilakolako, is i- attached to the word or a separate na before it?", ["Attached", "Separate na"], "Attached", "The word joins i- with the repeated base lako. Na in na vale is a different, phrase-level marker.", ["i-", "ilakolako"]),
      card("In veivosaki, which beginning invites a word-building analysis?", ["vei-", "na"], "vei-", "Vei- is attached in this form. Check what the complete derived word means before generalizing from the prefix.", ["vei-", "veivosaki"])
    ]),
    ikurimuri: play("Attached after the base", "Ikurimuri follows a word base; the ending's job must be checked in that word and phrase.", "ikurimuri", [
      card("In batiqu, is -qu attached to bati or a separate mata?", ["Attached", "A separate mata"], "Attached", "The possessor ending -qu is attached to bati. A phrase can still need its own mata, as in na batiqu.", ["bati", "mata"]),
      card("Can you identify a dewa just by seeing a final -i on any word?", ["No", "Yes"], "No", "No. Compare a complete pair such as raica and raici and the participant that follows it.", ["dewa", "raica"])
    ]),
    kilavu: play("What narrows the action?", "Kilavu qualifies the predicate inside a matavu; its base can come from different word families.", "kilavu", [
      card("In Oni bula vinaka sara, which word qualifies bula?", ["vinaka", "Oni"], "vinaka", "Vinaka adds a quality to the predicate base bula; this is a kilavu vu use.", ["kilavu vu", "bula"]),
      card("In au gunu yaqona tiko, is yaqona an affected object or a noun-based qualifier in the analysis?", ["A noun-based qualifier", "An affected object"], "A noun-based qualifier", "Yaqona narrows the drinking event as kilavu nauni here. Do not assign its role from the English translation alone.", ["kilavu nauni", "gunu"])
    ]),
    matavosa: play("What kind of phrase is it?", "A matavosa has a meaning-bearing yavu and any supporting pieces it needs.", "matavosa", [
      card("What is the yavu in na vale?", ["vale", "na"], "vale", "Vale carries the building meaning; na opens the matanauni.", ["yavu", "matanauni"]),
      card("Can Au sa lako also be analyzed as a matavosa?", ["Yes", "No"], "Yes", "Yes. Its base is lako and its supporting pieces include au and sa; the phrase is a matavu.", ["matavu", "duru"])
    ]),
    qali: play("Who or what is affected?", "Qali names the affected participant as a meaning role; it is not the label for every nominal phrase after a predicate.", "qali", [
      card("In Au raici Jo tiko, who is affected by the seeing?", ["Jo", "Au"], "Jo", "Jo is the affected person. Au identifies the one doing the seeing.", ["nauni qali", "sau"]),
      card("Does na gone in Au raica tiko na gone have to be inside the same narrow matavu slot as Jo?", ["No", "Yes"], "No", "Jo is nauni qali within the matavu, while na gone is a separate matanauni raraba. Both can name someone affected.", ["matanauni raraba", "nauni qali"])
    ]),
    sau: play("Follow the actor", "Sau identifies the actor-like participant in the event, separately from a word's position.", "sau", [
      card("In Au raica na gone, which participant does the seeing?", ["Au", "na gone"], "Au", "Au is the actor-like participant here. Na gone names the one seen.", ["au", "qali"]),
      card("In the cici / ciciva contrast, does the runner cease to be the actor when the longer form is used?", ["No", "Yes"], "No", "The same runner remains the sau in that contrast. Compare this with sogo / sogota, where a participant's role shifts.", ["cici", "vusaumaki"])
    ]),
    "nauni raraba": play("A common nominal base", "Nauni raraba names a general kind of thing, unlike a personal name; the whole phrase has another label.", "nauni raraba", [
      card("In na vale, is vale the common nominal base or the phrase marker?", ["The base", "The marker"], "The base", "Vale names a type of building; na is its marker in this phrase.", ["vale", "mata"]),
      card("Is Mere in o Mere a nauni raraba just because it fills a nominal phrase?", ["No", "Yes"], "No", "Mere is a personal name. The distinction is between kinds of base, not between whole phrases and isolated words.", ["matanauni yaca", "matanauni raraba"])
    ]),
    "mata ni wiliwili": play("Open the number", "A counted phrase may have a marker for its number and another marker for its nominal base.", "mata ni wiliwili", [
      card("In E rua na toa, which word introduces the quantity rua?", ["E", "na"], "E", "E is the mata ni wiliwili here; na introduces toa as the nominal base.", ["rua", "mata"]),
      card("In kei na dua na yalewa, are both occurrences of na doing exactly the same job?", ["No", "Yes"], "No", "The first na introduces the quantity; the second na introduces the nominal base yalewa.", ["dua", "wiliwili"])
    ]),
    "taukeni sosomi": play("When the owner is understood", "The possessor can be expressed by a form before the nominal base instead of a named person after it.", "taukeni sosomi", [
      card("In na noqu vale, is the owner named as Luke is in na vale nei Luke?", ["No", "Yes"], "No", "Noqu points to the speaker without naming an owner. Nei Luke supplies a name after vale.", ["vale", "taukeni"]),
      card("In noqu, which piece identifies the person?", ["-qu", "no-"], "-qu", "The attached -qu identifies the speaker; no- helps mark the kind of possessive relation.", ["ikuri sosomi", "ikuri taukeni"])
    ]),
    "ikuri taukeni": play("Choose the relationship", "The first element of a preposed possessive form helps show how the possessor is related to what follows.", "ikuri taukeni", [
      card("In noqu vale, which piece comes before the person ending -qu?", ["no-", "vale"], "no-", "No- is the ikuri taukeni of noqu. Vale remains the thing named.", ["taukeni sosomi", "vale"]),
      card("Would the relationship marker before tea in memudou ti be no- simply because it has an owner?", ["No", "Yes"], "No", "The drinking-related form uses me-. The kind of relationship matters as well as who is involved.", ["taukeni gunu", "ikuri sosomi"])
    ]),
    "ikuri sosomi": play("Who is connected?", "The attached person-and-number piece of a possessive form is different from a free pronoun.", "ikuri sosomi", [
      card("In noqu, which attached piece means 'my'?", ["-qu", "no-"], "-qu", "The -qu ending points to the speaker. The no- piece gives the possessive relation.", ["-qu", "ikuri taukeni"]),
      card("Does -itou in neitou include the listener just because tou can be an inclusive short form elsewhere?", ["No", "Yes"], "No", "Neitou is exclusive; the attached -itou must be read in its own word, not confused with separate tou.", ["taukeni sosomi", "keitou"])
    ]),
    "kilavu nauni": play("A noun that narrows the action", "A nauni can follow a predicate to say what kind of activity is taking place.", "kilavu nauni", [
      card("What does yaqona add in au gunu yaqona tiko?", ["The kind of drinking", "The speaker's name"], "The kind of drinking", "Yaqona narrows the drinking action in the analysis; it is kilavu nauni here.", ["gunu", "yaqona"]),
      card("Does its being a nauni automatically make yaqona a nauni qali in that phrase?", ["No", "Yes"], "No", "The phrase treats it as a qualifier of gunu. Compare nauni qali, which occupies an affected-participant slot in another construction.", ["nauni qali", "kilavu"])
    ]),
    "kilavu vu": play("A predicate qualifying another", "The qualifier can itself be a vu-like base, with a later particle still following.", "kilavu vu", [
      card("In Oni bula vinaka sara, which word qualifies bula?", ["vinaka", "sara"], "vinaka", "Vinaka is kilavu vu in this analysis. Sara follows later as durumuri.", ["vinaka", "durumuri"]),
      card("In keitou gunu yaqona butā toka, which of yaqona and butā is the vu-based qualifier?", ["butā", "yaqona"], "butā", "Butā is the kilavu vu; yaqona is a nauni-based qualifier and toka follows later.", ["kilavu nauni", "gunu"])
    ]),
    vucoko: play("Can the ending come off?", "A vucoko has a dewa form bound into the predicate; do not invent an unattested bare base.", "vucoko", [
      card("Nanuma and nanumi both occur. Does that make *nanu a word too?", ["No", "Yes"], "No", "No. *Nanu is an invented base; keep the complete forms nanuma and nanumi.", ["dewa", "vu dewa"]),
      card("Could a learner decide vucoko from the English word 'think' alone?", ["No", "Yes"], "No", "The Fijian form family and complete phrase matter. An English gloss cannot tell whether a dewa is permanently attached.", ["dewa", "yavu"])
    ]),
    vusaumaki: play("Who changes role?", "Some base/dewa contrasts change the relationship of a participant to the event.", "vusaumaki", [
      card("In the sogo / sogota contrast, does the thing that closes keep exactly the same role?", ["No", "Yes"], "No", "The analysis moves the thing that closes from the sole participant to the affected participant of the longer form.", ["sau", "qali"]),
      card("Is this the same participant pattern as cici / ciciva?", ["No", "Yes"], "No", "The cici runner remains the actor-like participant across that contrast. Vusaumaki points to the different role shift shown by sogo / sogota.", ["cici", "vucoko"])
    ]),
    wiliwili: play("Number or whole counted phrase?", "Wiliwili can name counting itself or a number expression inside a larger phrase.", "wiliwili", [
      card("In E rua na toa, which word gives the count?", ["rua", "toa"], "rua", "Rua says how many. Toa names what is counted; the phrase does more than name a number in isolation.", ["rua", "mata ni wiliwili"]),
      card("Does changing rua to tolu change the count or the kind of thing counted?", ["The count", "The kind of thing"], "The count", "Rua is two and tolu is three. The counted thing remains toa in this comparison.", ["rua", "tolu"])
    ]),
    ciwa: play("One before ten", "Ciwa counts nine; try it against the nearby numerals.", "ciwa", [
      card("Which number follows walu when counting toward tini?", ["ciwa", "vitu"], "ciwa", "Walu is eight, ciwa is nine, and tini is ten.", ["walu", "tini"]),
      card("If one is added to ciwa, which number is reached?", ["tini", "walu"], "tini", "Nine plus one is ten. The Fijian counting words are ciwa and tini.", ["tini", "dua"])
    ]),
    lima: play("Count to five", "Lima is five, a useful pivot between four and six.", "lima", [
      card("Which word names the number between va and ono?", ["lima", "vitu"], "lima", "Va is four, lima is five, and ono is six.", ["va", "ono"]),
      card("Two groups of lima make which number?", ["tini", "walu"], "tini", "Two fives make ten: lima and tini are different count words.", ["tini", "rua"])
    ]),
    ono: play("Count to six", "Ono is six; notice how it sits between two number words.", "ono", [
      card("Which comes straight after lima?", ["ono", "va"], "ono", "Ono is six, following lima, five.", ["lima", "va"]),
      card("Two groups of tolu make how many?", ["ono", "walu"], "ono", "Tolu is three; two groups of three make ono, six.", ["tolu", "rua"])
    ]),
    va: play("Four in the count", "Va is four in the number list; the same spelling needs context in other uses.", "va", [
      card("Two groups of rua make which count?", ["va", "lima"], "va", "Rua is two; two pairs make va, four.", ["rua", "lima"]),
      card("Which number follows va in the sequence?", ["lima", "ono"], "lima", "The counting sequence moves from va (four) to lima (five).", ["lima", "wiliwili"])
    ]),
    vitu: play("Count to seven", "Vitu sits after six and before eight.", "vitu", [
      card("If you have ono and add dua, which number follows?", ["vitu", "walu"], "vitu", "Six plus one makes seven: ono, then vitu.", ["ono", "dua"]),
      card("Which word comes after vitu?", ["walu", "lima"], "walu", "Walu is eight, the next count after vitu.", ["walu", "wiliwili"])
    ]),
    walu: play("Four pairs make eight", "Walu names eight; compare it with other counts rather than translating a whole sentence from English.", "walu", [
      card("Four groups of rua make which number?", ["walu", "ono"], "walu", "Four pairs make eight, which is walu.", ["va", "rua"]),
      card("If you add one to walu, which count word follows?", ["ciwa", "tini"], "ciwa", "Walu is eight; ciwa is nine, one step before tini.", ["ciwa", "dua"])
    ]),
    iyatuvosa: play("What makes the whole sentence?", "An iyatuvosa can contain a predicate phrase or place nominal phrases side by side.", "iyatuvosa", [
      card("In E lako mai o Mere, which group tells what happens?", ["E lako mai", "o Mere"], "E lako mai", "E lako mai is the matavu; o Mere identifies the person outside that predicate phrase.", ["matavu", "matanauni yaca"]),
      card("Do [o yau] [na vunivai] need a separate word for English 'is'?", ["No", "Yes"], "No", "The iyatuvosa matanauni puts two nominal phrases together without an overt vu.", ["iyatuvosa matanauni", "matanauni"])
    ]),
    "nauni qali": play("The affected participant inside the phrase", "Nq identifies a named or pronominal participant immediately after the relevant predicate form in this analysis.", "nauni qali", [
      card("In au raici Jo tiko, which word is the nauni qali?", ["Jo", "au"], "Jo", "Jo follows raici inside the matavu and names the person seen; au identifies the one seeing.", ["dewa", "qali"]),
      card("Does na gone in au raica tiko na gone occupy the same narrow slot as Jo?", ["No", "Yes"], "No", "Na gone forms a separate matanauni raraba, although the child is still the person seen.", ["matanauni raraba", "matavu"])
    ]),
    taukeni: play("How is the person connected?", "Taukeni can be shown by a named person after the base or by a possessive form before it.", "taukeni", [
      card("In na vale nei Luke, which part identifies the person connected to the house?", ["nei Luke", "na"], "nei Luke", "Nei Luke names the person after vale; na introduces the whole phrase.", ["nei", "vale"]),
      card("If Luke himself says na noqu vale, is Luke named inside that phrase?", ["No", "Yes"], "No", "Noqu identifies the speaker without repeating the name. The relationship is expressed before vale.", ["taukeni sosomi", "vale"])
    ]),
    "vosa tuvai": play("One word, different jobs", "A vosa tuvai gets its role from the phrase it helps build.", "vosa tuvai", [
      card("Is bula a vu in Oni bula vinaka sara?", ["Yes", "No"], "Yes", "Bula is the predicate base here; vinaka qualifies it. Read the whole matavu before naming the role.", ["vu", "kilavu vu"]),
      card("In na nona bula taucoko, does bula keep that same vu role?", ["No", "Yes"], "No", "Here bula names life as a nominal base. Its spelling stays the same while its phrase role changes.", ["nauni", "matanauni"])
    ]),
    "kilanauni yatuvosa": play("A clause describes which one", "A whole clause can follow a nominal base and tell the reader which item is meant.", "kilanauni yatuvosa", [
      card("In na kaloko [au a solia vei iko enanoa], does the bracketed clause identify which kaloko?", ["Yes", "No"], "Yes", "The clause describes the kaloko; it is a kilanauni yatuvosa attached to that nominal base.", ["kilanauni", "nauni"]),
      card("Does that clause replace the whole nominal phrase the way an MNYt clause can?", ["No", "Yes"], "No", "It qualifies kaloko inside the phrase. An MNYt clause occupies a nominal-phrase position itself.", ["matanauni yatuvosa", "matanauni"])
    ]),
    isosomi: play("Refer back without repeating the name", "An isosomi can stand for an already identifiable participant.", "isosomi", [
      card("After Oqo o Jale, who does koya point to in Na tagane mamakutu o koya?", ["Jale", "A newly named village"], "Jale", "Koya refers back to Jale; the listener can identify the person without hearing his name again.", ["koya", "matanauni sosomi"]),
      card("In o koya, is o part of the pronoun itself?", ["No", "Yes"], "No", "Koya is the pronoun; o is the mata of the whole matanauni sosomi.", ["mata", "nauni sosomi"])
    ]),
    tiko: play("Staying or keeping on?", "Tiko can be the predicate base or a following continuation marker; the phrase shows which.", "tiko", [
      card("In e gole tiko yani, does tiko stand as the main base or follow gole?", ["It follows gole", "It replaces gole"], "It follows gole", "Gole is the base; tiko follows it as a durumuri while the movement continues.", ["durumuri", "yani"]),
      card("In ena tiko mai nodratou, is tiko still merely following another base?", ["No", "Yes"], "No", "Here tiko itself is the predicate base, with mai following it. Its role has changed with the construction.", ["vu", "mai"])
    ]),
    vinaka: play("Good, and doing well", "Vinaka can express a quality; in a predicate phrase it may qualify another base.", "vinaka", [
      card("In Oni bula vinaka sara, which word says how the living or well-being is going?", ["vinaka", "sara"], "vinaka", "Vinaka qualifies bula in this phrase; sara follows later to strengthen the expression.", ["bula", "kilavu vu"]),
      card("Is sara the same kind of qualifier as vinaka in that analysis?", ["No", "Yes"], "No", "Vinaka is kilavu vu here, while sara occupies a later durumuri position. The two words do different jobs.", ["durumuri", "kilavu vu"])
    ]),
    mai: play("Which way is the movement?", "Mai can point movement toward the speaker; its phrase role changes in other constructions.", "mai", [
      card("In Au sa lako mai, is the movement presented toward here or away from here?", ["Toward here", "Away from here"], "Toward here", "Mai gives the toward-speaker direction after lako in this phrase.", ["lako", "durumuri"]),
      card("In era yabe vata yani, would yani point the same direction as mai?", ["No", "Yes"], "No", "Yani presents movement away or onward. Compare the two directions before choosing a word for a journey.", ["yani", "matanauni vanua"])
    ]),
    yani: play("Away and onward", "Yani follows a moving predicate in the phrase and points away or onward.", "yani", [
      card("In era yabe vata yani, which final word gives the direction?", ["yani", "vata"], "yani", "Vata says they move together; yani points the movement onward or away.", ["durumuri", "mai"]),
      card("Could you switch the order to era yabe yani vata here?", ["No", "Yes"], "No", "For this meaning, vata comes before yani. Their order matters; they cannot simply be moved like two English adverbs.", ["veitabui", "durumuri"])
    ]),
    tani: play("Away, or a different one?", "Tani changes role with its phrase: direction after a predicate, description after a nominal base.", "tani", [
      card("In wasea tani na duka, does tani follow the action or describe a named object inside na duka?", ["It follows the action", "It describes na duka"], "It follows the action", "Tani is the following direction or separation word in this phrase.", ["durumuri", "vu"]),
      card("In na kā tani qori, which word distinguishes this thing from another?", ["tani", "na"], "tani", "Tani qualifies kā inside the nominal phrase; it is not a direction marker in this use.", ["kilanauni", "matanauni"])
    ]),
    sobu: play("Downward in two positions", "Sobu can follow another predicate or itself be the central predicate base.", "sobu", [
      card("In sā vakarōrō sobu mai, does sobu come before or after vakarōrō?", ["After", "Before"], "After", "Sobu follows the base here, before the later mai.", ["durumuri", "mai"]),
      card("In sā vakarau sobu na kākō, does sobu merely add direction after a different movement base?", ["No", "Yes"], "No", "Sobu is the predicate base here. The same spelling need not always have the same phrase role.", ["vu", "matavu"])
    ]),
    makawa: play("Long ago or an old building?", "Makawa can follow a predicate in a time reading or describe a nominal base.", "makawa", [
      card("In ratou sā moce makawa, does makawa describe a house?", ["No", "Yes"], "No", "It follows moce with a time-related reading; no house is named in this phrase.", ["durumuri", "tiko"]),
      card("In na vale makawa, what is old?", ["The house", "The speaker"], "The house", "Makawa qualifies vale inside the nominal phrase rather than following a sleeping predicate.", ["vale", "kilanauni"])
    ]),
    wale: play("Only, or without a further reason?", "Wale has several phrase roles; its position and context decide the reading.", "wale", [
      card("In au via taroga wale gā, which word limits the asking to 'just asking'?", ["wale", "taroga"], "wale", "Wale follows taroga as a durumuri; gā further limits the expression.", ["durumuri", "vu"]),
      card("In e sega ni kā wale, is wale still following a predicate as in the first phrase?", ["No", "Yes"], "No", "Here wale qualifies kā inside the nominal expression. In another context it can also qualify a predicate.", ["kilanauni", "matanauni"])
    ]),
    cake: play("Upward, but check the order", "Cake can add upward direction after a movement predicate.", "cake", [
      card("In sā curuma cake tiko, which word gives the upward direction?", ["cake", "tiko"], "cake", "Cake adds upward direction; tiko marks continuation after it here.", ["durumuri", "tiko"]),
      card("Would sā curuma tiko cake keep the same word order?", ["No", "Yes"], "No", "The upward direction cake precedes the continuation tiko in this construction.", ["veitabui", "durumuri"])
    ]),
    vakatotolo: play("Where can quickly go?", "This particular vaka- form is shown in two positions around mai; that flexibility is not a rule for every qualifier.", "vakatotolo", [
      card("In Drau lako mai vakatotolo, is vakatotolo before or after mai?", ["After", "Before"], "After", "The quick manner follows the direction word mai, in the later kilavu tale position.", ["mai", "kilavu tale"]),
      card("Can you also say Drau lako vakatotolo mai?", ["Yes", "No"], "Yes", "Vakatotolo can take this earlier position too. Similar looking words do not all move so freely; check each phrase.", ["kilavu", "veitabui"])
    ]),
    oti: play("Has it finished?", "Oti can mark completion after a predicate; it is not the same as a marker of ongoing action.", "oti", [
      card("In Au nanuma de o sa kana oti, does oti point to completed or continuing eating?", ["Completed", "Continuing"], "Completed", "Oti follows kana and presents the eating as finished in the clause.", ["matanauni yatuvosa", "durumuri"]),
      card("Does tiko in e gole tiko yani give the same completed reading as oti?", ["No", "Yes"], "No", "Tiko presents continuation there; oti supplies completion after kana in the other phrase.", ["tiko", "yani"])
    ]),
    vuwale: play("A predicate without dewa", "A vuwale is a predicate base that has no dewa form in that use.", "vuwale", [
      card("In its predicate use, does levu itself take a dewa?", ["No", "Yes"], "No", "Levu is a vuwale in that use: its own form has no dewa.", ["levu", "dewa"]),
      card("Does the existence of vakalevutaka make bare levu a vu dewa?", ["No", "Yes"], "No", "Vakalevutaka is a different derived form. Do not transfer its ending to levu itself.", ["vaka-", "vu dewa"])
    ]),
    "vu dewa": play("Read the base with its ending", "This family has dewa forms, but the suffix and the following participant still need phrase-level checking.", "vu dewa", [
      card("Which form stands immediately before Jo in Au raici Jo tiko?", ["raici", "raica"], "raici", "Raici has the -i form before a personal name here.", ["dewa", "nauni qali"]),
      card("Does the pair nanuma / nanumi allow an invented bare *nanu?", ["No", "Yes"], "No", "Nanuma and nanumi are complete forms; *nanu is an invented base.", ["vucoko", "dewa"])
    ])
  };

  // Keep earlier sense-specific inquiry, including yavu as a house foundation.
  for (const [key, activity] of Object.entries(additions)) {
    if (Object.hasOwn(window.NAISEMA_WORD_PLAY, key)) throw new Error(`Duplicate dictionary inquiry: ${key}`);
    window.NAISEMA_WORD_PLAY[key] = activity;
  }
})();
