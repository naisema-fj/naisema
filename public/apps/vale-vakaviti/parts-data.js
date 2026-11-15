/* Working house inquiry data. These source leads are not approved public dictionary entries. */
window.NAISEMA_VALE_PARTS = [
  {
    id: "yavu", name: "yavu", english: "raised house platform / foundation", group: "base", point: [51, 80], confidence: "Source-supported name; image position to review",
    see: "Begin beneath a [[duru]]. Which part stays level under the whole frame, and where can you see stone?",
    know: "Viti Rua describes a raised yavu supported with stone, and Viti Va labels the base. Does that evidence fit the role of the stone-edged platform here, even though this exact design is an illustration?",
    question: "If every timber were lifted away, what part of the yavu would remain visible?",
    related: ["duru", "doka"], sources: ["Viti Va, PDF p. 26 (printed p. 21)", "Viti Rua, PDF p. 93 (printed p. 86)"]
  },
  {
    id: "duru", name: "duru", english: "house post / pillar", group: "frame", point: [64, 64], confidence: "Source-supported name; image position to review",
    see: "Choose an upright rising from the [[yavu]]. What does it meet at the top, and how does it differ from the shorter [[latu]]?",
    know: "The Cautata builders set corner duru before the upper frame; one Viti Rua account mentions vesi duru. Can this drawing tell us which wood this post is made from, or only where it stands?",
    question: "Trace this duru upward. Which upper timber would need its support?",
    related: ["yavu", "boutoka", "kautabu"], sources: ["Viti Va, PDF p. 26 (printed p. 21)", "Viti Rua, PDF p. 93 (printed p. 86)", "Cautata study, Table 2 and §5.2.2"]
  },
  {
    id: "doka", name: "doka", english: "roof ridge pole", group: "roof", point: [55, 16], confidence: "Source-supported meaning; image position to review",
    see: "Trace the highest line of the roof. Which sloping [[kaco]] meet that line, and which horizontal timbers cross below it?",
    know: "Viti Va labels the roof-top timber doka; the Cautata builders set doka on king posts after the cross beams. Does its place in that sequence help distinguish it from the lower horizontal roof members?",
    question: "Where does a sloping timber meet the doka, and where does its lower end land?",
    related: ["kaco", "boutoka", "i_cavai"], sources: ["Viti Va, PDF p. 26 (printed p. 21)", "Viti Rua, PDF p. 94 (printed p. 87)", "Cautata study, Table 2 and §5.2.2"]
  },
  {
    id: "boutoka", name: "boutoka", english: "main roof-supporting post; compare bou toka", group: "frame", point: [70, 51], zoomPoint: [70, 45], zoomScale: 1.8, confidence: "Marker on the interior upright; the upper joint is partly hidden by the roof frame",
    see: "Start on the visible interior upright above the [[bou]] point and follow it toward the [[doka]]. Where does the roof lattice hide a possible joint?",
    know: "In the recorded Cautata house, which had no main floor post, bou toka stood on a crossbeam beneath doka. Could the upper section of a continuous bou play that role in another design? Which visible joint would let us test the difference rather than assume both houses were built alike?",
    question: "Can you see one continuous timber through the crossbeam, or a separate upright resting on it?",
    related: ["doka", "i_coka", "bou", "duru"], sources: ["Viti Va, PDF p. 26 (printed p. 21)", "Cautata study, Table 2 and §5.2.2"]
  },
  {
    id: "i_coka", name: "i coka", english: "cross beam / tie beam", group: "frame", point: [76, 39], confidence: "Meaning supported; precise image match to review",
    see: "Follow this timber sideways. Does it join posts in the upper frame, or cross sloping roof members like [[i_cavai]]?",
    know: "The Cautata builders set i coka on posts and later place a roof-supporting upright above a cross beam; Viti Va also labels i coka. Which connection in this drawing best fits that sequence?",
    question: "If this beam connects posts, how could you tell it apart from a roof purlin?",
    related: ["boutoka", "duru", "kautabu", "i_cavai"], sources: ["Viti Va, PDF p. 26 (printed p. 21)", "Cautata study, Table 2 and §5.2.2"]
  },
  {
    id: "kautabu", name: "kautabu", english: "upper wall plate; compare kau tabu", group: "frame", point: [43, 49], confidence: "Spelling and precise image match to review",
    see: "Look along the tops of the [[duru]]. Which horizontal timber runs there, and where do the sloping [[kaco]] approach it?",
    know: "Viti Va prints kautabu; the Cautata study writes kau tabu for a plate set on posts. Does the pictured upper frame show a convincing match, or would another view distinguish it from [[kaukubu]]?",
    question: "Trace one sloping roof member downward. Which timber does it meet before the post?",
    related: ["duru", "kaco", "i_coka"], sources: ["Viti Va, PDF p. 26 (printed p. 21)", "Viti Lima, PDF p. 34 (printed p. 29)", "Cautata study, Table 2 and §5.2.2"]
  },
  {
    id: "kaco", name: "kaco", english: "roof rafter", group: "roof", point: [44, 30], confidence: "Named in Cautata study; mapping to image to review",
    see: "Pick one timber sloping from the [[doka]] toward the edge. Which of [[i_cavai]], [[bolo]], and [[i_vauvau]] cross its path?",
    know: "The Cautata study calls its sloping roof members kaco and fits them before the purlins. Since Viti Va does not label kaco, can we use the construction pattern here without assuming its [[i_sa]] is the same name?",
    question: "Which timbers follow the slope, and which ones link several sloping timbers together?",
    related: ["doka", "i_cavai", "bolo", "i_vauvau", "kautabu"], sources: ["Cautata study, Table 2 and §5.2.2"]
  },
  {
    id: "i_cavai", name: "i cavai", english: "upper roof purlin", group: "roof", point: [60, 24], confidence: "Meaning supported; exact roof row to review",
    see: "Look high on the roof slope. Which horizontal row crosses more than one [[kaco]], and how far is it from [[bolo]]?",
    know: "Viti Va labels i cavai, and the Cautata study places an upper purlin of that name after the rafters. Does this row occupy the same relative position in the selected illustration? The exact match still needs checking.",
    question: "Follow one candidate i cavai across the roof. How many sloping members does it connect?",
    related: ["kaco", "bolo", "i_vauvau", "doka"], sources: ["Viti Va, PDF p. 26 (printed p. 21)", "Cautata study, Table 2 and §5.2.2"]
  },
  {
    id: "bolo", name: "bolo", english: "middle roof purlin in this house context", group: "roof", point: [58, 31], confidence: "Meaning supported; exact roof row to review",
    see: "Find a roof row between [[i_cavai]] above and [[i_vauvau]] below. Does it cross the same sloping [[kaco]]?",
    know: "Viti Va places bolo on the roof, and the Cautata builders call bolo a middle purlin. What does that middle position tell us about this house-part use, while other dictionary senses of bolo stay separate?",
    question: "Compare the three horizontal rows. What stays the same, and what changes as you move down the roof?",
    related: ["i_cavai", "i_vauvau", "kaco"], sources: ["Viti Va, PDF p. 26 (printed p. 21)", "Cautata study, Table 2"]
  },
  {
    id: "i_vauvau", name: "i vauvau", english: "lower roof purlin; spelling comparison pending", group: "roof", point: [53, 38], confidence: "Spelling and exact roof row to review",
    see: "Move down from [[bolo]] toward the eave. Which lower horizontal row crosses several [[kaco]]?",
    know: "Viti Va prints i vauvau; the Cautata study writes vavau for a lower purlin. Do these two forms refer to the same member in their respective houses? A Fijian-language review is needed before treating them as equivalent.",
    question: "What would a builder or speaker need to show us to resolve the i vauvau / vavau difference?",
    related: ["bolo", "i_cavai", "kaco"], sources: ["Viti Va, PDF p. 26 (printed p. 21)", "Cautata study, Table 2"]
  },
  {
    id: "bou", name: "bou", english: "", group: "research", point: [70, 64], zoomPoint: [69, 52], zoomScale: 1.65, provisional: true, pointLocated: true, pointDescription: "upright inside the open floor space", confidence: "Interior upright selected; upper joint and traditional placement still to compare",
    see: "Find the upright planted inside the open floor space, behind the outer posts and the lower rail. How does its position differ from the surrounding [[duru]] and the shorter [[latu]]?",
    know: "The Class 7 building sequence raises bou with duru. The Cautata house, built without a main floor post, instead places a bou toka on a crossbeam. Do these accounts describe the same arrangement? A Malomalo valenivanua account also gives a main support post chiefly meaning there; what evidence would show whether that cultural role belongs in another house?",
    question: "Trace the interior upright toward the [[doka]]. At the upper frame, can you see one continuous timber, or might a separate [[boutoka]] begin there? What closer view could settle that?",
    related: ["duru", "doka", "latu", "boutoka"], sources: ["Viti Va, PDF p. 26 (printed p. 21)", "Viti Lima, PDF p. 34 (printed p. 29)", "Nanuma Lesu 1 (Class 7), PDF p. 60 (printed p. 59)", "Cautata study, §5.2.1–5.2.2", "Valenivanua: Malomalo account, p. 14"]
  },
  {
    id: "kaukubu", name: "kaukubu", english: "", group: "research", point: [19, 50], provisional: true, confidence: "Research pointer only; exact member and English meaning unconfirmed",
    see: "Could kubu's sense of 'at the back' help locate kaukubu? Compare the rear of the textbook drawing with this open frame before choosing a timber.",
    know: "The Class 7 sequence fits kaukubu after duru and bou; Viti Lima places fishing gear there beneath a firewood rack. Does that combination of building order and everyday use point to a particular rear member, or could we be reading the drawing too quickly?",
    question: "What extra view or local explanation would establish the back of this doorless frame?",
    related: ["kautabu", "i_coka"], sources: ["Kubu/back relationship: Fijian-language check still needed", "Viti Va, PDF p. 26 (printed p. 21)", "Viti Lima, PDF p. 35 (printed p. 30)", "Nanuma Lesu 1 (Class 7), PDF p. 60 (printed p. 59)"]
  },
  {
    id: "i_sa", name: "i sa", english: "", group: "research", point: [38, 22], provisional: true, confidence: "Research pointer only; exact member and English meaning unconfirmed",
    see: "Look at the roof area marked i sa in Viti Va. Which members in this different illustration could match it, and what is still hidden?",
    know: "The Class 7 sequence adds i sa after the main frame but before i vauvau, bolo, and i cavai are lashed. Does that order prove i sa and the Cautata builders' [[kaco]] are the same member? The checked passages do not settle that comparison.",
    question: "Which joint or construction step would you ask a builder to show before placing i sa exactly?",
    related: ["doka", "i_cavai", "loru"], sources: ["Viti Va, PDF p. 26 (printed p. 21)", "Nanuma Lesu 1 (Class 7), PDF pp. 60–61 (printed pp. 59–60)", "Cautata study, Table 2 and §5.2.2"]
  },
  {
    id: "loru", name: "loru", english: "", group: "research", point: [28, 19], zoomPoint: [33, 24], zoomScale: 1.65, provisional: true, pointLocated: true, pointDescription: "added end piece at the ridge", confidence: "Both ridge-end pieces drawn from the Class 7 description; form and meaning need local review",
    see: "Inspect the small end piece on this tip of the [[doka]], then find its partner at the other tip. What makes each look added to the ridge rather than part of the same smooth log?",
    know: "The Class 7 account calls the balabala fitted at both doka ends loru. A Malomalo valenivanua account gives such end pieces cultural meaning as two faces of that house. Does a similar shape in another place carry the same meaning, or would we need a local explanation?",
    question: "What would a second house image and a local explanation each add to your understanding of loru?",
    related: ["doka", "i_sa", "i_cavai"], sources: ["Viti Va, PDF p. 26 (printed p. 21)", "Nanuma Lesu 1 (Class 7), PDF p. 61 (printed p. 60)", "Valenivanua: Malomalo account, pp. 14–15"]
  },
  {
    id: "qasiqasi_ni_kalavo", name: "qasiqasi ni kalavo", english: "", group: "research", point: [56, 53], zoomPoint: [56, 49], zoomScale: 1.7, provisional: true, pointLocated: true, pointDescription: "slimmer timber above the entry opening and below kautabu", confidence: "Slim rail above the entry opening selected; traditional name and connections need review",
    see: "Trace this slim timber just below [[kautabu]] and above the entry opening by the steps. Where does it cross a [[duru]], and can you follow it around the visible corner?",
    know: "The revised drawing places this smaller rail above the entry opening and separates it from the thick upper beam. The Class 7 account ties i latu to i qasiqasi ni kalavo, while another account describes a horizontal piece between end posts. Does this position fit those clues? The Cautata study uses a differently spelled term for an upper ridge member in its own house; what could explain that difference?",
    question: "Compare this rail with kautabu above it: which posts and [[latu]] does each touch, and what would a builder say about their different jobs?",
    related: ["duru", "kautabu", "latu"], sources: ["Viti Va, PDF p. 26 (printed p. 21)", "Nanuma Lesu 1 (Class 7), PDF p. 61 (printed p. 60)", "Fiji Times, Discovering Fiji, 16 August 2020", "Cautata study, Table 2"]
  },
  {
    id: "latu", name: "latu", english: "", group: "research", point: [74, 70], zoomPoint: [74, 61], zoomScale: 1.65, provisional: true, pointLocated: true, pointDescription: "one of the slimmer uprights framing the short gable front", confidence: "Repeated wall uprights illustrated; their spacing and local name need builder review",
    see: "Follow one slim upright on the short triangular front, then look for others along that front and the side. Which gaps have been left for the two entrances, and how do those gaps change the rhythm of the wall frame?",
    know: "A Cautata construction study records latu as supplementary wall posts, and the Class 7 sequence connects i latu with i qasiqasi ni kalavo. Does this repeated pattern help explain how a wall could be built? Which connections in this drawing support that reading, and which need a builder's closer look?",
    question: "If the wall uprights repeat on both sides, why leave two gaps here? Would another community or builder use the same spacing and entrances, and what would you ask them to check?",
    related: ["bou", "duru", "qasiqasi_ni_kalavo"], sources: ["Viti Va, PDF p. 26 (printed p. 21)", "Nanuma Lesu 1 (Class 7), PDF p. 61 (printed p. 60)", "Cautata study, Table 2 and §5.2.2"]
  }
];
