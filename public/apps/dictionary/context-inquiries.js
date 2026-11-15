// Checked, entry-specific inquiries from Fiji ecology, counting, and Tuvavosa.
// Keep each card with its starting word; do not infer a new Fijian form from a clue.
(() => {
  const card = (question, options, correct, answer, clues = []) => ({ question, options, correct, answer, clues });
  const play = (title, intro, word, cards, link) => ({ title, intro, cards: cards.map(item => ({ word, ...item })), ...(link ? { link } : {}) });
  const additions = {
    dranu: play("Fresh water or a lake?", "Dranu describes water without the saltiness of the sea. Drano, with a different final vowel, names a lake or inland body of water.", "dranu", [
      card("In wai dranu (‘freshwater’), what does dranu tell you about the water?", ["It is not saltwater", "It is certainly safe to drink"], "It is not saltwater", "The phrase distinguishes fresh water from seawater. It does not by itself certify drinking safety.", ["masima", "drano"]),
      card("Does drano name the same thing as dranu?", ["No", "Yes"], "No", "Drano names a lake or inland body of water. Dranu gives a water quality, as in wai dranu. The final vowel matters.", ["drano"])
    ], { label: "Explore dranu in a Pacific linguistics study", href: "https://openresearch-repository.anu.edu.au/bitstreams/2c665103-7937-4d1b-87a4-1939b258f782/download" }),
    bu: play("Which coconut is ready to drink?", "Bu names a green coconut at a particular useful stage, not every coconut on the palm.", "bu", [
      card("Which part is still soft when a bu is ready to drink?", ["The flesh", "The shell"], "The flesh", "Its water is drinkable while the flesh remains soft; a mature niu is a different stage.", ["niu"]),
      card("If a seller offers bu and niu, do those words necessarily specify the same stage?", ["No", "Yes"], "No", "Bu selects the drinkable green stage. Niu names the coconut more generally, especially a mature one in this dictionary.", ["niu", "buru"])
    ], { label: "Explore a study of Fijian coconut stages", href: "https://tlopo.clld.org/contributions/3-12" }),
    buru: play("Count the coconuts", "Buru is a traditional unit of ten coconuts; the same counted-unit name is also recorded for bottles of coconut oil.", "buru", [
      card("If there are two buru of coconuts, how many coconuts are counted?", ["20", "12"], "20", "Each buru counts ten, so two count twenty. It is a unit, not the name of a coconut stage.", ["niu", "wiliwili"]),
      card("In the recorded oil example, what does one buru count?", ["Ten bottles of coconut oil", "One bottle"], "Ten bottles of coconut oil", "Traditional counting can group different related goods; this example groups ten bottles of oil.", ["niu", "bu"])
    ], { label: "Read about traditional Fijian counted units", href: "https://www.fijitimes.com.fj/keeping-alive-a-unique-way-of-life/" }),
    kavika: play("An apple by name, a different tree", "Kavika is the Malay apple, Syzygium malaccense; the English common name can mislead someone expecting a temperate apple.", "kavika", [
      card("Is kavika the same botanical fruit as the ordinary temperate apple?", ["No", "Yes"], "No", "Malay apple belongs to Syzygium, while the familiar temperate apple belongs to Malus.", ["baka"]),
      card("In a Fiji plant survey, was kavika recorded as an introduced cultivated plant or as a sea animal?", ["An introduced cultivated plant", "A sea animal"], "An introduced cultivated plant", "The Fiji survey lists kavika among cultivated introduced plants; its Fijian name still belongs in a Fiji dictionary.", ["baka", "duruka"])
    ], { label: "Read the Fiji plant survey", href: "https://repository.usp.ac.fj/id/eprint/10050/1/REDD%2B_Report_Emalu_Biodiversity_Assessment.pdf" }),
    duruka: play("A crop with an edible shoot", "Duruka is a cultivated sugarcane relative. The tender flower shoot is the part commonly prepared as food.", "duruka", [
      card("When duruka is served as a vegetable, which part is being used?", ["The tender flower shoot", "A coconut"], "The tender flower shoot", "The crop is grown for that edible shoot, which is why English descriptions sometimes call it Fiji asparagus.", ["ota", "dalo"]),
      card("Does Fiji's crop guide list only one named duruka variety?", ["No", "Yes"], "No", "It lists several varieties, including Duruka leka and Baribari; the broad word duruka is not one cultivar name.", ["kavika", "baka"])
    ], { label: "Open Fiji's crop guide for duruka", href: "https://www.agriculture.gov.fj/documents/booklets/cropguide.pdf" }),
    baka: play("A banyan in a Fiji forest", "Baka names a large banyan fig; a Fiji vegetation survey uses the word for more than one Ficus identification.", "baka", [
      card("In the Monuriki survey, is baka treated as a single fixed scientific species?", ["No", "Yes"], "No", "The survey records baka or baka ni Viti with Ficus names, and also uses Ficus spp. for banyans.", ["kavika"]),
      card("Would you expect a baka's spreading branches and hanging roots to resemble a coconut palm?", ["No", "Yes"], "No", "Banyan figs spread a broad crown and aerial roots. The familiar niu is a palm with a different form.", ["niu"])
    ], { label: "Read the Monuriki vegetation survey", href: "https://www.pacificinvasivesinitiative.org/site/pii/files/DRAFTFeasibilityStudy_Monuriki_FJ_2013.pdf" }),
    balolo: play("A seasonal visitor from the reef", "Balolo is an edible marine worm, not a fish, and its appearance is seasonal.", "balolo", [
      card("If balolo appears around a reef, should it be counted as an ika species?", ["No", "Yes"], "No", "The reported Fiji balolo is a marine worm. Ika names fish, even when fish are prepared as food.", ["ika"]),
      card("Does a balolo gathering depend on a seasonal appearance or a constant daily catch?", ["A seasonal appearance", "A constant daily catch"], "A seasonal appearance", "The worms emerge in seasonal swarms, a feature of the word's local food context.", ["ika", "vonu"])
    ], { label: "See a scientific report on Fiji balolo", href: "https://www.jstage.jst.go.jp/article/benthos/79/1/79_79/_article/-char/en" }),
    vonu: play("Which turtle?", "Vonu names a sea turtle. Vonu dina names the green sea turtle in Fiji's conservation writing.", "vonu", [
      card("Does vonu dina narrow vonu to a particular sea turtle?", ["Yes", "No"], "Yes", "The added dina identifies the green sea turtle; vonu alone is the broader turtle name.", ["ika"]),
      card("Which animal appears as vonu dina on Fiji's five-dollar banknote design?", ["A green sea turtle", "A swordfish"], "A green sea turtle", "The Reserve Bank uses the species name beside the image, linking a familiar word to conservation.", ["saku vorowaqa"])
    ], { label: "See the Reserve Bank's turtle design", href: "https://currency.rbf.gov.fj/products/2025-new-polymer-5-banknote" }),
    kawakawa: play("One fish name, several levels of precision", "Kawakawa refers to grouper; a Fiji conservation guide uses it specifically for the camouflage grouper.", "kawakawa", [
      card("In the WCS Fiji guide, which scientific name goes with kawakawa?", ["Epinephelus polyphekadion", "Xiphias gladius"], "Epinephelus polyphekadion", "That is the camouflage grouper in the guide. Xiphias gladius is the swordfish called saku vorowaqa.", ["saku vorowaqa", "donu"]),
      card("Why might a spawning group of kawakawa be especially vulnerable to fishing?", ["Many gather at one place and time", "They never gather"], "Many gather at one place and time", "WCS reports predictable spawning aggregations, so a single fishing event can affect many breeding fish.", ["ika", "donu"])
    ], { label: "Explore WCS Fiji's grouper guide", href: "https://fiji.wcs.org/Wild-Places/Groupers-and-Coralgroupers.aspx" }),
    "saku vorowaqa": play("A bill like a sword", "Saku vorowaqa is the Fiji name recorded for Xiphias gladius, the swordfish.", "saku vorowaqa", [
      card("Which feature helps distinguish this fish from a reef grouper?", ["A long, flat bill", "A fern frond"], "A long, flat bill", "The bill gives swordfish their English name; kawakawa is a grouper, not this species.", ["kawakawa", "ika"]),
      card("Does FishBase describe this species as oceanic or as a coral-reef grouper?", ["Oceanic", "A coral-reef grouper"], "Oceanic", "The species is listed as pelagic-oceanic; its habitat contrasts with reef-associated kawakawa.", ["kawakawa"])
    ], { label: "See the Fiji swordfish record", href: "https://fishbase.net.br/country/CountrySpeciesSummary.php?c_code=242&id=226" }),
    yaqona: play("The plant and the drink", "Yaqona can name the kava plant or the drink prepared from its root. The phrase tells you which sense is active.", "yaqona", [
      card("If yaqona is growing in a field, which sense is intended?", ["The plant", "A prepared cup"], "The plant", "A growing yaqona is the plant. In a serving context the same word can refer to the prepared drink.", ["nauni", "taukeni gunu"]),
      card("In na yaqona mei Tui, does mei Tui name the plant's owner or the intended drinker?", ["The intended drinker", "The plant's owner"], "The intended drinker", "The phrase uses taukeni gunu. Na yaqona nei Jo would point to another relationship, such as ownership or preparation.", ["mei", "nei"])
    ], { label: "Read Fiji's kava information", href: "https://www.health.gov.fj/kava/" }),
    ika: play("A broad food word, a precise species", "Ika can mean a fish or fish as food. A more specific name can identify which animal is meant.", "ika", [
      card("Is saku vorowaqa a more specific fish name than ika?", ["Yes", "No"], "Yes", "It names swordfish; ika does not identify a species on its own.", ["saku vorowaqa", "kawakawa"]),
      card("Can you call edible balolo an ika merely because it comes from the sea?", ["No", "Yes"], "No", "Balolo is a marine worm. Being edible and marine does not make it a fish.", ["balolo", "vonu"])
    ])
  };
  for (const [key, activity] of Object.entries(additions)) {
    if (Object.hasOwn(window.NAISEMA_WORD_PLAY, key)) throw new Error(`Duplicate dictionary inquiry: ${key}`);
    window.NAISEMA_WORD_PLAY[key] = activity;
  }
})();
