(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const storageKey = "naisema-waqa-language-drafts-v1";
  // Roles are working analyses of these particular phrases, not permanent labels for isolated words.
  // Some source spellings and English interpretations still need fluent-speaker review.
  const blockLessons = {
    count: {
      label:"01 · Count the canoes", blocks:["E","tolu","na","waqa"],
      roles:["mata ni wiliwili","wiliwili","mata","yavu · nauni"],
      english:[{text:"There are three",at:2},{text:"canoes.",at:4}],
      sentence:"E tolu na waqa.",
      clues:["Compare the two markers: E introduces the count; na introduces the thing counted.","Tolu gives the quantity; waqa is the nominal base."],
      followUp:"If you change only the last word, what stays the same? Which part would a speaker want to check?",
      source:"Fijian syntax study", url:"https://era.ed.ac.uk/server/api/core/bitstreams/7e2f8cdd-cc5b-4861-a47c-4fc5e982b827/content"
    },
    history: {
      label:"02 · A named drua", blocks:["Na Ra Marama e a","drua","ni","valu","nei","Ratu Cakobau"],
      roles:["named canoe and opening markers · speaker reviewed","canoe type","linking word · review","war","link to named person · review","person named"],
      english:[{text:"The Ra Marama",at:1},{text:"was a war canoe",at:4},{text:"of Ratu Cakobau.",at:6}],
      sentence:"Na Ra Marama e a drua ni valu nei Ratu Cakobau.",
      clues:["Find the named canoe and the words that tell what kind it was.","Compare ni and nei in this complete sentence. What different relationships do they express here?"],
      followUp:"Which part names the canoe, and which part links it to a person? What would a historian verify?",
      source:"Fijian Holdings annual report (2008)", url:"https://fijianholdings.com.fj/wp-content/uploads/2024/06/FHL-Annual-Report-2008.pdf"
    },
    spar: {
      label:"03 · Name the sail spar", blocks:["Na kau na karikari e","igacagaca","ni laca","ni waqa ni Viti"],
      roles:["karikari timber and opening marker · speaker reviewed","component · speaker reviewed","sail relationship · review","canoe relationship · review"],
      english:[{text:"The karikari timber",at:1},{text:"is a component",at:2},{text:"of the sail",at:3},{text:"on a Fijian canoe.",at:4}],
      sentence:"Na kau na karikari e igacagaca ni laca ni waqa ni Viti.",
      clues:["Identify the timber named karikari in a ring before building the explanation.","Which links connect this component to the sail and the canoe?"],
      followUp:"Would a photograph show whether a named karikari is the upper or lower yard? What else would you ask?",
      source:"Fiji Times background; sentence corrected by a native speaker", url:"https://www.fijitimes.com.fj/na-i-vosavosa-vaka-viti-7/"
    },
    voyage: {
      label:"04 · A reported voyage", blocks:["E tukuni ni a","sokotaki","vakatolu","ki Toga na waqa qo"],
      roles:["reporting and past markers · speaker reviewed","voyage action · review","three times","destination and canoe · speaker reviewed"],
      english:[{text:"It is said",at:1},{text:"that this canoe sailed",at:2},{text:"three times",at:3},{text:"to Tonga.",at:4}],
      sentence:"E tukuni ni a sokotaki vakatolu ki Toga na waqa qo.",
      clues:["Locate the reporting words and the past marker a in the approved sentence.","Use the source account to investigate what qo points to before treating the voyage as verified history."],
      followUp:"What evidence would help you investigate the reported journeys?",
      source:"Fiji Times canoe account; sentence corrected by a native speaker", url:"https://www.fijitimes.com.fj/na-italanoa-me-baleta-na-waqa-vaka-viti/"
    },
    oven: {
      label:"05 · Locate the miqa", blocks:["Na miqa e","dau","tava","toka","ena muailiu","ni waqa"],
      roles:["miqa and opening marker · speaker reviewed","habitual marker · review","shaping action · review","position or state · review","toward the front","canoe relationship · review"],
      english:[{text:"The miqa",at:1},{text:"was usually fashioned",at:4},{text:"toward the front",at:5},{text:"of the canoe.",at:6}],
      sentence:"Na miqa e dau tava toka ena muailiu ni waqa.",
      clues:["Find miqa in the source description before deciding where the sentence places it.","Which words speak about its making, and which locate it? Ask a builder what the image cannot show."],
      followUp:"Where would you look for the miqa in a model, and what could a builder confirm?",
      source:"Fiji Times canoe account", url:"https://www.fijitimes.com.fj/na-italanoa-me-baleta-na-waqa-vaka-viti/"
    },
    builders: {
      label:"06 · Two builders", blocks:["E rau a","taya","na waqa","na veitacini e Kabara","baleta ni","levu tu kina na vesi"],
      roles:["two people and past marker · speaker reviewed","building action · review","canoe","siblings and place · speaker reviewed","reason link · speaker reviewed","vesi was plentiful there · speaker reviewed"],
      english:[{text:"The two siblings built a canoe in Kabara",at:4},{text:"because vesi was plentiful there.",at:6}],
      sentence:"E rau a taya na waqa na veitacini e Kabara baleta ni levu tu kina na vesi.",
      clues:["Find the builders, canoe and place in the sentence, then compare them with the account.","Baleta ni connects the reason; what does tu add to this speaker-approved phrasing?"],
      followUp:"Which materials, skills and places would you investigate before retelling this account?",
      source:"Fiji Times account of the Lemaki builders; sentence corrected by a native speaker", url:"https://www.fijitimes.com.fj/na-iwalewale-ni-tara-vale-vakaviti/"
    },
    compare: {
      label:"07 · Compare two canoes", blocks:["Na noqu waqa e","levu cake","na ka","e rawa ni usana","mai vei","na nona waqa"],
      roles:["my canoe and opening marker · speaker reviewed","more","things","can carry · review","comparison link · speaker reviewed","his or her canoe"],
      english:[{text:"My canoe",at:1},{text:"can carry more things",at:4},{text:"than his or her canoe.",at:6}],
      sentence:"Na noqu waqa e levu cake na ka e rawa ni usana mai vei na nona waqa.",
      clues:["Compare noqu and nona in the two whole canoe phrases.","Which words make this a comparison of what each canoe can carry?"],
      followUp:"Could the same comparison describe a drua and another canoe? What would need measuring?",
      source:"Peace Corps comparison exercise; sentence corrected by a native speaker", url:"https://fsi-languages.yojik.eu/languages/PeaceCorps/Fijian/ED131693.pdf"
    },
    adrift: {
      label:"08 · The canoe’s rope", blocks:["Na dali ni waqa e","sa","tasere"],
      roles:["canoe’s rope and opening marker · speaker reviewed","state marker · review","came loose"],
      english:[{text:"The canoe’s rope",at:1},{text:"has come loose.",at:3}],
      sentence:"Na dali ni waqa e sa tasere.",
      clues:["The rope is what has come loose; this sentence does not say the canoe has drifted.","Which words name the rope, and which tell what happened to it?"],
      followUp:"Which attachment would you inspect first, and what would a sailor need to show you?",
      source:"historical comparison; rope sentence supplied by a native speaker", url:"https://upload.wikimedia.org/wikipedia/commons/8/80/A_Fijian_and_English_and_an_English_and_Fijian_dictionary%2C_with_examples_of_common_and_peculiar_modes_of_expression_and_uses_of_words%2C_also%2C_containing_brief_hints_on_native_customs_%28IA_fijianenglishand00hazl%29.pdf"
    },
    cama: {
      label:"09 · What does the cama help?", blocks:["Na cama","ni waqa ni Viti","e kena itavi","me vukea","na soko ni waqa"],
      roles:["cama part name","relationship to Fijian canoe · speaker reviewed","its role · speaker reviewed","to help","the canoe’s travel"],
      english:[{text:"The cama of a Fijian canoe",at:2},{text:"has the role",at:3},{text:"of helping the canoe travel.",at:5}],
      sentence:"Na cama ni waqa ni Viti e kena itavi me vukea na soko ni waqa.",
      clues:["The ni phrase names a relationship to the canoe, not just a location on it.","Point to the part and explain its role with the speaker-reviewed words. Does the same name fit a drua’s hull?"],
      followUp:"Would the word cama fit two equal drua hulls? How would you ask a builder?",
      source:"Fiji Times proverb background; sentence corrected by a native speaker", url:"https://www.fijitimes.com.fj/nai-vosavosa-vaka-viti-16/"
    },
    story: {
      label:"10 · A voyage in an account", blocks:["Ratou","sa","qai","vakavodoki","koya","e","waqa","ka","ratou","soko","vaka","ki","Taveuni"],
      roles:["durusau · small group","durugauna · review","duru · sequence","vu","nauni qali · review","mata ni vanua","yavu · nauni","isema","durusau · small group","vu","direction word · review","mata ni vanua","yaca ni vanua"],
      english:[{text:"They then took him aboard a canoe",at:7},{text:"and sailed",at:10},{text:"toward Taveuni.",at:13}],
      sentence:"Ratou sa qai vakavodoki koya e waqa ka ratou soko vaka ki Taveuni.",
      clues:["Ratou appears twice. Does it refer to the same group in both actions?","This is a story account; investigate its context before treating it as a voyage record."],
      followUp:"Which part would you ask a speaker to explain, and which part could a map help you explore?",
      source:"Fiji Times account from Moturiki", url:"https://www.fijitimes.com.fj/na-yavu-o-benau-e-moturiki-kei-na-nodra-i-dewadewa/"
    },
    tools: {
      label:"11 · Keel and steering oar", blocks:["Era a dau","taya","na itakele,","isa","kei","na iuli ni waqa","mai Muanikau"],
      roles:["group, past and habitual markers · speaker reviewed","cutting action · review","canoe keel","isa · part name for review","joining word","canoe steering oar · speaker reviewed","place"],
      english:[{text:"They used to cut",at:2},{text:"the canoe’s keel, isa, and steering oar",at:6},{text:"at Muanikau.",at:7}],
      sentence:"Era a dau taya na itakele, isa kei na iuli ni waqa mai Muanikau.",
      clues:["Find itakele and iuli in the canoe views before arranging their names.","The full account continues with work at Nukuvula. Which tools or skills would the builders need for the next step?"],
      followUp:"Sketch how you would document one part from a real canoe. What could a builder correct in your sketch?",
      source:"Fiji Times history of Suva; sentence shortened by a native speaker", url:"https://www.fijitimes.com.fj/ko-suva-nikua-kei-na-gauna-sa-oti/"
    },
    named: {
      label:"12 · A canoe in a story", blocks:["Sa ratou qai","lai","taya","kina","e dua na","nodratou waqa","me","kauti ratou","mai i Viti"],
      roles:["group and sequence markers · speaker reviewed","went to · review","build · review","context marker · review","one","their canoe · speaker reviewed","purpose link · review","carry them · review","to Fiji"],
      english:[{text:"They then went to build",at:3},{text:"one of their canoes",at:6},{text:"to bring them",at:8},{text:"to Fiji.",at:9}],
      sentence:"Sa ratou qai lai taya kina e dua na nodratou waqa me kauti ratou mai i Viti.",
      clues:["The opening stays together as one block because the speaker accepts another native order of its words.","Use the story context to identify whose canoe nodratou describes and what journey it was for."],
      followUp:"What can a story preserve about travel, and what evidence would you need for a historical claim?",
      source:"Fiji Times Kubunavanua account; sentence revised by a native speaker", url:"https://www.fijitimes.com.fj/soko-ki-toga-tekivu-me-dromu-ko-burotukula/"
    }
  };
  const lessonIds = Object.keys(blockLessons);
  const wordLessons = [
    {term:"laca", pieces:["la","ca"], clue:"Find the woven surface that catches the wind. What is its Fijian name?", scene:"model", ring:"laca", sentenceId:"spar", meaning:"sail", next:"The related sentence includes laca."},
    {term:"karikari", pieces:["ka","ri","ka","ri"], clue:"Find a timber that supports the sail. Which shared name appears in karikaritu and karikarisila?", scene:"rigging", ring:"karikaritu", sentenceId:"spar", meaning:"sail spar; compare the named upper and lower yards", next:"The related sentence includes karikari. Compare it with the more specific ring name."},
    {term:"uli", pieces:["u","li"], clue:"Follow the long steering paddle or oar. What is its Fijian name?", scene:"steering", ring:"uli", sentenceId:"tools", meaning:"steering paddle or oar", next:"The related sentence shows iuli. Ask a speaker what changed in this phrase."},
    {term:"kata", pieces:["ka","ta"], clue:"This drua has two hulls. What name does the supplied Viti account use for each one?", scene:"model", ring:"kata", sentenceId:"cama", meaning:"hull of this drua", next:"The comparison sentence names cama, not kata. This drua's two hulls remain kata; ask which canoe type the sentence describes."},
    {term:"takele", pieces:["ta","ke","le"], clue:"Look below the illustrated hull for the lowest central member. What name does the historical glossary give it?", scene:"cutaway", ring:"takele", sentenceId:"tools", meaning:"keel in the historical glossary; compare the modern centreboard use", next:"The related sentence shows itakele. Ask a speaker what changed in this phrase."}
  ];
  const boatNouns = ["waqa","drua","cama","laca","karikari","uli","kaso","soka","tau","takele","rara","dreke","vana","vatalaca","valevale"];
  let roleToastTimer;
  let placedBlocks = [];
  let placedWordPieces = [];
  let completedWord = "";
  let completedSentence = "";
  let lastConnectionPair = "";
  let lastPracticePair = "";
  let draggedWordPiece = null;
  let draggedBlock = null;
  let drafts = [];
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (Array.isArray(stored)) drafts = stored.filter(item => item && typeof item.text === "string");
  } catch { /* Device storage may be unavailable. */ }

  function status(message) { $("languageStatus").textContent = message; }
  function renderDrafts() {
    const list = $("languageDrafts");
    list.replaceChildren();
    if (!drafts.length) {
      const empty = document.createElement("li");
      empty.textContent = "Your first working phrase can begin above.";
      list.append(empty);
      return;
    }
    for (const item of drafts) {
      const li = document.createElement("li");
      const kind = document.createElement("span");
      const phrase = document.createElement("strong");
      kind.textContent = item.kind || "Working phrase";
      phrase.textContent = item.text;
      if (item.fijian) phrase.lang = "fj";
      li.append(kind, phrase);
      if (item.note) {
        const note = document.createElement("small");
        note.textContent = item.note;
        li.append(note);
      }
      list.append(li);
    }
  }
  function saveDraft(kind, text, note, fijian = true) {
    drafts.push({kind, text, note, fijian});
    renderDrafts();
    try {
      localStorage.setItem(storageKey, JSON.stringify(drafts));
      status(fijian ? "Saved on this device. Ask a speaker to check the complete phrase." : "Saved on this device. Return to this question when new evidence changes your thinking.");
    } catch {
      status("This draft is visible for this session, but this device did not save it.");
    }
  }

  function currentWord() { return wordLessons[Number($("wordLesson").value)] || wordLessons[0]; }
  function renderWord() {
    const lesson = currentWord();
    if (placedWordPieces.map(index => lesson.pieces[index]).join("") !== lesson.term) completedWord = "";
    $("wordSentence").disabled = !completedWord;
    $("useBuiltWord").disabled = !completedWord;
    const slot = $("wordSlot");
    const bank = $("wordPieces");
    slot.replaceChildren();
    bank.replaceChildren();
    if (!placedWordPieces.length) {
      const hint = document.createElement("span");
      hint.className = "slot-hint";
      hint.textContent = "Build the name here";
      slot.append(hint);
    }
    function pieceButton(index, placed) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = placed ? "word-block placed" : "word-block";
      button.textContent = lesson.pieces[index];
      button.draggable = true;
      button.setAttribute("aria-label", `${lesson.pieces[index]}. Tap to ${placed ? "return this block" : "add this block"}`);
      button.addEventListener("dragstart", event => {
        draggedWordPiece = index;
        event.dataTransfer?.setData("text/plain", String(index));
      });
      button.addEventListener("dragend", () => { draggedWordPiece = null; });
      button.addEventListener("click", () => {
        if (placed) placedWordPieces = placedWordPieces.filter(item => item !== index);
        else placedWordPieces.push(index);
        $("wordFeedback").textContent = `${placedWordPieces.length} of ${lesson.pieces.length} spelling blocks placed. What whole word do they make?`;
        renderWord();
      });
      return button;
    }
    placedWordPieces.forEach(index => slot.append(pieceButton(index, true)));
    lesson.pieces.map((_, index) => index).reverse().filter(index => !placedWordPieces.includes(index)).forEach(index => bank.append(pieceButton(index, false)));
    renderProgressCards();
  }
  $("wordSlot").addEventListener("dragover", event => event.preventDefault());
  $("wordSlot").addEventListener("drop", event => {
    event.preventDefault();
    if (draggedWordPiece === null) return;
    placedWordPieces = placedWordPieces.filter(index => index !== draggedWordPiece);
    placedWordPieces.push(draggedWordPiece);
    draggedWordPiece = null;
    $("wordFeedback").textContent = `${placedWordPieces.length} of ${currentWord().pieces.length} spelling blocks placed. What whole word do they make?`;
    renderWord();
  });
  $("wordPieces").addEventListener("dragover", event => event.preventDefault());
  $("wordPieces").addEventListener("drop", event => {
    event.preventDefault();
    placedWordPieces = placedWordPieces.filter(index => index !== draggedWordPiece);
    draggedWordPiece = null;
    $("wordFeedback").textContent = "Spelling block returned to the bank.";
    renderWord();
  });
  function startWord() {
    const lesson = currentWord();
    placedWordPieces = [];
    completedWord = "";
    $("wordClue").textContent = lesson.clue;
    $("findWordRing").dataset.openPart = lesson.ring;
    $("findWordRing").dataset.scene = lesson.scene;
    $("wordSentence").disabled = true;
    $("useBuiltWord").disabled = true;
    $("wordSentence").textContent = lesson.term === "kata" ? "Compare with cama in a sentence →" : "Build a related sentence →";
    $("wordFeedback").textContent = "Choose a spelling block to begin.";
    renderWord();
  }
  wordLessons.forEach((lesson, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${String(index + 1).padStart(2, "0")} · ${lesson.meaning}`;
    $("wordLesson").append(option);
  });
  $("wordLesson").addEventListener("change", startWord);
  $("resetWord").addEventListener("click", startWord);
  $("checkWord").addEventListener("click", () => {
    const lesson = currentWord();
    if (placedWordPieces.length < lesson.pieces.length) $("wordFeedback").textContent = "Use every spelling block before checking the name.";
    else if (placedWordPieces.map(index => lesson.pieces[index]).join("") !== lesson.term) $("wordFeedback").textContent = "Look at the whole name again. Return a block and try another order.";
    else {
      completedWord = lesson.term;
      $("wordFeedback").textContent = `Correct: ${lesson.term}. ${lesson.next}`;
      $("wordSentence").disabled = false;
      $("useBuiltWord").disabled = false;
      renderApplication();
      renderProgressCards();
    }
  });
  $("wordSentence").addEventListener("click", () => {
    if (!completedWord) return;
    $("blockLesson").value = currentWord().sentenceId;
    startBlocks();
    $("blockLesson").scrollIntoView({behavior:"smooth", block:"center"});
    $("blockLesson").focus({preventScroll:true});
  });
  startWord();

  function blockLesson() { return blockLessons[$("blockLesson").value] || blockLessons.count; }
  function correctPrefix() {
    const answer = blockLesson().blocks;
    let count = 0;
    while (count < placedBlocks.length && answer[placedBlocks[count]] === answer[count]) count += 1;
    return Math.min(count, answer.length);
  }
  function blockProgressMessage() {
    const correct = correctPrefix();
    return correct === placedBlocks.length
      ? `${correct} of ${blockLesson().blocks.length} grammar blocks in order. Keep building.`
      : "That order has a mismatch. Move or return a block; the English meaning will light again when this phrase is in order.";
  }
  function lightEnglish() {
    const lesson = blockLesson();
    // Never signal a correct English phrase while any placed Fijian block is out of order.
    const lit = correctPrefix() === placedBlocks.length ? placedBlocks.length : 0;
    const target = $("blockEnglish");
    target.replaceChildren();
    const label = document.createElement("strong");
    label.textContent = lit === lesson.blocks.length ? "✓ English meaning" : "English meaning";
    target.append(label);
    lesson.english.forEach(piece => {
      const span = document.createElement("span");
      span.textContent = piece.text;
      span.className = "english-chunk";
      if (lit >= piece.at) span.classList.add("lit");
      target.append(span);
    });
    target.classList.toggle("is-complete", lit === lesson.blocks.length);
  }
  function showRole(index) {
    const toast = $("blockRoleToast");
    const lesson = blockLesson();
    clearTimeout(roleToastTimer);
    toast.textContent = `${lesson.blocks[index]} · ${lesson.roles[index]}`;
    toast.hidden = false;
    roleToastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
  }
  function makeBlock(index, placed) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = placed ? "word-block placed" : "word-block";
    button.textContent = blockLesson().blocks[index];
    button.draggable = true;
    button.setAttribute("aria-label", `${button.textContent}. ${placed ? "Tap to return to word bank" : "Tap to add to sentence"}`);
    button.addEventListener("click", () => {
      if (placed) placedBlocks = placedBlocks.filter(item => item !== index);
      else placedBlocks.push(index);
      $("blockFeedback").textContent = blockProgressMessage();
      renderBlocks();
      showRole(index);
    });
    button.addEventListener("dragstart", event => {
      draggedBlock = index;
      event.dataTransfer?.setData("text/plain", String(index));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    });
    button.addEventListener("dragend", () => { draggedBlock = null; });
    if (placed) {
      button.addEventListener("dragover", event => event.preventDefault());
      button.addEventListener("drop", event => {
        event.preventDefault();
        event.stopPropagation();
        if (draggedBlock === null || draggedBlock === index) return;
        const moved = draggedBlock;
        placedBlocks = placedBlocks.filter(item => item !== moved);
        placedBlocks.splice(placedBlocks.indexOf(index), 0, moved);
        draggedBlock = null;
        $("blockFeedback").textContent = blockProgressMessage();
        renderBlocks();
        showRole(moved);
      });
    }
    return button;
  }
  function renderBlocks() {
    const lesson = blockLesson();
    const slot = $("sentenceSlot");
    const bank = $("wordBank");
    slot.replaceChildren();
    bank.replaceChildren();
    if (!placedBlocks.length) {
      const hint = document.createElement("span");
      hint.className = "slot-hint";
      hint.textContent = "Your Fijian sentence grows here";
      slot.append(hint);
    }
    placedBlocks.forEach(index => slot.append(makeBlock(index, true)));
    lesson.blocks.map((_, index) => index).sort((a, b) => ((a + Math.ceil(lesson.blocks.length / 2)) % lesson.blocks.length) - ((b + Math.ceil(lesson.blocks.length / 2)) % lesson.blocks.length)).filter(index => !placedBlocks.includes(index)).forEach(index => bank.append(makeBlock(index, false)));
    lightEnglish();
    if (placedBlocks.length !== lesson.blocks.length || correctPrefix() !== lesson.blocks.length) {
      $("blockLearning").hidden = true;
      completedSentence = "";
    }
    renderProgressCards();
  }
  function startBlocks() {
    placedBlocks = [];
    completedSentence = "";
    clearTimeout(roleToastTimer);
    $("blockRoleToast").hidden = true;
    $("blockSource").href = blockLesson().url;
    $("blockSource").textContent = blockLesson().source;
    $("blockFeedback").textContent = `Sentence ${lessonIds.indexOf($("blockLesson").value) + 1} of ${lessonIds.length}. Choose a block to begin.`;
    $("blockLearning").hidden = true;
    renderBlocks();
  }
  function showBlockLearning() {
    const lesson = blockLesson();
    const panel = $("blockLearning");
    panel.replaceChildren();
    const title = document.createElement("h5");
    title.textContent = lesson.sentence;
    title.lang = "fj";
    const list = document.createElement("ol");
    lesson.clues.forEach(clue => {
      const item = document.createElement("li");
      item.textContent = clue;
      list.append(item);
    });
    const question = document.createElement("p");
    question.textContent = lesson.followUp;
    const source = document.createElement("a");
    source.href = lesson.url;
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    source.textContent = `Check the source context: ${lesson.source}`;
    const apply = document.createElement("button");
    apply.type = "button";
    apply.className = "language-small-button";
    apply.textContent = "Try this pattern with a boat word in Activity 03 →";
    apply.addEventListener("click", () => {
      $("applicationCard").scrollIntoView({behavior:"smooth", block:"start"});
      $("applyNoun").focus({preventScroll:true});
    });
    panel.append(title, list, question, source, apply);
    panel.hidden = false;
  }
  $("blockLesson").addEventListener("change", startBlocks);
  $("sentenceSlot").addEventListener("dragover", event => event.preventDefault());
  $("sentenceSlot").addEventListener("drop", event => {
    event.preventDefault();
    if (draggedBlock === null) return;
    placedBlocks = placedBlocks.filter(item => item !== draggedBlock);
    placedBlocks.push(draggedBlock);
    draggedBlock = null;
    $("blockFeedback").textContent = blockProgressMessage();
    renderBlocks();
    showRole(placedBlocks[placedBlocks.length - 1]);
  });
  $("wordBank").addEventListener("dragover", event => event.preventDefault());
  $("wordBank").addEventListener("drop", event => {
    event.preventDefault();
    if (draggedBlock === null) return;
    placedBlocks = placedBlocks.filter(item => item !== draggedBlock);
    draggedBlock = null;
    $("blockFeedback").textContent = "Block returned to the bank.";
    renderBlocks();
  });
  $("checkBlocks").addEventListener("click", () => {
    const lesson = blockLesson();
    if (placedBlocks.length < lesson.blocks.length) {
      $("blockFeedback").textContent = `Add all ${lesson.blocks.length} blocks, then check the sentence.`;
    } else if (correctPrefix() !== lesson.blocks.length) {
      $("blockFeedback").textContent = "Not yet. The lit English pieces show where the order is correct. Move or tap a block and try again.";
    } else {
      $("blockFeedback").textContent = "Correct! The whole English meaning is lit. Now look at what each Fijian part contributes.";
      completedSentence = $("blockLesson").value;
      showBlockLearning();
      renderProgressCards();
    }
  });
  $("hintBlocks").addEventListener("click", () => {
    const lesson = blockLesson();
    const next = correctPrefix();
    $("blockFeedback").textContent = next < lesson.blocks.length
      ? `Look for “${lesson.blocks[next]}” in position ${next + 1}. What meaning will it light up?`
      : "Every meaning part is lit. Check your sentence.";
  });
  $("resetBlocks").addEventListener("click", startBlocks);

  lessonIds.forEach(id => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = blockLessons[id].label;
    $("blockLesson").append(option);
  });
  $("nextBlocks").addEventListener("click", () => {
    const next = (lessonIds.indexOf($("blockLesson").value) + 1) % lessonIds.length;
    $("blockLesson").value = lessonIds[next];
    startBlocks();
  });
  boatNouns.forEach(word => {
    const option = document.createElement("option");
    option.value = word;
    option.textContent = word;
    $("applyNoun").append(option);
  });
  $("useBuiltWord").addEventListener("click", () => {
    if (!completedWord) return;
    $("applyNoun").value = completedWord;
    $("otherBoatNoun").value = "";
    renderApplication();
    $("applyPreview").scrollIntoView({behavior:"smooth", block:"center"});
  });
  function applicationNoun() { return $("otherBoatNoun").value.trim() || $("applyNoun").value; }
  function renderApplication() {
    const noun = applicationNoun() || "____";
    const pattern = $("applyPattern").value;
    $("applyPreview").textContent = pattern === "count" ? `E tolu na ${noun}.` : `Na noqu ${noun}.`;
    $("applyPatternNote").textContent = pattern === "count"
      ? `Start with ${completedWord || "the part name from 01"}. Compare E · tolu · na · waqa from Activity 02; ask whether the new counted phrase fits.`
      : `Start with ${completedWord || "the part name from 01"}. Compare the source phrase na noqu waqa; ask whether the possession wording fits the new noun.`;
    renderProgressCards();
  }
  ["applyNoun","applyPattern"].forEach(id => $(id).addEventListener("change", renderApplication));
  $("otherBoatNoun").addEventListener("input", renderApplication);
  $("saveApplication").addEventListener("click", () => {
    if (!applicationNoun()) { status("Choose or write a boat noun first."); return; }
    saveDraft("Boat-word pattern to check", $("applyPreview").textContent, "Practice substitution; ask a fluent speaker if this full phrase is natural in context.");
  });

  function renderProgressCards() {
    const lesson = completedSentence ? blockLessons[completedSentence] : null;
    const pair = `${completedWord}|${completedSentence}`;
    $("connectPair").textContent = completedWord && lesson
      ? `${completedWord}  →  ${lesson.sentence}`
      : "Build a part name in 01 and check a sentence in 02 to compare them here.";
    $("inquiryAnchor").textContent = completedWord && lesson
      ? `Part name: ${completedWord}. Sentence: ${lesson.sentence} Practice draft: ${$("applyPreview").textContent || "choose a noun in 03"}`
      : "Your completed word, sentence, and practice draft will appear here.";
    $("changeSentence").textContent = lesson ? lesson.sentence : "Complete a sentence in 02 first.";
    for (const button of $("connectChoices").querySelectorAll("button")) button.disabled = !(completedWord && lesson);
    if (pair !== lastConnectionPair) {
      $("connectFeedback").textContent = completedWord && lesson
        ? "Compare the name with the complete sentence before choosing."
        : "Complete 01 and 02 first.";
      lastConnectionPair = pair;
    }
    $("changeBefore").textContent = $("applyPattern").value === "count" ? "E tolu na waqa." : "Na noqu waqa.";
    $("changeAfter").textContent = $("applyPreview").textContent || "Choose a noun in Activity 03.";
    const practicePair = `${$("changeBefore").textContent}|${$("changeAfter").textContent}`;
    if (lastPracticePair && practicePair !== lastPracticePair) $("changeObservation").value = "";
    lastPracticePair = practicePair;
  }
  for (const button of $("connectChoices").querySelectorAll("button")) {
    button.addEventListener("click", () => {
      const word = completedWord;
      const sentence = blockLessons[completedSentence]?.sentence || "";
      if (!word || !sentence) return;
      const exact = new RegExp(`\\b${word}\\b`, "i").test(sentence);
      const related = !exact && new RegExp(`\\bi${word}\\b`, "i").test(sentence);
      const answer = exact ? "same" : related ? "changed" : "absent";
      if (button.dataset.connection !== answer) {
        $("connectFeedback").textContent = "Look at each full word in the sentence again. Which spelling can you actually find?";
      } else if (answer === "same") {
        $("connectFeedback").textContent = `Yes: ${word} appears in this sentence. Which surrounding words connect it to another part or action?`;
      } else if (answer === "changed") {
        $("connectFeedback").textContent = `Yes: the sentence shows i${word}. Compare it with ${word}; ask a speaker what the difference does in this phrase.`;
      } else {
        $("connectFeedback").textContent = `Yes: ${word} is not in this sentence. Choose a related sentence, or investigate why these two ideas belong together.`;
      }
    });
  }
  $("saveChange").addEventListener("click", () => {
    const before = $("changeBefore").textContent;
    const after = $("changeAfter").textContent;
    const observation = $("changeObservation").value.trim();
    if (!completedWord || !completedSentence) { status("Complete the part name and sentence before comparing their meanings."); return; }
    if (applicationNoun().toLowerCase() !== completedWord.toLowerCase()) { status("Use the part name you built in 01 for this connected comparison. You can explore other nouns afterward."); return; }
    if (before.toLowerCase() === after.toLowerCase()) { status("Choose a different noun in Activity 03 so there is a change to compare."); return; }
    if (!observation) { status("Describe what changed and what a speaker could check first."); $("changeObservation").focus(); return; }
    saveDraft("Word-change comparison", `${before} → ${after}`, observation, false);
  });
  $("carryQuestion").addEventListener("click", () => {
    const lesson = completedSentence ? blockLessons[completedSentence] : null;
    const question = $("nextQuestion").value.trim();
    if (!completedWord || !lesson) { $("carryFeedback").textContent = "Complete a part name and a sentence first."; return; }
    if (applicationNoun().toLowerCase() !== completedWord.toLowerCase()) { $("carryFeedback").textContent = "Use your Activity 01 part name in Activity 03 to connect these three steps."; return; }
    if ($("changeBefore").textContent.toLowerCase() === $("changeAfter").textContent.toLowerCase()) { $("carryFeedback").textContent = "Change a noun in Activity 03 before carrying this inquiry forward."; return; }
    if (!$("changeObservation").value.trim()) { $("carryFeedback").textContent = "First compare your Activity 03 draft with its original pattern in Activity 05."; $("changeObservation").focus(); return; }
    if (!question) { $("carryFeedback").textContent = "Write a question for a sailor or builder first."; $("nextQuestion").focus(); return; }
    saveDraft("Question from a word and sentence", question, `${completedWord} · ${lesson.sentence} · practice draft: ${$("changeAfter").textContent} · ${$("changeObservation").value.trim()}`, false);
    if (!$("synthesisPart").value.trim()) $("synthesisPart").value = completedWord;
    if (!$("synthesisSource").value.trim()) $("synthesisSource").value = `${lesson.sentence} — ${lesson.source}`;
    $("carryFeedback").textContent = "Your name and sentence are ready below. Add what the view shows, the present-day need, and a test.";
    $("synthesisForm").scrollIntoView({behavior:"smooth", block:"start"});
    $("synthesisSeen").focus({preventScroll:true});
  });
  renderDrafts();
  startBlocks();
  renderApplication();
})();
