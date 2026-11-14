(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const language = window.NAISEMA_LANGUAGE;
  const reviewedTranslations = new Map();
  const tr = key => language.t(key);
  const grammarGroupLabel = group => language.locale === 'fj' ? ({'Building blocks':tr('groupBuilding'),'Noun phrase':tr('groupNoun'),'Predicate phrase':tr('groupPredicate'),'Word building and roles':tr('groupWordBuilding'),'Other':tr('groupOther')})[group] || group : group;
  const fallback = {schema:1, generated:"", entries:[], pairs:[], proverbs:[], sources:[]};
  const packagedBase = window.FIJIAN_DATA || fallback;
  let base = packagedBase;
  let edits = {};
  let added = [];
  let proverbEdits = {};
  let proverbAdded = [];
  let selectedId = null;
  let selectedSenseId = null;
  let wordPlayOrigin = null;
  let selectedProverbId = null;
  let selectedGrammarId = null;
  let view = "dictionary";
  let entryLimit = 60;
  let proverbLimit = 50;
  let themeLimit = 80;
  let selectedThemeId = "fiji-fish";
  const alphabet = new Intl.Collator("en", {sensitivity:"base"});
  const approvedSourceNames = new Set(["Fijian-English_Dictionary.pdf", "fijian english volavosa.pdf", "Vosavosavakaviti.pdf", "Handbook of the Fijian language ( PDFDrive ).pdf", "Rorogo vaaviti.pdf", "Nanuma_Lesu_12_2015.pdf", "Ivolavosavakaviti - Copy.pdf", "Tuvavosa_Visual_Guide_PREVIEW.pdf", "Tuvavosa Review Scan.txt", "Fiji NDMO traditional iTaukei calendar", "Te Papa Fijian Language Activity Book", "WWF Fiji Climate Witness Community Toolkit", "NA ISEMA community review", "ICHLinks · Traditional Iconic Mats of Fiji", "JICA · Fiji study report", "University of the South Pacific · Makaluva plant survey", "FAO Ecocrop · Pineapple", "Australian National University · Fiji glossary", "University of Göttingen · Fijian tattooing tools", "The Fiji Times · Batikadi in current reporting", "Austronesian Comparative Dictionary · benu", "The Fiji Times · Counting the iTaukei way", "Kaikki · Fijian bila", "Te Papa · Fijian coconut shell cups", "JICA · Fiji screw pine and bamboo report", "Te Papa · Fijian Language Activity Book", "Handbook of the Fijian Language (1893)", "Fiji Government · Bose Levu Vakaturaga", "Fiji and the Fijians · historical bolebole account"]);
  const packagedWordSourceIds=new Set();
  for(const entry of packagedBase.entries||[]){
    if(entry.reviewBatch!=='2026-10-30-balawa-review'&&!entry.reviewBatch?.startsWith('2026-10-30-word-review-'))continue;
    if(entry.source?.id)packagedWordSourceIds.add(entry.source.id);
    for(const ref of entry.sources||[])if(ref.id)packagedWordSourceIds.add(ref.id);
  }
  for(const source of packagedBase.sources||[])if(packagedWordSourceIds.has(source.id))approvedSourceNames.add(source.name);
  const themeRules = [
    {id:"animals",title:"Animals & birds",description:"Land animals, birds, and insects",match:/^(?:animal|bird|dog|cat|pig|cow|cattle|horse|goat|chicken|duck|hen|rooster|rat|mouse|bat|lizard|snake|frog|insect|butterfly|bee|ant|worm|caterpillar)\b/,extras:[["bunua","bats"]]},
    {id:"baked-foods",title:"Bread, cakes & pastries",description:"Baked staples, treats, and pastry dishes"},
    {id:"body",title:"Body & health",description:"Body parts, illness, and care",match:/^(?:body|head|face|eye|ear|nose|mouth|tooth|teeth|tongue|hand|arm|leg|foot|feet|heart|blood|bone|skin|stomach|pain|illness|disease|fever|medicine|wound|to heal|to hurt)\b/,exclude:/^(?:hand-net|head scratcher)\b/,extras:[["bukete","pregnant"],["botonikete","abdomen"]]},
    {id:"boats",title:"Boats & travel",description:"Vessels, journeys, and travel",match:/^(?:(?:a |the )?(?:trip|journey|voyage)|boat|canoe|ship|sail|paddle|oar|anchor|travel|road|path|to sail|to paddle|to row|to travel|to drive)\b/},
    {id:"calendar",title:"Calendar & traditional months",description:"Seasonal month names and calendar terms. Gregorian month pairings are approximate; an older calendar had 11 months",sourceNames:["Fiji NDMO traditional iTaukei calendar","WWF Fiji Climate Witness Community Toolkit"]},
    {id:"clothes",title:"Clothes & dress",description:"Garments and things worn",match:/^(?:clothing|clothes|shirt|dress|skirt|sulu|hat|shoe|sandal|garment|necklace|bracelet|earring|cloth|fabric)\b/},
    {id:"colors",title:"Colors & appearance",description:"Color, size, and appearance",match:/^(?:red|blue|green|yellow|black|white|brown|purple|colour|color|bright|dark|beautiful|ugly|big|small|long|short|tall|wide|narrow|pale)\b/},
    {id:"deep-water-fish",title:"Deep-water fish",description:"Fish placed in the deep-bottom group on the Fiji food-fish poster"},
    {id:"edible-greens",title:"Edible greens",description:"Leafy vegetables and edible fern or taro leaves"},
    {id:"counting",title:"Wiliwili Vakaviti · counting",description:"Counting words from one to ten",sourceName:"Te Papa Fijian Language Activity Book"},
    {id:"family",title:"Family & people",description:"Relatives, people, and relationships",match:/^(?:person|people|man|woman|child|boy|girl|mother|father|son|daughter|brother|sister|grandfather|grandmother|family|clan|chief|elder|friend)\b/},
    {id:"farming",title:"Farming & tools",description:"Growing, harvesting, and tools",match:/^(?:farm|field|garden|plantation|crop|harvest|tool|knife|axe|spear|hoe|shovel|to plant|to dig|to harvest|to cut)\b/},
    {id:"feelings",title:"Feelings & character",description:"Emotions and personal qualities",match:/^(?:happy|sad|angry|afraid|fear|love|hate|kind|brave|lazy|jealous|proud|shy|honest|honour|honor|respect|ashamed|lonely)\b/},
    {id:"fiji-fish",title:"Fish of Fiji",description:"Fijian fish names with the species kept distinct"},
    {id:"fiji-birds",title:"Birds of Fiji",description:"Fijian bird names and their distinct species"},
    {id:"fishing-traps",title:"Fishing & traps",description:"Fishing grounds, nets, lines, hooks, and ways to catch fish"},
    {id:"sea-life",title:"Fish & sea life",description:"Fish and other sea creatures",match:/^(?:fish|shark|eel|crab|lobster|octopus|turtle|sea cucumber|sea urchin|dolphin|whale|shellfish|oyster|clam|prawn|shrimp|squid|starfish|jellyfish)\b/,exclude:/^(?:fish[- ](?:fence|hook|net|trap)|turtle[- ]fishing people)\b/},
    {id:"food",title:"Food & cooking",description:"Food, drinks, and preparing meals",match:/^(?:food|meal|pudding|bread|rice|taro|yam|cassava|coconut|banana|sugar|salt|soup|meat|water|drink|tea|coffee|to cook|to bake|to eat|to drink|to boil|to fry)\b/,exclude:/^water-logged\b/,extras:[["bu","coconut"],["bolomo","dalo"]]},
    {id:"house",title:"House & home",description:"Buildings, rooms, and their parts",match:/^(?:house|home|building|hut|room|door|doorway|window|wall|roof|ceiling|floor|stairs|stair|house-post|fence)\b/,exclude:/^home-brew\b/,extras:[["doka","ridge"],["bou","house"],["boto","traditional house"],["bulivovo","house fence"]]},
    {id:"learning",title:"Learning & school",description:"School, books, and learning",match:/^(?:school|class|teacher|student|pupil|book|paper|pen|pencil|reading|writing|to read|to write|to learn|to teach)\b/},
    {id:"writing-marks",title:"Writing marks",description:"Fijian names for punctuation and written symbols"},
    {id:"language-varieties",title:"Language & varieties",description:"Home language, shared Fijian, informal speech, and historical labels"},
    {id:"materials",title:"Making & materials",description:"Materials and things people make",match:/^(?:wood|timber|stone|clay|metal|iron|gold|silver|basket|mat|rope|string|weaving|carving|to weave|to carve|to make|to build)\b/},
    {id:"movement",title:"Movement & action",description:"Moving and doing",match:/^to (?:run|walk|go|come|crawl|swim|jump|climb|fly|move|fall|rise|carry|lift|push|pull|throw|turn|step)\b/},
    {id:"music",title:"Music & dance",description:"Music, instruments, singing, and dance",match:/^(?:music|song|dance|drum|guitar|flute|instrument|melody|rhythm|to sing|to dance|to play music)\b/},
    {id:"numbers",title:"Numbers & quantity",description:"Counting and amounts",match:/^(?:(?:one|two|three|four|five|six|seven|eight|nine|ten|many|few|all|some|each)(?:$|[,;.])|number\b|count\b|hundred\b|thousand\b|half\b|double\b|ten (?:bundles|bunches|clubs|fowls)\b)/,extras:[["buru","ten coconuts"]]},
    {id:"open-water-fish",title:"Open-water fish",description:"Pelagic fish placed in the open-water group on the Fiji food-fish poster"},
    {id:"places",title:"Places & direction",description:"Land, settlements, and direction",match:/^(?:place|village|town|city|island|mountain|hill|valley|river|stream|land|forest|east|west|north|south|above|below|inside|outside|near|far)\b/},
    {id:"plants",title:"Plants & trees",description:"Plants and their parts",match:/^(?:plant|tree|shrub|grass|flower|leaf|leaves|root|seed|fruit|palm|fern|bamboo|herb)\b/,extras:[["botatoka","ripe nut"],["burebu","fruit"]]},
    {id:"pronouns",title:"Pronouns",description:"People in speech, including inclusive and exclusive forms",pos:"pronoun"},
    {id:"coast",title:"Sea & coast",description:"Sea, shores, and reef places",match:/^(?:ocean|sea|reef|beach|shore|tide|wave|lagoon|coral|harbour|harbor|current|coast)\b/,extras:[["buna","reef"]]},
    {id:"sky",title:"Sky & stars",description:"Sky, lights, and weather",match:/^(?:star|moon|sun|sky|heaven|planet|cloud|rain|wind|storm|lightning|thunder|sunrise|sunset)\b/,extras:[["cadra","sun, moon or star"],["butoleka","eclipse"]]},
    {id:"speaking",title:"Speaking & listening",description:"Words, voices, and communication",match:/^(?:speech|word|language|voice|sound|to speak|to say|to tell|to ask|to answer|to shout|to whisper|to hear|to listen|to call)\b/},
    {id:"sounds",title:"Speech sounds",description:"Pronunciation terms from Rorogo",sourceName:"Rorogo vaaviti.pdf"},
    {id:"time",title:"Time & seasons",description:"Days, times, and seasons",match:/^(?:day|night|morning|evening|afternoon|today|tomorrow|yesterday|week|month|year|season|time|hour|minute|soon|late|early)\b/},
    {id:"work",title:"Work & trade",description:"Jobs, businesses, trade, and money",match:/^(?:work|job|business|bank|driver|trade|money|wage|employment|occupation|to work)\b/},
    {id:"customs",title:"Traditions & ceremonies",description:"Ceremonies, custom, and shared life",match:/^(?:ceremony|ritual|custom|tradition|kava|yaqona|wedding|funeral|feast|dance|gift|respect)\b/,extras:[["bolebole","traditional challenge"],["butu","solevu"]]},
    {id:"veiqaraqaravi-vakavanua",title:"Veiqaravi Vakavanua",description:"Terms for Fijian ceremonial visiting, welcome, relationships, and departure",extras:[["yaqona","kava"]]}
  ];
  const themeFj = {
    animals:['Manumanu kei na manumanu vuka','Manumanu ni vanua, manumanu vuka kei na manumanu lalai'],
    body:['Yago kei na bula','Tikiniyago, tauvimate kei na veiqaravi'],
    boats:['Waqa kei na ilakolako','Waqa, ilakolako kei na veilakoyaki'],
    calendar:['Kaleda kei na vula vakavanua','Yaca ni vula vakavanua; na veisemati kei na vula vakavalagi e vakatautauvatataki ga'],
    clothes:['iSulu','iSulu kei na veika e daramaki'],
    colors:['Roka kei na irairai','Roka, levu kei na irairai'],
    counting:['Wiliwili vakaViti','Vosa ni wiliwili mai na dua ina tini'],
    family:['Vuvale kei na tamata','Vuvale, tamata kei na nodra veiwekani'],
    farming:['Teitei kei na iyaya','Teitei, tatamusuki kei na iyaya ni cakacaka'],
    feelings:['Yalo kei na itovo','Na veika e vakila na tamata kei na nodra itovo'],
    'sea-life':['Ika kei na bula ni waitui','Ika kei na so tale na manumanu ni waitui'],
    food:['Kakana kei na vakasaqa','Kakana, gunu kei na vakarautaki ni kakana'],
    house:['Vale kei na itikotiko','Vale, kena veitikina kei na itikotiko'],
    learning:['Vuli kei na koronivuli','Koronivuli, ivola kei na vuli'],
    materials:['Buli ka kei na iyaya','Veika e buli kina na iyaya kei na veika e bulia na tamata'],
    movement:['Toso kei na cakacaka','Veitosoyaki kei na cakacaka'],
    music:['Sere kei na meke','Sere, iyaya ni sere kei na meke'],
    numbers:['iWiliwili','Wiliwili kei na levu ni ka'],
    places:['Vanua kei na mua','Vanua, koro kei na veimua'],
    plants:['Kau kei na teitei','Kau, vunikau kei na veitikina'],
    pronouns:['iSosomi','Na vosa e dusi ira na tamata ena veivosaki'],
    coast:['Waitui kei na baravi','Waitui, baravi kei na cakau'],
    sky:['Lomalagi kei na kalokalo','Lomalagi, rarama kei na draki'],
    speaking:['Vosa kei na vakarorogo','Vosa, domo kei na veivosaki'],
    sounds:['Rorogo ni vosa','Na rorogo ni vosa kei na kena cavuti'],
    time:['Gauna kei na vula','Siga, gauna kei na veivula'],
    customs:['iTovo kei na soqo','Soqo, itovo kei na bula vakaveiwekani'],
    'veiqaraqaravi-vakavanua':['Veiqaraqaravi vakavanua','Na veivakacegui kei na veika e vakaraitaki ena soqo vakavanua']
  };
  function themeLabel(rule) {
    if (language.locale !== 'fj' || !themeFj[rule.id]) return rule;
    const [title, description] = themeFj[rule.id];
    return { title, description };
  }

  function key(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim(); }
  function headKey(s) { return String(s || "").normalize("NFC").toLocaleLowerCase().trim(); }
  function node(tag, className, content) { const el = document.createElement(tag); if(className) el.className=className; if(content !== undefined) el.textContent=content; return el; }
  function source(id) { return base.sources.find(s => s.id === id); }
  function entries() { return [...base.entries.map(e => ({...e,...(edits[e.id] || {})})), ...added]; }
  const tuvavosaCodes = {
    kn:'kilanauni',knn:'kilanauni nauni',knv:'kilanauni vu',knd:'kilanauni dusi',
    mnr:'matanauni raraba',mnt:'matanauni toka',mny:'matanauni yaca',mns:'matanauni sosomi',
    mnyv:'matanauni yacanivanua',mnv:'matanauni vanua',mnd:'matanauni dusi',
    mng:'matanauni gauna',mnyt:'matanauni yatuvosa',mw:'mata ni wiliwili',
    ds:'durusau',dg:'durugauna',dl:'duruliu',dm:'durumuri',nq:'nauni qali',
    kv:'kilavu',kvn:'kilavu nauni',kvv:'kilavu vu',de:'dewa',vd:'vu dewa',
    vc:'vucoko',vs:'vusaumaki',vt:'vūtū'
  };
  const linkedTuvavosaNames = [
    'matanauni yacanivanua','matanauni yatuvosa','matanauni raraba','matanauni sosomi',
    'matanauni gauna','matanauni vanua','matanauni dusi','matanauni yaca','matanauni toka',
    'matanauni taukeni','iyatuvosa matanauni','nauni sosomi','ikuri sosomi','kuri sosomi',
    'nauni taukeni kuri','taukeni sosomi','taukeni nauni','taukeni kuri','ikuri taukeni',
    'vosa tautauvata','vosa veibasai','vosa veiganiti','mata ni wiliwili',
    'kilanauni yatuvosa','kilanauni nauni','kilanauni dusi','kilanauni vu',
    'kilavu nauni','kilavu vu','nauni raraba','nauni qali',
    'durugauna','durusau','duruliu','durumuri','ikuriliu','ikurimuri',
    'vucoko','vusaumaki','vūtū','semavosa','iyatuvosa','isosomi','isema',
    'kilanauni','kilavu','wiliwili','sau','qali','mata','vu',
    'matanauni','matavosa','matavu','yavu','duru','nauni','dewa'
  ];
  const tuvavosaPattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${[...linkedTuvavosaNames,...Object.keys(tuvavosaCodes)].sort((a,b)=>b.length-a.length).join('|')})(?![\\p{L}\\p{N}])`,'giu');
  function openTuvavosa(name) {
    const term=entries().find(entry=>entry.englishPos==='grammar term'&&key(entry.fijian)===key(name));
    if(!term)return;
    $('grammar-search').value='';$('grammar-group').value='';selectedGrammarId=term.id;
    setView('grammar');
    $('grammar-detail').scrollIntoView({block:'start',behavior:'smooth'});
  }
  function linkedTuvavosa(tag,className,value) {
    const el=node(tag,className),text=String(value??''),terms=new Set(entries().filter(entry=>entry.englishPos==='grammar term').map(entry=>key(entry.fijian)));
    let position=0;
    for(const match of text.matchAll(tuvavosaPattern)) {
      if(match.index>position)el.append(document.createTextNode(text.slice(position,match.index)));
      const name=tuvavosaCodes[match[0].toLowerCase()]||match[0];
      if(terms.has(key(name))) {
        const link=node('button','tuvavosa-link',match[0]);link.type='button';
        link.title=`Open ${name} in Tuvavosa`;
        link.setAttribute('aria-label',`${match[0]}: open ${name} in Tuvavosa`);
        link.addEventListener('click',()=>openTuvavosa(name));el.append(link);
      } else el.append(document.createTextNode(match[0]));
      position=match.index+match[0].length;
    }
    if(position<text.length)el.append(document.createTextNode(text.slice(position)));
    return el;
  }
  const grammarFunctions = {
    'matanauni raraba':'Nominal phrase with na',
    'matanauni toka':'Nominal phrase without na',
    'matanauni yaca':'Personal-name phrase without na',
    'matanauni sosomi':'Pronoun-based phrase without na',
    'matanauni yacanivanua':'Named-place phrase without na',
    'matanauni vanua':'Location or direction phrase without na',
    'matanauni dusi':'Pointing phrase used on its own',
    'matanauni gauna':'Time phrase used on its own',
    'matanauni yatuvosa':'Clause used where a nominal phrase can stand',
    'kilanauni nauni':'Noun base qualifying a noun',
    'kilanauni vu':'Predicate base qualifying a noun',
    'kilanauni dusi':'Demonstrative qualifier of a noun',
    'kilanauni yatuvosa':'Clause qualifying a noun',
    'kilavu nauni':'Noun base qualifying a predicate',
    'kilavu vu':'Predicate base qualifying another predicate',
    'durusau':'Actor or subject-reference marker',
    'durugauna':'Time, state, or aspect marker',
    'duruliu':'Particle before the predicate base',
    'durumuri':'Particle after the predicate base'
  };
  function grammarFunction(entry) {
    return grammarFunctions[key(entry.fijian)]||learningProse(entry.meaning||'').replace(/^[A-Za-z]{2,5}:\s*/, '')||grammarGroupLabel(entry.grammarGroup||'Other');
  }
  const grammarCodeLabels = {
    'matanauni raraba':'MNR','matanauni toka':'MNT','matanauni yaca':'MNY',
    'matanauni sosomi':'MNS','matanauni yacanivanua':'MNYV','matanauni vanua':'MNV',
    'matanauni dusi':'MND','matanauni gauna':'MNG','matanauni yatuvosa':'MNYt',
    'kilanauni':'kn','kilanauni nauni':'knn','kilanauni vu':'knv','kilanauni dusi':'knd',
    'mata ni wiliwili':'mw','durusau':'ds','durugauna':'dg','duruliu':'dl','durumuri':'dm',
    'nauni qali':'nq','kilavu':'kv','kilavu nauni':'kvn','kilavu vu':'kvv'
  };
  function grammarCode(entry) {
    return grammarCodeLabels[key(entry.fijian)]||/^([A-Za-z]{2,5}):\s/.exec(entry.meaning||'')?.[1]||'';
  }
  function ensureFunctionalContrasts(data) {
    const byId=new Map((data.entries||[]).map(entry=>[entry.id,entry]));
    for(const change of window.FIJIAN_GRAMMAR_CONTRASTS||[]){
      const entry=byId.get(change.id);
      if(!entry||entry.englishPos!=='grammar term'||entry.status==='reviewed'||key(entry.fijian)!==key(change.fijian))continue;
      for(const field of ['meaning','grammarExplanation','grammarExample','comparison','marker']){
        if(change[field]!==undefined)entry[field]=change[field];
      }
      entry.comparisonReview='needs review';
    }
  }
  function approvedMeaning(entry, locale = language.locale) {
    return reviewedTranslations.get(`${entry.id}:${locale}`) || (locale === 'en' && (entry.status === 'reviewed' || entry.meaningStatus === 'reviewed') ? entry.meaning : null);
  }
  function meaningPreview(entry) {
    return learningProse(approvedMeaning(entry)) || (language.locale === 'en' ? learningProse(entry.meaning) || tr('needsMeaning') : tr('translationPending'));
  }
  function meaningPanel(entry) {
    const panel = node('div', 'translated-meaning');
    const approved = approvedMeaning(entry);
    if (approved) {
      panel.append(linkedTuvavosa('p', 'sense-meaning', learningProse(approved)));
    } else if (language.locale !== 'en') {
      panel.append(node('p', 'translation-pending', tr('translationPending')));
      if (entry.meaning) panel.append(node('p', 'english-reference', `${tr('englishReference')}: ${learningProse(entry.meaning)}`));
      if (entry.status !== 'reviewed' && entry.meaningStatus !== 'reviewed') panel.append(node('p', 'source-review', tr('sourceNeedsReview')));
    } else {
      panel.append(linkedTuvavosa('p', 'sense-meaning', learningProse(entry.meaning) || tr('needsMeaning')));
    }
    return panel;
  }
  function displayNote(entry) {
    const note = entry?.notes || '';
    if (!note) return note;
    if (language.locale !== 'fj') return learningNote(note, entry);
    if (entry.reviewBatch === '2026-10-30-tuvavosa-scan') return tr('scanTermNote');
    if (note.startsWith('Extracted from a dictionary PDF;')) return tr('dictionaryPdfNote');
    if (note.startsWith('Fijian grammar term from the supplied visual guide.')) return tr('visualGuideNote');
    if (note.startsWith('Headword and meaning checked against the photographed')) return tr('historicalNote');
    if (note.startsWith('Pronoun form from a historical grammar table.')) return tr('pronounNote');
    if (entry.id === 'founder-qalova-uaua-na-moka') return tr('founderSayingNote');
    return `${tr('englishSourceNote')}: ${note}`;
  }
  // Keep provenance in the Sources panel. Explanations should read as learning guidance.
  function learningNote(note, entry) {
    if (/^Extracted from a dictionary PDF;/.test(note)) return 'Check this meaning and its use in a complete Fijian phrase before approving it.';
    if (/^(?:Readable Gatty HTML|Headword and meaning checked against|Fijian term checked against)/.test(note)) return 'Check spelling and current use in a complete Fijian phrase before approving it.';
    if (/^(?:Scan based|Source-led|Tuvavosa teaching explanation|Short English explanation cross-checked|Provisional paraphrase from|Prefix pattern from)/.test(note)) return 'This explanation and its use in a complete Fijian phrase need team review.';
    if (/^Person and number table transcribed/.test(note)) return 'Check person, number, inclusion, spelling and phrase role before approving these forms.';
    if (/^The sentence and ds/.test(note)) return 'The sentence and word roles need fluent-speaker review.';
    if (/^The photographed source says a turaga bale/.test(note)) return 'This meaning belongs to the phrase turaga bale; it may not apply to bale in every context.';
    if (/^The photographed historical page gives this alignment sense/.test(note)) return 'This alignment sense can describe fitting or corresponding in position. The relation with veibasai needs speaker review.';
    if (/^The photographed page says wave/.test(note)) return 'Check the water context and the relation to ua in a complete Fijian phrase.';
    if (/^Photographed page 19 mentions ivi/.test(note)) return 'Ingredients can vary. A historical judgement about bread quality is not part of this word’s meaning.';
    if (/^Photographed page 20 and a JICA report/.test(note)) return 'Bitu can refer to bamboo; a separate compound names a bamboo flute.';
    if (/^Photographed page 25 gives this collective sense/.test(note)) return 'A possible extension to the tree these hang from needs review.';
    if (/^Photographed page 27 gives broken/.test(note)) return 'The meaning may narrow to items cracked open in some contexts. Check a complete phrase.';
    if (/^Photographed page 27 gives the measurement/.test(note)) return 'Caga can describe a span. Its use may vary by region and needs review.';
    if (/^Photographed page 28 identifies/.test(note)) return 'Cama is used in a canoe outrigger context.';
    if (/^The photographed page describes misty/.test(note)) return 'This may describe misty, double or indistinct vision. Figurative use needs a Fijian example.';
    if (/^Photographed page 20 and Te Papa/.test(note)) return 'Bogi ni gone names a part of a child’s head; keep that compound separate.';
    if (entry.status !== 'reviewed' && entry.source?.id !== 'personal' && /\b(?:source|photograph|scan|OCR|PDF|Gatty|HTML)\b/i.test(note)) return 'Check this meaning and its use in a complete Fijian phrase before approving it.';
    return learningProse(note);
  }
  function learningProse(value) {
    return String(value || '')
      .replace(/A fence enclosing a garden or town; the historical source distinguishes it from a house fence\./g, 'A fence enclosing a garden or town; distinct from a house fence.')
      .replace(/To lie in wait for someone in order to attack; the historical source also describes a night raid\./g, 'To lie in wait for someone in order to attack; also used for a night raid.')
      .replace(/The afternoon or evening; the source also uses the related form vakayakavi for an evening meal\./g, 'The afternoon or evening; vakayakavi is a related form for an evening meal.')
      .replace(/To rise or emerge, especially of the sun or moon; the historical source also applies it to teeth coming through\./g, 'To rise or emerge, especially of the sun or moon; also used for teeth coming through.')
      .replace(/A reef-dwelling organism described as a zoophyte in the historical source\./g, 'A reef-dwelling organism historically described as a zoophyte.')
      .replace(/the source's alternate label for druabalavu/g, 'Another label for druabalavu')
      .replace(/Dewa forms in the photographed Tuvavosa page/g, 'Dewa forms')
      .replace(/Illustrated forms are from the source page; they are not a rule for generating new words\./g, 'These forms are examples, not a rule for generating new words.')
      .replace(/Durumuri · photographed order contrasts/g, 'Durumuri · order contrasts')
      .replace(/An asterisk is the photographed source's rejected order for that contrast\./g, 'An asterisk marks an excluded order for that contrast.')
      .replace(/Parentheses reflect the scan's context-dependent omission/g, 'Parentheses mark context-dependent omission')
      .replace(/ Scan pages 4-4–4-6; ANU Table 7\.2 independently checks the paradigm\./g, '')
      .replace(/ Scan page 4-3; examples need team review\./g, ' Example wording needs team review.')
      .replace(/The source's compact sequence is/g, 'The compact sequence is')
      .replace(/These are independent pronoun forms in the source table;/g, 'These are independent pronoun forms;')
      .replace(/Iratou follows the scan and the independent study; the typed variant ‘raout’ needs speaker review\./g, 'The variant ‘raout’ needs speaker review.')
      .replace(/These are learning examples from the supplied scan and still need team review\./g, 'The example wording needs team review.')
      .replace(/These phrases are from a supplied OCR scan and need page-image and team review\./g, 'The phrase wording needs team review.')
      .replace(/The independent academic example na vale ni koli supports the nonhuman common-noun pattern;/g, 'Na vale ni koli illustrates a nonhuman common-noun pattern;')
      .replace(/The scan examples are learning evidence, not approved dictionary translations\./g, 'The example meanings need team review.')
      .replace(/Attached forms from the supplied Tuvavosa page image 3-21, cross-checked against a published Standard Fijian paradigm\./g, 'These attached forms show different person and number combinations.')
      .replace(/The photographed page distinguishes short and long ending families\./g, 'Dewa endings have short and long families.')
      .replace(/The scan places isema first where present/g, 'Isema comes first when present')
      .replace(/The source contrasts distribution/g, 'The order distinguishes distribution')
      .replace(/in the photographed matavu pattern/g, 'in a matavu')
      .replace(/in the photographed constructions/g, 'in these constructions')
      .replace(/in the page's examples/g, 'in these examples')
      .replace(/in the photographed counted-phrase pattern/g, 'in a counted phrase')
      .replace(/in the photographed three-part pattern/g, 'in this three-part pattern')
      .replace(/in the photographed classification/g, 'in this use')
      .replace(/The photographed teaching scheme/g, 'The dewa classes')
      .replace(/This is the photographed source's phrase analysis; check variety and sentence context\./g, 'Check the variety and the whole sentence before assigning this role.')
      .replace(/as in the photographed /g, 'as in ')
      .replace(/in the photographed section/g, 'in this use')
      .replace(/The page notes a Lau variety difference\./g, 'Lau usage may differ.')
      .replace(/The page rejects/g, 'This construction excludes')
      .replace(/The page contrasts them/g, 'These forms differ')
      .replace(/and rejects treating/g, 'and excludes treating')
      .replace(/Examples also show examples/g, 'Examples also include forms')
      .replace(/When knv and knd also occur, the order is the three as/g, 'When knv and knd also occur, the order is')
      .replace(/When knn and knd also occur, the order is them/g, 'When knn and knd also occur, the order is')
      .replace(/in this pattern's three-part order/g, 'in the three-part order')
      .replace(/this pattern teaches/g, 'the pattern is')
      .replace(/this pattern illustrates/g, 'the pattern uses')
      .replace(/The pattern gives/g, 'Examples include')
      .replace(/The pattern lists/g, 'The forms include')
      .replace(/and source before filling a position/g, 'and meaning before assigning a role')
      .replace(/The first kind of duruliu in the scan/g, 'The first kind of duruliu')
      .replace(/The photographed page pairs/g, 'Examples pair')
      .replace(/The scan identifies/g, 'The main types are')
      .replace(/in the source's knn → knv → knd sequence/g, 'in the knn → knv → knd sequence')
      .replace(/in this scan/g, 'here')
      .replace(/which the scan treats as/g, 'which is')
      .replace(/In the photographed pattern/g, 'In this pattern')
      .replace(/In the photographed Standard Fijian analysis/g, 'In Standard Fijian')
      .replace(/The source's e rua na gone shows/g, 'E rua na gone shows')
      .replace(/The scan uses this label for/g, 'This label describes')
      .replace(/The scan's examples have/g, 'These examples have')
      .replace(/The scan's three-part order/g, 'the three-part order')
      .replace(/the scan orders the three as/g, 'the order is')
      .replace(/the scan orders them/g, 'the order is')
      .replace(/In the scan's taukeni sosomi pattern/g, 'In taukeni sosomi')
      .replace(/The scan's kuri sosomi table gives/g, 'Kuri sosomi includes')
      .replace(/The scan also shows/g, 'Other examples include')
      .replace(/The scan gives/g, 'Examples include')
      .replace(/The scan teaches/g, 'The pattern is')
      .replace(/The scan illustrates/g, 'The pattern is')
      .replace(/The scan introduces taukeni as/g, 'Taukeni is')
      .replace(/The scan discusses substitution across/g, 'Substitution occurs across')
      .replace(/The scan discusses other uses of vei-/g, 'Vei- has other uses')
      .replace(/The scan discusses/g, 'Examples include')
      .replace(/The scan also describes/g, 'There are also')
      .replace(/One reduplication pattern described in the scan/g, 'A reduplication pattern')
      .replace(/One of several uses of vaka- discussed in the scan/g, 'One use of vaka-')
      .replace(/In the scan/g, 'Here')
      .replace(/The scanned form is/g, 'The form is')
      .replace(/The supplied scan shows/g, 'This pattern places')
      .replace(/The photographed page lists/g, 'The forms include')
      .replace(/The photographed page gives/g, 'Examples include')
      .replace(/The photographed page uses/g, 'Examples use')
      .replace(/The photographed page also shows examples/g, 'Examples also include forms')
      .replace(/The photographed page also shows/g, 'Examples also show')
      .replace(/The photographed page notes/g, 'There is')
      .replace(/The photographed page permits/g, 'The pattern permits')
      .replace(/The photographed page/g, 'The pattern')
      .replace(/the photographed page/g, 'the pattern')
      .replace(/the photographed Tuvavosa page/g, 'this pattern')
      .replace(/The source's alternate label for/g, 'Another label for')
      .replace(/The source also gives/g, 'A related form is')
      .replace(/The source/g, 'The pattern')
      .replace(/the source/g, 'the pattern')
      .replace(/the supplied scan/g, 'this pattern')
      .replace(/the scan/g, 'this pattern')
      .replace(/source spelling\/capitalization varies/gi, 'spelling and capitalization vary')
      .replace(/\bOCR wording and /g, '')
      .replace(/\bSource-led /g, '')
      .replace(/\bsource-led /g, '');
  }
  function proverbs() { return [...(base.proverbs || []).map(p => proverbEdits[p.id] || p), ...proverbAdded]; }
  function sourceName(id) { return source(id)?.name || tr('personalNote'); }
  function sanitizeRecord(e, ids) { return {...e, sources:(e.sources || [e.source]).filter(ref => ref && (ref.id === "personal" || ids.has(ref.id)))}; }
  function sanitizeDataset(data) {
    const localPreview=['localhost','127.0.0.1'].includes(location.hostname);
    data.sources = (data.sources || []).filter(s => localPreview || approvedSourceNames.has(s.name) || (packagedBase.sources || []).some(item => item.id === s.id));
    const ids = new Set(data.sources.map(s => s.id));
    const allowed = e => e?.source?.id === "personal" || ids.has(e?.source?.id);
    data.entries = (data.entries || []).filter(allowed).map(e=>sanitizeRecord(e,ids));
    data.proverbs = (data.proverbs || []).filter(allowed).map(e=>sanitizeRecord(e,ids));
    data.pairs = [];
    return data;
  }
  function ensureFirst300Release(data) {
    // Older browser copies should receive packaged meanings and sayings.
    // Keep independently approved records and the separate local edit layers.
    const sources = new Set((data.sources || []).map(item => item.id));
    for (const source of packagedBase.sources || []) {
      if (!sources.has(source.id)) { data.sources.push({...source}); sources.add(source.id); }
    }
    const byId = new Map((data.entries || []).map(item => [item.id, item]));
    for (const packaged of packagedBase.entries || []) {
      if (packaged.meaningReviewedBatch !== '2026-11-01-first-300-english-meanings') continue;
      const current = byId.get(packaged.id);
      if (current?.status === 'reviewed' && current.meaning !== packaged.meaning) continue;
      if (current) Object.assign(current, packaged);
      else { data.entries.push({...packaged}); byId.set(packaged.id, packaged); }
    }
    const sayings = new Map((data.proverbs || []).map(item => [item.id, item]));
    for (const packaged of packagedBase.proverbs || []) {
      if (!['2026-11-01-original-saying-meanings', '2026-11-01-founder-saying-meaning'].includes(packaged.reviewBatch)) continue;
      const current = sayings.get(packaged.id);
      if (current?.status === 'reviewed' && current.meaning !== packaged.meaning) continue;
      if (current) Object.assign(current, packaged);
      else { data.proverbs.push({...packaged}); sayings.set(packaged.id, packaged); }
    }
    return data;
  }
  function ensureLatestPublishedEntries(data) {
    // Older browser copies keep their edits while receiving newly packaged words.
    const batches=new Set(['2026-11-01-founder-food-words-local','2026-11-01-fiji-foodfish2-local','2026-11-01-veiqaraqaravi-culture','2026-11-01-veiqaraqaravi-full-guide']);
    const ids=new Set((data.entries||[]).map(entry=>entry.id));
    const sourceIds=new Set((data.sources||[]).map(item=>item.id));
    const needed=new Set();
    for(const entry of packagedBase.entries||[]){
      const reviewedEnglish=entry.publicBatch==='2026-11-02-english-meaning-release';
      if(!batches.has(entry.reviewBatch)&&!reviewedEnglish)continue;
      if(entry.source?.id)needed.add(entry.source.id);
      for(const ref of entry.sources||[])if(ref.id)needed.add(ref.id);
      if(ids.has(entry.id)){
        if(reviewedEnglish){
          const current=data.entries.find(item=>item.id===entry.id);
          if(current?.status!=='reviewed')Object.assign(current,entry);
        }
        continue;
      }
      data.entries.push({...entry});ids.add(entry.id);
    }
    for(const item of packagedBase.sources||[]){
      if(!needed.has(item.id)||sourceIds.has(item.id))continue;
      data.sources.push({...item});sourceIds.add(item.id);
    }
    return data;
  }
  function ensureGrammarTerms(data) {
    const grammar = (packagedBase.entries || []).filter(entry => entry.englishPos === "grammar term");
    if (!grammar.length) return data;
    const sourceIds = new Set(data.sources.map(item => item.id));
    for (const item of packagedBase.sources || []) {
      if (grammar.some(entry => entry.source?.id === item.id) && !sourceIds.has(item.id)) data.sources.push({...item});
    }
    const byId = new Map(data.entries.map(entry => [entry.id, entry]));
    for (const entry of grammar) {
      const current = byId.get(entry.id);
      if (!current) { data.entries.push({...entry}); continue; }
      if (entry.reviewBatch === '2026-10-30-tuvavosa-scan' && current.status !== 'reviewed' &&
          ['534756bd7910', 'tuvavosa-review-scan-2026-10-30'].includes(current.source?.id)) {
        Object.assign(current, entry);
      }
    }
    return data;
  }
  function ensurePhoto44Evidence(data) {
    // Keep existing imported collections intact. Only append the new photo
    // senses, and refresh an old explanation when its original text is exact.
    const batch='2026-10-31-tuvavosa-4-4-4-5-photos';
    const packaged=(packagedBase.entries||[]).filter(entry=>entry.reviewBatch===batch);
    if(!packaged.length)return data;
    const neededIds=new Set(packaged.flatMap(entry=>(entry.sources||[entry.source]).filter(Boolean).map(ref=>ref.id)));
    for(const item of packagedBase.sources||[]){
      if(neededIds.has(item.id)&&!data.sources.some(source=>source.id===item.id))data.sources.push({...item});
    }
    const byId=new Map(data.entries.map(entry=>[entry.id,entry]));
    for(const entry of packaged){
      const current=byId.get(entry.id);
      if(!current){data.entries.push({...entry});byId.set(entry.id,entry);continue;}
      const previous=entry.photoRepairFrom;
      if(!previous||current.status==='reviewed'||current.englishPos!=='grammar term')continue;
      if(current.meaning!==previous.meaning||current.grammarExplanation!==previous.grammarExplanation||
         (current.grammarExample||'')!==previous.grammarExample)continue;
      for(const field of ['grammarExplanation','grammarExample','matavuTable','sources','photoRepairFrom','reviewBatch']){
        if(entry[field]!==undefined)current[field]=entry[field];
      }
    }
    return data;
  }
  function ensureSentenceOrderEvidence(data) {
    const batch='2026-10-31-tuvavosa-sentence-order-audit';
    const packaged=(packagedBase.entries||[]).filter(entry=>entry.reviewBatch===batch&&entry.sentenceOrderRepairFrom);
    const byId=new Map(data.entries.map(entry=>[entry.id,entry]));
    for(const entry of packaged){
      const current=byId.get(entry.id),previous=entry.sentenceOrderRepairFrom;
      if(!current||current.status==='reviewed'||current.englishPos!=='grammar term')continue;
      if(current.grammarExplanation!==previous.grammarExplanation||
         (current.grammarExample||'')!==previous.grammarExample||
         JSON.stringify(current.matavuTable||null)!==JSON.stringify(previous.matavuTable||null))continue;
      for(const field of ['grammarExplanation','grammarExample','matavuTable','sentenceOrderRepairFrom','reviewBatch']){
        if(entry[field]!==undefined)current[field]=entry[field];
      }
    }
    return data;
  }
  function ensureMatanauniSet01Evidence(data) {
    const batch='2026-10-31-matanauni-set-01';
    const packaged=(packagedBase.entries||[]).filter(entry=>entry.reviewBatch===batch);
    if(!packaged.length)return data;
    const neededIds=new Set(packaged.flatMap(entry=>(entry.sources||[entry.source]).filter(Boolean).map(ref=>ref.id)));
    for(const item of packagedBase.sources||[]){
      if(neededIds.has(item.id)&&!data.sources.some(source=>source.id===item.id))data.sources.push({...item});
    }
    const byId=new Map(data.entries.map(entry=>[entry.id,entry]));
    for(const entry of packaged){
      const current=byId.get(entry.id);
      if(!current){data.entries.push({...entry});byId.set(entry.id,entry);continue;}
      const previous=entry.matanauniSet01RepairFrom;
      if(!previous||current.status==='reviewed'||current.englishPos!=='grammar term')continue;
      if(current.grammarExplanation!==previous.grammarExplanation||
         (current.grammarExample||'')!==previous.grammarExample)continue;
      for(const field of ['grammarExplanation','grammarExample','sources','matanauniSet01RepairFrom','reviewBatch']){
        if(entry[field]!==undefined)current[field]=entry[field];
      }
    }
    return data;
  }
  function ensureTuvavosaEvidence(data) {
    // Existing visitors may have an older IndexedDB dataset. Add only new
    // phrase evidence to unreviewed source entries; preserve reviewer edits.
    const sampleIds=new Set(['kilavu','kilavu nauni','kilavu vu','kilanauni','kilanauni nauni','kilanauni vu','kilanauni dusi','mata ni wiliwili','wiliwili','ikuriliu','matanauni raraba','matanauni toka','matanauni yaca','matanauni sosomi','matanauni yacanivanua','matanauni vanua','matanauni dusi','matanauni yatuvosa','matanauni sema','sosoqoni','veitokoni']);
    const previousMatanauni=new Map([
      ['matanauni raraba',['nominal phrase with na as a marker','A kind of matanauni (whole noun phrase) typically introduced by na. This is a phrase type, distinct from nauni raraba, a common noun used as a word base.']],
      ['matanauni toka',['nominal phrase without the marker na','In the scan this family includes phrases built around a personal name, pronoun, place name or location expression. Its other markers depend on the kind of phrase.']],
      ['matanauni yaca',['nominal phrase centred on a personal name','A subtype of matanauni toka. The scan discusses markers such as o, vei, i and kei in different contexts; a sentence is needed to decide the role.']],
      ['matanauni sosomi',['nominal phrase built with a pronoun','A subtype of matanauni toka in which a pronoun stands in a nominal position. Compare the same participant referred to by a durusau inside a predicate phrase.']],
      ['matanauni yacanivanua',['nominal phrase centred on a place name','A subtype of matanauni toka. A place name can appear with different markers according to whether the phrase names a place, a location or a direction.']],
      ['matanauni vanua',['nominal phrase referring to a location','A subtype of matanauni toka for a location expression. The scan discusses e, i and mai with this pattern.']],
      ['matanauni dusi',['demonstrative or pointing noun phrase','Points toward what is near the speaker, near the listener, or away from both.']],
      ['matanauni yatuvosa',['clause functioning as a noun phrase','A clause introduced by a marker such as ni, me, se or de and used as a nominal part of a larger expression.']],
      ['matanauni sema',['linked nominal phrases acting together','Two or more matanauni may share a role in a sentence. The scan distinguishes groups joined together from phrases that identify the same referent.']],
      ['sosoqoni',['nominal phrases grouped in one sentence role','The scan uses this label for linked matanauni with distinct referents that act together in the sentence.']],
      ['veitokoni',['nominal phrases referring to the same person or thing','The scan contrasts this relationship with sosoqoni: the linked matanauni support one another in identifying a referent.']],
      ['ikuriliu',['prefix attached before a base','An element before a base that helps derive a form or meaning; examples include vei-, vaka-, i- and dau-.']],
      ['kilanauni',['noun-phrase qualifier or modifier','An element following a nominal base; it may be a noun, predicate-like word, demonstrative, or whole clause.']],
      ['wiliwili',['number or quantity expression in a noun phrase','A number or quantity word that can modify a matanauni, often with a marker such as e or na.']],
      ['kilanauni dusi',['pointing expression that qualifies a nominal base','A dusi form can follow and help identify a nominal base inside a matanauni. Check what it points to in the full phrase.']],
      ['kilanauni nauni',['nominal base used to qualify another nominal base','A nauni can follow another nominal base and narrow its meaning in a matanauni.']],
      ['kilanauni vu',['predicate base used to qualify a nominal base','A vu can help describe a nominal base within a matanauni; its role in that phrase should be considered before assigning an English grammar label.']],
      ['mata ni wiliwili',['marker placed before a quantity expression','The scan treats this as part of the pattern for expressing a quantity within a matanauni. The marker and surrounding phrase determine its use.']]
    ]);
    for(const sourceId of ['nanuma-lesu-12-2015-role','nanuma-lesu-12-online-mnd-mnyt','sangam-kilanauni-worksheet-2021','fijian-pronoun-paradigm-study']){
      const source=packagedBase.sources.find(item=>item.id===sourceId);
      if(source&&!data.sources.some(item=>item.id===source.id))data.sources.push({...source});
    }
    const currentById=new Map(data.entries.map(entry=>[entry.id,entry]));
    for(const packaged of packagedBase.entries){
      const current=currentById.get(packaged.id);
      if(!current||current.status==='reviewed')continue;
      if(packaged.roleAnalyses?.length)current.roleAnalyses=packaged.roleAnalyses.map(item=>({...item}));
      if(packaged.englishPos==='grammar term'&&sampleIds.has(packaged.fijian)){
        const previous=previousMatanauni.get(packaged.fijian);
        if(previous&&(current.meaning!==previous[0]||current.grammarExplanation!==previous[1]))continue;
        for(const field of ['meaning','grammarExplanation','grammarExample','sources','notes'])if(packaged[field])current[field]=packaged[field];
        if(previous&&['matanauni dusi','matanauni yatuvosa','ikuriliu','kilanauni','wiliwili','kilanauni dusi','kilanauni nauni','kilanauni vu','mata ni wiliwili'].includes(packaged.fijian))current.source={...packaged.source};
      }
      if(packaged.fijian==='nauni sosomi'&&current.englishPos==='grammar term'&&
         current.meaning==='independent pronoun used in a nominal position'&&
         current.grammarExplanation==='A form standing for a known person or participant in a noun-phrase position; compare actor markers such as durusau.'){
        for(const field of ['grammarExplanation','pronounTable','sources','notes'])current[field]=packaged[field];
      }
    }
    return data;
  }
  function ensureTaukeniEvidence(data) {
    // Refresh only unchanged, unreviewed explanations in older browser data.
    // Reviewer edits remain authoritative.
    const previous=new Map([
      ['taukeni',[
        ['possessive relationship','Patterns linking people or things to possessions and other relationships, including ne-/no-, ke-, me- and suffixed forms.'],
        ['possessive relationship','A relationship between the yavu of a matanauni and another person or thing. It can mean ownership, the maker or performer, intended recipient or topic, food or drink for someone, or a direct body-part/kinship relation. Choose the relation before translating English \'someone\'s\'.']
      ]],
      ['taukeni nauni',[
        ['possession expressed with a named owner','A possessive relationship in which the owner is named rather than represented by a pronoun. The form depends on the relationship being expressed.'],
        ['taukeni with a named-person owner','In the scan\'s teaching pattern, a matanauni raraba with a named-person owner is na + yavu + optional kilanauni + relationship marker + i + NY. The marker is ne-, ke-, me-, or empty according to the relationship; surface forms include nei, kei, mei, and i. NY means nauni yaca.']
      ]],
      ['matanauni taukeni',[
        ['noun phrase expressing a possessive or related relationship','The scan introduces taukeni as a component of a matanauni. For a named person (NY), its teaching pattern is na + yavu + optional kilanauni + t + i + NY; t identifies the relationship. Pronoun and common-noun owners use different patterns.']
      ]],
      ['taukeni kuri',[[ 'direct relationship of a body part, kin member, or related part','With a named person, the scan places i after the relational yavu, without a separate ne-, ke-, or me- marker. With a pronoun owner, many such bases take a possessive suffix. Check each lexical base individually.' ]]],
      ['taukeni sosomi',[
        ['possession expressed with a pronoun',"A possessive relationship in which a form refers to the owner without repeating the person's name."],
        ['possession expressed with a pronoun','When a pronoun identifies the person, the pattern changes: the possessive element precedes the yavu, as in na noqu vale or na neimami dui vale. Do not mechanically substitute a pronoun into the named-person NY pattern.']
      ]],
      ['nauni taukeni kuri',[
        ['nominal base with a possessive ending','The scan discusses some relationship and body part expressions that take a possessive addition. This pattern is not automatic for every such word.'],
        ['relational nominal base used with a direct possessive addition','Some kinship and body-part bases can take a possessive suffix with a pronoun owner, such as na yavaqu, or a linking i before a named person, such as na tama i Jone. This is not automatic for every kinship or body word.']
      ]],
      ['ikuri taukeni',[[ 'bound addition involved in a possessive form','A word building element used in some expressions of possession. The appropriate pattern must be checked for each expression.' ]]],
      ['ikuri sosomi',[[ 'bound addition that refers to a participant','The scan groups some attached participant forms with independent and marker based isosomi forms.' ]]]
    ]);
    const sourceIds=new Set(data.sources.map(item=>item.id));
    for(const item of packagedBase.sources){
      if(!['qmul-fijian-possession-2019','qmul-fijian-noun-phrase-2019','fijian-tama-i-jone-example'].includes(item.id)||sourceIds.has(item.id))continue;
      data.sources.push({...item});sourceIds.add(item.id);
    }
    const packagedById=new Map(packagedBase.entries.map(entry=>[entry.id,entry]));
    for(const current of data.entries){
      const old=previous.get(current.fijian),packaged=packagedById.get(current.id);
      if(!old||!packaged||current.status==='reviewed'||!old.some(([meaning,explanation])=>current.meaning===meaning&&current.grammarExplanation===explanation))continue;
      for(const field of ['meaning','grammarExplanation','grammarExample','pronounTable','possessionTable','commonOwnerTable','sources','notes','reviewBatch']){
        if(packaged[field]!==undefined)current[field]=packaged[field];
      }
    }
    return data;
  }
  function ensureMatavuEvidence(data) {
    // Migrate only unchanged, unreviewed grammar explanations in saved browsers.
    const previous=new Map([
      ['matavu',['verbal or predicate phrase','A phrase typically centred on a vu, with actor, time, and other supporting elements.']],
      ['isema',['connector or clause-linking particle','A marker linking a matavu with another matavu or clause; examples include ni, me, de, ke and se.']],
      ['durusau',['actor or subject-reference marker','A marker in a matavu referring to a performer or experiencer, with distinctions of person and number.']],
      ['duruliu',['particle or modifier before a base','A positional term for a duru placed before a yavu, covering several functional kinds.']],
      ['nauni qali',['named or pronominal object within a predicate phrase','The guide says such an object may occur within a matavu after a transitive -i form.']],
      ['durumuri',['particle or modifier after a base','A duru after the yavu that may convey direction, continuation, completion or emphasis.']]
    ]);
    const source=packagedBase.sources.find(item=>item.id==='anu-fijian-verb-phrase-surface-order');
    if(source&&!data.sources.some(item=>item.id===source.id))data.sources.push({...source});
    const packagedById=new Map(packagedBase.entries.map(entry=>[entry.id,entry]));
    for(const current of data.entries){
      const old=previous.get(current.fijian),packaged=packagedById.get(current.id);
      if(!old||!packaged||current.englishPos!=='grammar term'||current.status==='reviewed'||current.meaning!==old[0]||current.grammarExplanation!==old[1])continue;
      for(const field of ['grammarExplanation','grammarExample','matavuTable','isemaTable','durusauTable','sources','notes','reviewBatch']){
        if(packaged[field]!==undefined)current[field]=packaged[field];
      }
    }
    return data;
  }
  function ensureEnglishRepairs(data) {
    const byId=new Map(data.entries.map(entry=>[entry.id,entry]));
    for(const packaged of packagedBase.entries){
      if(packaged.reviewBatch!=='2026-10-30-english-repairs-1')continue;
      const current=byId.get(packaged.id);
      if(!current||current.status==='reviewed'||current.meaning!==packaged.repairFrom)continue;
      current.meaning=packaged.meaning;
      current.notes=packaged.notes;
      current.reviewBatch=packaged.reviewBatch;
      current.repairFrom=packaged.repairFrom;
    }
    return data;
  }
  function ensureWordReviews(data) {
    // Merge individually reviewed candidate senses into older browser copies.
    // Preserve approved senses and any meaning a reviewer has already changed.
    const isWordReview=batch=>batch==='2026-10-30-balawa-review'||batch?.startsWith('2026-10-30-word-review-')||batch?.startsWith('2026-10-31-attested-example-')||batch==='2026-10-31-nauni-sosomi-table'||batch==='2026-10-31-nauni-lexicon';
    const byId=new Map(data.entries.map(entry=>[entry.id,entry]));
    const sourceIds=new Set(data.sources.map(source=>source.id));
    const neededSources=new Set();
    for(const packaged of packagedBase.entries){
      if(!isWordReview(packaged.reviewBatch))continue;
      if(packaged.source?.id)neededSources.add(packaged.source.id);
      for(const ref of packaged.sources||[])if(ref.id)neededSources.add(ref.id);
      const current=byId.get(packaged.id);
      if(!current){data.entries.push({...packaged});byId.set(packaged.id,packaged);continue;}
      if(current.status==='reviewed'||current.meaning!==packaged.repairFrom)continue;
      Object.assign(current,{...packaged});
    }
    for(const packaged of packagedBase.sources){
      if(!neededSources.has(packaged.id)||sourceIds.has(packaged.id))continue;
      data.sources.push({...packaged});sourceIds.add(packaged.id);
    }
    return data;
  }
  function ensureReviewedPdfAdditions(data) {
    const additions=(packagedBase.entries || []).filter(e=>e.reviewBatch==="2026-10-29-three-pdfs");
    const sayings=(packagedBase.proverbs || []).filter(p=>p.reviewBatch==="2026-10-29-three-pdfs");
    const sourceIds=new Set((data.sources || []).map(s=>s.id));
    const needed=new Set([...additions.map(e=>e.source.id),...sayings.map(p=>p.source.id)]);
    for(const item of packagedBase.sources || [])if(needed.has(item.id)&&!sourceIds.has(item.id)){data.sources.push({...item});sourceIds.add(item.id);}
    const entryById=new Map((data.entries || []).map(e=>[e.id,e]));
    for(const entry of additions){
      const existing=entryById.get(entry.id);
      if(existing){if((existing.notes || "").includes("headword marker ai"))existing.notes=entry.notes;}
      else{data.entries.push({...entry});entryById.set(entry.id,entry);}
    }
    const sayingIds=new Set((data.proverbs || []).map(p=>p.id));
    const sayingByText=new Map((data.proverbs || []).map(p=>[key(p.fijian),p]));
    for(const saying of sayings){
      if(sayingIds.has(saying.id))continue;
      const existing=sayingByText.get(key(saying.fijian));
      if(existing){
        const refs=existing.sources || [existing.source];
        for(const ref of saying.sources || [saying.source])if(ref&&!refs.some(item=>item.id===ref.id&&item.page===ref.page))refs.push(ref);
        existing.sources=refs;
        if((existing.meaning || "").length<12)existing.meaning=saying.meaning;
      }else{data.proverbs.push({...saying});sayingIds.add(saying.id);sayingByText.set(key(saying.fijian),saying);}
    }
    const workbook=packagedBase.sources.find(s=>s.name==="Nanuma_Lesu_12_2015.pdf");
    if(workbook)for(const packaged of packagedBase.proverbs || []){
      const workbookRefs=(packaged.sources || []).filter(ref=>ref.id===workbook.id);
      if(!workbookRefs.length)continue;
      const existing=sayingByText.get(key(packaged.fijian));
      if(!existing)continue;
      const refs=existing.sources || [existing.source];
      for(const ref of workbookRefs)if(!refs.some(item=>item.id===ref.id&&item.page===ref.page))refs.push(ref);
      existing.sources=refs;
    }
    return data;
  }
  function sayingLabel(p) {
    if (p.reviewBatch === "2026-11-01-original-saying-meanings" || p.reviewBatch === "2026-10-31-raiwalui-wording") return tr('idiom');
    if (p.number) return `Vosavosavakaviti · No. ${p.number}`;
    if (p.id === "founder-qalova-uaua-na-moka") return tr('founderSupplied');
    if (p.id.startsWith("gatty-idiom-")) return `Gatty dictionary · ${p.kind || tr('saying')}`;
    if (p.id.startsWith("nanuma-idiom-")) return `Nanuma Lesu · ${tr('idiom')}`;
    return tr('yourSaying');
  }
  function reviewStatusLabel(status) { return status === 'reviewed' ? tr('reviewed') : status === 'needs meaning' ? tr('needsMeaning') : tr('needsReview'); }
  function pageLabel(entry) { return entry.source?.page ? `PDF page ${entry.source.page}` : "Page not recorded"; }
  function sourceHref(s, page) {
    if (s?.linkUnavailable) return null;
    if (s?.webUrl) return s.webUrl + (page ? `#page=${page}` : "");
    if (!s || !["localhost", "127.0.0.1"].includes(location.hostname)) return null;
    return "/source/" + s.path.split("/").map(encodeURIComponent).join("/") + (page ? `#page=${page}` : "");
  }
  function usageExamplesPanel(examples, headword) {
    const panel=node("section","usage-examples compact-example"), list=node("ul","");
    panel.append(node("h3","","Example"));
    for(const example of examples.slice(0,1)){
      const li=node("li",""),phrase=node("p","example-sentence");
      if(example.words?.length){
        example.words.forEach((word,index)=>{
          if(index)phrase.append(document.createTextNode(" "));
          phrase.append(node(word.focus?"strong":"span",word.focus?"example-focus":"",word.text));
        });
        phrase.append(document.createTextNode(example.punctuation||""));
      }else{
        for(const part of String(example.fijian||"").split(/(\s+)/)){
          const bare=part.replace(/^[^\p{L}]+|[^\p{L}]+$/gu,"");
          phrase.append(/^\s+$/.test(part)?document.createTextNode(part):node(key(bare)===key(headword)?"strong":"span",key(bare)===key(headword)?"example-focus":"",part));
        }
      }
      li.append(phrase);
      if(example.english)li.append(node("p","example-translation",example.english));
      list.append(li);
    }
    panel.append(list);
    return panel;
  }
  // Corrections go to NAISEMA's correction form, which takes the word with it.
  function correctionLink(word) {
    const link=node("a","sense-correction","Suggest a correction");
    link.href=`/forms/correct-word?word=${encodeURIComponent(word||"")}`;
    return link;
  }
  function setView(next) {
    view = next;
    document.title = next === "culture" ? "Veiqaravi Vakavanua · Vosa · NAISEMA" : next === "icavuti" ? "Icavuti · Vosa · NAISEMA" : "Vosa, the Fijian dictionary · NAISEMA";
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === next));
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === next + "-view"));
    if (next === "dictionary") renderEntries();
    if (next === "themes") renderThemes();
    if (next === "grammar") renderGrammar();
    if (next === "proverbs") renderProverbs();
    if (next === "guide") renderInUse();
  }
  function renderPosOptions() {
    const selected = $("pos-filter").value;
    const values = [...new Set(entries().map(e => e.englishPos).filter(Boolean))].sort();
    $("pos-filter").replaceChildren(new Option(tr('allWordTypes'), ""), ...values.map(v => new Option(v, v)));
    $("pos-filter").value = selected;
    renderPosShortcuts();
  }
  function renderPosShortcuts() {
    const holder = $("pos-shortcuts");holder.replaceChildren();
    for (const [pos,label] of [["","All words"],["verb","Verbs"],["pronoun","Pronouns"],["noun","Nouns"],["adjective","Adjectives"],["grammar term","Tuvavosa"]]) {
      const count = new Set(entries().filter(e => !pos || e.englishPos === pos).map(e => headKey(e.fijian))).size;
      const button = node("button","pos-shortcut"+($("pos-filter").value===pos?" active":""),`${label} · ${count.toLocaleString()}`);
      button.type="button";button.setAttribute("aria-pressed",String($("pos-filter").value===pos));
      button.addEventListener("click",()=>{$("pos-filter").value=pos;$("search").value="";entryLimit=60;renderEntries();});holder.append(button);
    }
  }
  function meaningCore(entry) {
    return key(entry.meaning).replace(/^(a|an|the)\s+/, "").replace(/^(intr|tr|trans)\.\s+/, "").split(/[,;:]/, 1)[0].replace(/[^\p{L}\p{N}\s]/gu, "").trim();
  }
  function searchableText(entry) {
    return key([entry.fijian,...(entry.variants||[]),entry.meaning,...(entry.searchKeywords||[]),...['fj','en','de','es','fr','zh','ja'].map(locale=>reviewedTranslations.get(`${entry.id}:${locale}`)),entry.englishPos,entry.tuvavosa,entry.roleEnglish,...(entry.roleAnalyses||[]).flatMap(role=>[role.fijianRole,role.englishRole,role.phrase]),entry.roleEvidence?.fijianRole,entry.roleEvidence?.phrase,entry.grammarExplanation,entry.grammarExample,...(entry.pronounTable?.rows||[]).flat(),...(entry.possessionTable?.rows||[]).flat(),...(entry.commonOwnerTable?.rows||[]).flat(),...(entry.matavuTable?.rows||[]).flat(),...(entry.isemaTable?.rows||[]).flat(),...(entry.durusauTable?.rows||[]).flat(),...(entry.usageExamples||[]).map(example=>`${example.fijian} ${example.english}`)].join(" "));
  }
  function englishRole(entry) {
    if (entry.roleEnglish) return entry.roleEnglish;
    return ({noun:"possible noun-phrase head; check context",verb:"possible predicate head; check context",adjective:"possible noun or predicate modifier; check context",adverb:"possible predicate qualifier; check context",pronoun:"independent pronoun or actor marker; check context",numeral:"number or quantity expression; check context","grammar term":"Fijian grammatical label with an English explanation"})[entry.englishPos] || "closest English grammatical description needs review";
  }
  function compactRole(entry) {
    const example = entry.usageExamples?.[0];
    const focus = example?.words?.find(word => word.focus);
    const analysis = entry.roleAnalyses?.find(item => item.phrase === example?.fijian) || entry.roleAnalyses?.[0] || entry.roleEvidence;
    if (focus) return {fijian:focus.role, english:focus.english};
    if (analysis?.fijianRole) return {fijian:analysis.fijianRole, english:analysis.englishRole || englishRole(entry)};
    if (entry.pronounFeatures && entry.roleEnglish) return {fijian:entry.tuvavosa, english:entry.roleEnglish};
    const raw = String(entry.tuvavosa || "").split(";")[0];
    if (!raw || raw === "context needed" || ["Building blocks","Noun phrase","Predicate phrase","Word building and roles"].includes(raw))
      return {fijian:"Needs a sentence",english:"Role to be checked in context"};
    const tentative = /^possible\s/i.test(raw);
    const fijian = raw.replace(/^possible\s/i, "").replace(/\s+in a matanauni$/i, "").replace(/\s+in a matavu$/i, "").replace(/\s+by phrase$/i, "");
    const equivalents = {nauni:"noun head",vu:"predicate head",yavu:"lexical base",kilanauni:"noun modifier",kilavu:"predicate modifier",durumuri:"following particle",duru:"grammatical marker",wiliwili:"number or quantity"};
    const english = fijian.split(/\s*(?:\/| or | and )\s*/i).map(part => equivalents[part.trim()] || "role to check in context").join(" / ");
    return {fijian:tentative ? `${fijian} (possible)` : fijian,english};
  }
  function comparisonFor(entry) {
    // An English part-of-speech label is not evidence for a word-specific contrast.
    return entry.comparison || '';
  }
  function curiosityQuestionFor(entry,group) {
    const editorial=window.NAISEMA_EXPLORATIONS?.[entry.id];
    return editorial?.question || entry.curiosityQuestion || '';
  }
  function explorationLinkFor(entry) {
    const editorial=window.NAISEMA_EXPLORATIONS?.[entry.id];
    if(editorial?.link)return editorial.link;
    for(const ref of entry.sources?.length?entry.sources:[entry.source]){
      const record=source(ref?.id);
      if(!record?.webUrl?.startsWith('https://'))continue;
      return {label:`Explore ${entry.fijian} in ${record.name}`,href:sourceHref(record,ref.page)};
    }
    return null;
  }
  function explorationPanel(entry,group) {
    const editorial=window.NAISEMA_EXPLORATIONS?.[entry.id]||{};
    const comparison=comparisonFor(entry);
    const insight=editorial.text||comparison||entry.learnerComment||'';
    const curiosity=curiosityQuestionFor(entry,group);
    const related=relatedWordsPanel(entry);
    const further=explorationLinkFor(entry);
    if(!insight&&!editorial.example&&!curiosity&&!related)return null;
    const panel=node('div','entry-reading-section entry-exploration');
    panel.append(node('h3','entry-section-title',editorial.title||`Explore ${entry.fijian}`));
    if(insight)panel.append(linkedTuvavosa('p','exploration-insight',insight));
    if(editorial.example?.fijian&&editorial.example?.english){
      const example=node('div','exploration-example');
      example.append(node('p','exploration-example-fijian',editorial.example.fijian),node('p','exploration-example-english',editorial.example.english));
      panel.append(example);
    }
    if(curiosity){
      const question=node('div','exploration-question');
      question.append(node('span','exploration-question-label','Wonder about this'),node('p','',curiosity));
      panel.append(question);
    }
    if(related)panel.append(related);
    if(further){
      let href;
      try{href=new URL(further.href,location.href);if(!['https:','http:'].includes(href.protocol))href=null;}catch{href=null;}
      if(href){const link=node('a','exploration-link',further.label);link.href=href.href;link.target='_blank';link.rel='noopener noreferrer';panel.append(link);}
    }
    return panel;
  }
  function relatedWordsPanel(entry) {
    const available=new Map(entries().map(item=>[headKey(item.fijian),item.fijian]));
    const related=[...new Set((entry.relatedWords||[]).map(word=>headKey(word)))].filter(word=>word!==headKey(entry.fijian)&&available.has(word));
    if(!related.length)return null;
    const panel=node('div','related-words'),label=node('span','related-label','Related Fijian words');panel.append(label);
    for(const word of related){
      const button=node('button','related-word',available.get(word));button.type='button';
      button.setAttribute('aria-label',`Compare with ${available.get(word)}`);
      button.addEventListener('click',()=>{$('search').value=available.get(word);$('pos-filter').value='';$('status-filter').value='';selectedId=word;selectedSenseId=null;setView('dictionary');$('entry-detail').scrollIntoView({block:'start',behavior:'smooth'});});
      panel.append(button);
    }
    return panel;
  }
  function wordPlayPanel(entry) {
    const selected=window.NAISEMA_WORD_PLAY?.[headKey(entry.fijian)];
    const activities=Array.isArray(selected)?selected:[selected];
    if(entry.wordPlayPrimary===false)return null;
    if(!(entry.meaningStatus==='reviewed'||entry.status==='reviewed')||!activities.some(activity=>activity?.cards?.length))return null;
    if(headKey(entry.fijian)==='bati'&&entry.id!=='d9c03c02a2a6ba78')return null;
    const stack=node('div','word-play-stack');
    const available=new Map(entries().filter(item=>item.meaningStatus==='reviewed'||item.status==='reviewed'||(item.grammarGroup&&item.grammarExplanation)).map(item=>[headKey(item.fijian),item.fijian]));
    for(const activity of activities){
      if(!activity?.cards?.length)continue;
      const panel=node('div','entry-reading-section word-play');
      panel.append(node('h3','entry-section-title',activity.title),node('p','word-play-intro',activity.intro));
      if(activity.hint){
        const hint=node('details','word-play-hint');
        hint.append(node('summary','','Need a clue?'),node('p','',activity.hint));
        panel.append(hint);
      }
      const cards=node('div','word-play-cards');
      for(const item of activity.cards){
        const card=node('div','word-play-card');
        const reveal=node('details','word-play-reveal');
        const prompt=node('summary','');
        if(item.options?.length){
          card.classList.add('word-play-choice');
          card.append(node('p','word-play-choice-question',item.question));
          prompt.append(node('span','','Show explanation'));
          const options=node('div','word-play-options'),feedback=node('p','word-play-feedback');feedback.setAttribute('role','status');
          for(const option of item.options){
            const choose=node('button','word-play-option',option);choose.type='button';
            choose.addEventListener('click',()=>{const correct=option===item.correct;feedback.textContent=correct?'Yes. Read why this order works.':item.incorrectHint||'Try the other order.';choose.classList.toggle('correct',correct);choose.classList.toggle('incorrect',!correct);if(correct)reveal.open=true;});
            options.append(choose);
          }
          card.append(options,feedback);
        }else prompt.append(node('strong','',item.word),node('span','word-play-prompt',item.question));
        reveal.append(prompt,node('p','word-play-answer',item.answer));
        if(item.sayingId){
          const saying=proverbs().find(record=>record.id===item.sayingId);
          if(saying){
            const link=node('button','word-play-link',`Explore the saying: ${saying.fijian}`);link.type='button';
            link.addEventListener('click',()=>{wordPlayOrigin={headword:entry.fijian,entryId:entry.id,question:item.question};$('proverb-search').value=saying.fijian;selectedProverbId=saying.id;setView('proverbs');$('proverb-detail').scrollIntoView({block:'start',behavior:'smooth'});});
            reveal.append(link);
          }
        }
        if(item.cultureTerm){
          const id='culture-term-'+item.cultureTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
          const target=document.getElementById(id);
          if(target){
            const link=node('button','word-play-link',`Explore ${item.cultureTerm} in Veiqaravi Vakavanua`);link.type='button';
            link.addEventListener('click',()=>{wordPlayOrigin={headword:entry.fijian,entryId:entry.id,question:item.question};setView('culture');document.getElementById('culture-word-play-return')?.remove();const bar=wordPlayReturnBar();bar.id='culture-word-play-return';$('culture-view').prepend(bar);target.scrollIntoView({block:'start',behavior:'smooth'});});
            reveal.append(link);
          }
        }
        if(item.parts?.length){
          const parts=node('div','word-play-parts');
          parts.setAttribute('aria-label','Parts of this word or phrase');
          for(const part of item.parts){
            const chip=node('span','word-play-part');
            chip.append(node('strong','',part.text),node('small','',part.role));parts.append(chip);
          }
          reveal.append(parts);
        }
        const linkWord=item.linkWord||item.word;
        if(available.has(headKey(linkWord))&&headKey(linkWord)!==headKey(entry.fijian)){
          const link=node('button','word-play-link',`Open ${linkWord} in the dictionary`);
          link.type='button';
          link.addEventListener('click',()=>{wordPlayOrigin ||= {headword:entry.fijian,entryId:entry.id,question:item.question};$('search').value=linkWord;$('pos-filter').value='';$('status-filter').value='';selectedId=headKey(linkWord);selectedSenseId=null;setView('dictionary');$('entry-detail').scrollIntoView({block:'start',behavior:'smooth'});});
          reveal.append(link);
        }
        card.append(reveal);
        const openClue=clue=>{const label=available.get(clue);wordPlayOrigin ||= {headword:entry.fijian,entryId:entry.id,question:item.question};$('search').value=label;$('pos-filter').value='';$('status-filter').value='';selectedId=clue;selectedSenseId=null;setView('dictionary');$('entry-detail').scrollIntoView({block:'start',behavior:'smooth'});};
        if(item.parts?.length&&!item.options){
          const partsRow=node('div','word-play-clues');partsRow.append(node('span','word-play-clue-label','Explore the parts:'));
          item.parts.forEach((part,index)=>{
            if(index)partsRow.append(node('span','word-play-plus','+'));
            const written=headKey(part.text),plain=headKey(part.text.replace(/^-+|-+$/g,''));
            const clue=available.has(written)?written:plain;
            const label=part.text.replace(/^-+|-+$/g,'');
            if(available.has(clue)&&clue!==headKey(entry.fijian)){
              const button=node('button','word-play-clue',label);button.type='button';button.addEventListener('click',()=>openClue(clue));partsRow.append(button);
            }else partsRow.append(node('span','word-play-clue-part',label));
          });
          card.append(partsRow);
          const roles=new Set();
          for(const part of item.parts){const role=headKey(part.role);const name=role.includes('mata')?'mata':role.includes('yavu')?'yavu':role.includes('duru')?'duru':'';if(name&&available.has(name)&&name!==headKey(entry.fijian))roles.add(name);}
          if(roles.size){
            const roleRow=node('div','word-play-role-clues');roleRow.append(node('span','','Phrase roles:'));
            for(const role of roles){const button=node('button','word-play-clue',available.get(role));button.type='button';button.addEventListener('click',()=>openClue(role));roleRow.append(button);}
            card.append(roleRow);
          }
        }
        if(item.clues?.length){
          const clueRow=node('div','word-play-role-clues');clueRow.append(node('span','','Need a word clue?'));
          for(const word of item.clues){const clue=headKey(word);if(!available.has(clue)||clue===headKey(entry.fijian))continue;const button=node('button','word-play-clue',available.get(clue).replace(/^-/,''));button.type='button';button.addEventListener('click',()=>openClue(clue));clueRow.append(button);}
          if(clueRow.querySelector('button'))card.append(clueRow);
        }
        cards.append(card);
      }
      panel.append(cards);
      if(activity.after)panel.append(node('p','word-play-after',activity.after));
      if(activity.link){
        const link=node('a','exploration-link',activity.link.label);
        link.href=activity.link.href;link.target='_blank';link.rel='noopener noreferrer';panel.append(link);
      }
      stack.append(panel);
    }
    return stack;
  }
  function returnToWordPlay() {
    if(!wordPlayOrigin)return;
    const origin=wordPlayOrigin;wordPlayOrigin=null;
    document.getElementById('culture-word-play-return')?.remove();
    $('search').value=origin.headword;$('pos-filter').value='';$('status-filter').value='';
    selectedId=headKey(origin.headword);selectedSenseId=origin.entryId;setView('dictionary');
    const box=$('entry-detail');
    const card=[...box.querySelectorAll('.word-play-card')].find(item=>item.textContent.includes(origin.question));
    if(card){const reveal=card.querySelector('.word-play-reveal');if(reveal)reveal.open=true;}
    (card||box).scrollIntoView({block:'start',behavior:'smooth'});
  }
  function wordPlayReturnBar() {
    const bar=node('div','word-play-return');
    const back=node('button','word-play-return-button',`← Back to your question about ${wordPlayOrigin.headword}`);
    back.type='button';back.addEventListener('click',returnToWordPlay);bar.append(back);
    return bar;
  }
  function imageLinksPanel(entry) {
    const panel=node('div','image-links');
    for(const item of entry.imageLinks||[]){
      if(!item?.url)continue;
      let url;
      try{url=new URL(item.url);if(!['https:','http:'].includes(url.protocol))continue;}catch{continue;}
      const link=node('a','image-link',item.label||'View images');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';
      panel.append(link);
    }
    if(!panel.childNodes.length)return null;
    panel.prepend(node('span','image-links-label','See images online'));
    return panel;
  }
  function mergeSenses(group) {
    return group.entries.map(entry => ({entry,sources:(entry.sources?.length ? entry.sources : [entry.source]).filter(Boolean)}));
  }
  function filteredGroups() {
    const query = key($("search").value), pos = $("pos-filter").value, status = $("status-filter").value;
    const englishChecked = entry => entry.meaningStatus === 'reviewed' || entry.status === 'reviewed';
    const groups = new Map();
    for (const entry of entries()) {
      const word = headKey(entry.fijian);
      if (!groups.has(word)) groups.set(word, {key:word, fijian:entry.fijian, entries:[]});
      groups.get(word).entries.push(entry);
    }
    const matches = [...groups.values()].filter(group => group.entries.some(entry =>
      (!pos || entry.englishPos === pos) && (!status || (status === 'reviewed' ? englishChecked(entry) : !englishChecked(entry))) &&
      (!query || searchableText(entry).includes(query))));
    matches.sort((a,b) => alphabet.compare(a.fijian,b.fijian));
    return matches;
  }
  function renderEntries() {
    renderPosShortcuts();
    const matches = filteredGroups();
    const reviewed = new Set(entries().filter(e => e.meaningStatus === 'reviewed' || e.status === 'reviewed').map(e => headKey(e.fijian))).size;
    $("result-count").textContent = `${matches.length.toLocaleString()} ${tr('wordsShown')} · ${reviewed.toLocaleString()} ${tr('reviewedSenses')}`;
    const list = $("entry-list"); list.replaceChildren();
    if (!matches.length) { const empty=node("div","empty-state"); empty.append(node("strong","",tr('noWords')),node("span","",tr('trySearch'))); list.append(empty); renderDetail(null); return; }
    if (!matches.some(group => group.key === selectedId)) selectedId = matches[0].key;
    const query=key($("search").value);
    for (const group of matches.slice(0, entryLimit)) {
      const senses = mergeSenses(group), first = (senses.find(s=>s.entry.id===selectedSenseId)||senses.find(s=>query&&searchableText(s.entry).includes(query))||senses[0]).entry;
      const row = node("button", "entry-row" + (group.key === selectedId ? " selected" : "")); row.type="button"; row.setAttribute("role","listitem"); row.setAttribute("aria-label",`${group.fijian}, ${senses.length} ${senses.length === 1 ? tr('meaning') : tr('meanings')}`);
      row.append(node("span","entry-word",group.fijian),node("span","entry-preview",meaningPreview(first)));
      const meta=node("span","entry-meta"); meta.append(node("span","chip",`${senses.length} ${senses.length === 1 ? tr('meaning') : tr('meanings')}`)); if(senses.some(s=>s.entry.meaningStatus==="reviewed" || s.entry.status==="reviewed"))meta.append(node("span","chip reviewed",tr('englishChecked')));row.append(meta);
      row.addEventListener("click",() => {selectedId=group.key;selectedSenseId=null;renderEntries();}); list.append(row);
    }
    if (matches.length > entryLimit) { const more=node("button","entry-row",`${tr('showMoreWords')} (${(matches.length-entryLimit).toLocaleString()} ${tr('remaining')})`); more.type="button"; more.addEventListener("click",()=>{entryLimit+=60;renderEntries();});list.append(more); }
    renderDetail(matches.find(group => group.key === selectedId));
  }
  function renderDetail(group) {
    const box=$("entry-detail"); box.replaceChildren();
    if (!group) { const empty=node("div","empty-state");empty.append(node("strong","",tr('startWord')),node("span","",tr('chooseResult')));box.append(empty);return; }
    const senses = mergeSenses(group), query=key($("search").value), top=node("div","detail-top"), title=node("div");
    const priority=entry=>entry.id===selectedSenseId?2:(query&&searchableText(entry).includes(query)?1:0);
    senses.sort((a,b)=>priority(b.entry)-priority(a.entry));
    title.append(node("p","detail-kicker",tr('headword')),node("h2","detail-headword",group.fijian),node("p","detail-subtitle",`${senses.length} ${senses.length === 1 ? tr('meaning') : tr('meanings')}`));top.append(title);box.append(top);
    if(wordPlayOrigin&&group.key!==headKey(wordPlayOrigin.headword)){
      box.append(wordPlayReturnBar());
    }
    let wordPlayShown=false;
    senses.forEach((sense,index) => {
      const entry=sense.entry, section=node("section","sense-card"), heading=node("div","sense-heading");
      const englishChecked = entry.meaningStatus === 'reviewed' || entry.status === 'reviewed';
      heading.append(node("span","sense-number",`${tr('meaning')} ${index+1}`),node("span","chip " + (englishChecked ? "reviewed" : "needs-review"),englishChecked ? tr('englishChecked') : tr('needsReview')));
      section.append(heading);
      const meaningSection=node('div','entry-reading-section entry-meaning-section');
      meaningSection.append(node('h3','entry-section-title','Meaning in English'),meaningPanel(entry));
      section.append(meaningSection);

      const writingTerm=entry.reviewBatch==='2026-11-03-owner-writing-terms';
      const completeExamples=(entry.usageExamples||[]).filter(example=>example.fijian&&example.english);
      if(completeExamples.length){
        const exampleSection=node('div','entry-reading-section');
        exampleSection.append(node('h3','entry-section-title','In a Fijian phrase'));
        exampleSection.append(usageExamplesPanel(completeExamples,entry.fijian));
        section.append(exampleSection);
      }

      if(!wordPlayShown){const wordPlay=wordPlayPanel(entry);if(wordPlay){section.append(wordPlay);wordPlayShown=true;}}

      const grammarTables=[entry.pronounTable,entry.possessionTable,entry.commonOwnerTable,entry.matavuTable,entry.isemaTable,entry.durusauTable];
      const hasPhraseRole=Boolean(entry.roleAnalyses?.length||entry.roleEvidence?.fijianRole||entry.pronounFeatures||entry.usageExamples?.some(example=>example.words?.some(word=>word.focus)));
      if(entry.englishPos==='grammar term'||hasPhraseRole||entry.marker||entry.grammarExplanation||entry.grammarExample||grammarTables.some(Boolean)){
        const roleSection=node('div','entry-reading-section');
        roleSection.append(node('h3','entry-section-title',writingTerm?'How this mark is used':entry.englishPos==='grammar term'?'How this term works':`How ${entry.fijian} works in a phrase`));
        if(entry.englishPos==='grammar term'){
          const code=grammarCode(entry);if(code)roleSection.append(node('span','grammar-code',code));
        }else if(hasPhraseRole){
          if(writingTerm)roleSection.append(node('p','compact-role',entry.roleEnglish));
          else {const role=compactRole(entry);roleSection.append(linkedTuvavosa('p','compact-role',`${role.fijian} · ${role.english}`));}
        }
        if(entry.marker){
          const marker=node('div','grammar-marker-panel');
          marker.append(node('strong','grammar-marker-title',`${entry.marker.kind}: ${entry.marker.forms}`));
          if(entry.marker.position)marker.append(linkedTuvavosa('p','grammar-marker-position',entry.marker.position));
          if(entry.marker.note)marker.append(linkedTuvavosa('p','grammar-marker-note',entry.marker.note));
          roleSection.append(marker);
        }
        if(entry.grammarExplanation)roleSection.append(linkedTuvavosa('p','grammar-explanation',learningProse(entry.grammarExplanation)));
        if(entry.grammarExample)roleSection.append(linkedTuvavosa('p','grammar-example',`Recorded form · ${entry.grammarExample}`));
        for(const table of grammarTables)if(table)roleSection.append(grammarTablePanel(table));
        if(entry.englishPos==='grammar term'){
          const open=node('button','button button-outline entry-grammar-link','Open full Tuvavosa entry');open.type='button';
          open.addEventListener('click',()=>openTuvavosa(entry.fijian));roleSection.append(open);
        }
        section.append(roleSection);
      }

      const exploration=explorationPanel(entry,group);if(exploration)section.append(exploration);

      const images=imageLinksPanel(entry);
      if(entry.scientificName||images||entry.reviewBatch==='2026-11-01-fiji-foodfish2-local'&&entry.variants?.length){
        const contextSection=node('div','entry-reading-section');
        contextSection.append(node('h3','entry-section-title','More about this word'));
        if(entry.reviewBatch==='2026-11-01-fiji-foodfish2-local'&&entry.variants?.length)contextSection.append(node('p','sense-variants',`Other Fijian names on the poster: ${entry.variants.join(', ')}`));
        if(entry.scientificName)contextSection.append(node('p','scientific-name',`Scientific name: ${entry.scientificName}${entry.identificationNote?` · ${entry.identificationNote}`:''}`));
        if(images)contextSection.append(images);
        section.append(contextSection);
      }

      const details=node("details","sense-review-details"),summary=node("summary","","Sources and review");details.append(summary);
      const refs=node("div","sense-sources");
      for(const ref of sense.sources){const s=source(ref.id), line=node("div","sense-source");line.append(node("span","",`${s?.name||tr('personalNote')}${ref.section?` · ${tr('section')} ${ref.section}`:""}${ref.page?` · ${tr('pdfPage')} ${ref.page}`:""}`));const href=sourceHref(s,ref.page);if(href){const link=node("a","",tr('openSource'));link.href=href;link.target="_blank";link.rel="noopener";line.append(link);}refs.append(line);}
      details.append(refs);
      if(entry.notes)details.append(node("p","detail-notes",displayNote(entry)));
      section.append(details,correctionLink(entry.fijian));box.append(section);
    });
  }
  function renderInUse(){
    const holder=$('in-use-examples');holder.replaceChildren();
    const featured=['Rourou','duru','matanauni sosomi'];
    for(const word of featured){
      const entry=entries().find(item=>key(item.fijian)===key(word)&&item.usageExamples?.some(example=>example.fijian&&example.english));
      if(!entry)continue;
      const example=entry.usageExamples.find(item=>item.fijian&&item.english),card=node('article','in-use-card');
      card.append(node('span','in-use-word',entry.fijian),node('p','in-use-fijian',example.fijian),node('p','in-use-english',example.english));
      const button=node('button','in-use-open','Read this entry →');button.type='button';
      button.addEventListener('click',()=>{$('search').value=entry.fijian;$('pos-filter').value='';$('status-filter').value='';selectedId=headKey(entry.fijian);selectedSenseId=entry.id;setView('dictionary');$('entry-detail').scrollIntoView({block:'start',behavior:'smooth'});});
      card.append(button);holder.append(card);
    }
  }
  function grammarTablePanel(tableData) {
    const panel=node('div','grammar-reference-panel'),title=node('h3','',learningProse(tableData.title||'Tuvavosa'));
    panel.append(title);
    const scroll=node('div','grammar-reference-scroll'),table=node('table','grammar-reference-table'),head=node('thead'),headRow=node('tr');
    for(const label of tableData.columns||[])headRow.append(linkedTuvavosa('th','',learningProse(label)));
    head.append(headRow);table.append(head);
    const body=node('tbody');
    for(const cells of tableData.rows||[]){const row=node('tr');cells.forEach((cell,index)=>row.append(linkedTuvavosa(index?'td':'th','',learningProse(cell||'—'))));body.append(row);}
    table.append(body);scroll.append(table);panel.append(scroll);
    if(tableData.note)panel.append(linkedTuvavosa('p','grammar-reference-note',learningProse(tableData.note)));
    return panel;
  }
  function renderGrammar() {
    const terms=entries().filter(entry=>entry.englishPos==="grammar term").sort((a,b)=>alphabet.compare(a.fijian,b.fijian));
    const chosen=$("grammar-group").value;
    const groups=[...new Set(terms.map(entry=>entry.grammarGroup||"Other"))].sort((a,b)=>alphabet.compare(a,b));
    $("grammar-group").replaceChildren(new Option(tr('allTopics'),""),...groups.map(group=>new Option(grammarGroupLabel(group),group)));
    $("grammar-group").value=groups.includes(chosen)?chosen:"";
    const query=key($("grammar-search").value),group=$("grammar-group").value;
    const matches=terms.filter(entry=>(!group||(entry.grammarGroup||"Other")===group)&&(!query||searchableText(entry).includes(query)));
    $("grammar-count").textContent=`${matches.length.toLocaleString()} ${matches.length===1?tr('grammarTerm'):tr('grammarTerms')}`;
    const list=$("grammar-list");list.replaceChildren();
    if(!matches.length){list.append(node("div","empty-state",tr('noTerms')));$("grammar-detail").replaceChildren(node("div","empty-state",tr('chooseTerm')));return;}
    if(!matches.some(entry=>entry.id===selectedGrammarId))selectedGrammarId=(matches.find(entry=>key(entry.fijian)===query)||matches[0]).id;
    for(const entry of matches){
      const row=node("button","entry-row"+(entry.id===selectedGrammarId?" selected":""));row.type="button";row.setAttribute("role","listitem");
      const code=grammarCode(entry);
      const marker=entry.marker?.forms?` · ${entry.marker.kind}: ${entry.marker.forms}`:'';
      row.append(node("span","entry-word",entry.fijian),node("span","entry-preview",`${code?`${code} · `:''}${grammarFunction(entry)}${marker}`));
      row.addEventListener("click",()=>{selectedGrammarId=entry.id;renderGrammar();});list.append(row);
    }
    const entry=matches.find(item=>item.id===selectedGrammarId),box=$("grammar-detail");box.replaceChildren();
    const top=node("div","detail-top"),title=node("div");title.append(node("p","detail-kicker",grammarFunction(entry)),node("h2","detail-headword",entry.fijian));
    const termCode=grammarCode(entry);if(termCode)title.append(node("span","grammar-code",termCode));
    top.append(title);box.append(top);
    box.append(node("p","compact-label","English"));
    box.append(meaningPanel({...entry,meaning:String(entry.meaning||'').replace(/^[A-Za-z]{2,5}:\s*/, '')}));
    if(entry.marker){
      const marker=node('section','grammar-marker-panel');
      marker.append(node('strong','grammar-marker-title',`${entry.marker.kind}: ${entry.marker.forms}`));
      marker.append(linkedTuvavosa('p','grammar-marker-position',entry.marker.position));
      if(entry.marker.note)marker.append(linkedTuvavosa('p','grammar-marker-note',entry.marker.note));
      box.append(marker);
    }
    if(entry.grammarExplanation){
      const explanation=node('section','entry-reading-section grammar-reading-section');
      explanation.append(node('h3','entry-section-title','How this term works'),linkedTuvavosa('p','grammar-explanation',learningProse(entry.grammarExplanation)));
      box.append(explanation);
    }
    const exploration=explorationPanel(entry,{entries:matches.filter(item=>headKey(item.fijian)===headKey(entry.fijian))});
    if(exploration)box.append(exploration);
    const completeExamples=(entry.usageExamples||[]).filter(example=>example.fijian&&example.english);
    if(completeExamples.length)box.append(usageExamplesPanel(completeExamples,entry.fijian));
    if(entry.grammarExample)box.append(linkedTuvavosa("p","grammar-example",`Recorded form · ${entry.grammarExample}`));
    for(const table of [entry.pronounTable,entry.possessionTable,entry.commonOwnerTable,entry.matavuTable,entry.isemaTable,entry.durusauTable]){
      if(table)box.append(grammarTablePanel(table));
    }
    const details=node("details","sense-review-details"),summary=node("summary","","Sources and review");details.append(summary);
    details.append(node("p","context-note",tr('grammarCaution')));
    const sourceLine=node("div","sense-sources");
    sourceLine.append(node("span","",tr('sourcesToReview')));
    for(const sourceRef of (entry.sources?.length?entry.sources:[entry.source]).filter(Boolean)){
      const s=source(sourceRef.id),href=sourceHref(s,sourceRef.page),sourceRow=node("div","sense-source");
      sourceRow.append(node("span","",`${s?.name||tr('personalNote')}${sourceRef.section?` · ${tr('section')} ${sourceRef.section}`:""}${sourceRef.page?` · ${tr('pdfPage')} ${sourceRef.page}`:""}`));
      if(href){const link=node("a","",tr('openGuide'));link.href=href;link.target="_blank";link.rel="noopener";sourceRow.append(link);}sourceLine.append(sourceRow);
    }
    details.append(sourceLine);
    if(entry.notes)details.append(node("p","detail-notes",displayNote(entry)));
    const actions=node("div","grammar-actions"),dictionary=node("button","button button-outline",tr('seeDictionaryEntry'));
    dictionary.type="button";dictionary.addEventListener("click",()=>{$("search").value=entry.fijian;$("pos-filter").value="";$("status-filter").value="";selectedId=headKey(entry.fijian);selectedSenseId=entry.id;setView("dictionary");});
    actions.append(dictionary,correctionLink(entry.fijian));details.append(actions);box.append(details);
  }
  function renderThemes() {
    const all=entries(), groups=[];
    const lead=meaning=>{
      let value=key(meaning).replace(/^\([^)]{1,45}\)\s*/,"");
      for(let i=0;i<5;i++){const next=value.replace(/^(?:a|an|the|small|large|very|native|common|edible|traditional|old|kind of|type of|species of)\s+/,"");if(next===value)break;value=next;}
      return value;
    };
    for(const rule of themeRules){
      const words=new Map();
      for(const entry of all){
        const gloss=lead(entry.meaning);
        const matched=entry.themes?.length?entry.themes.includes(rule.id):rule.pos?entry.englishPos===rule.pos:rule.sourceName?sourceName(entry.source?.id)===rule.sourceName:rule.sourceNames?rule.sourceNames.includes(sourceName(entry.source?.id)):
          (rule.match?.test(gloss)&&!(rule.exclude&&rule.exclude.test(gloss))) || (rule.extras||[]).some(([word,hint])=>key(entry.fijian)===word&&key(entry.meaning).includes(hint));
        if(matched&&!words.has(headKey(entry.fijian)))words.set(headKey(entry.fijian),entry);
      }
      const items=[...words.values()].sort((a,b)=>alphabet.compare(a.fijian,b.fijian));
      if(items.length)groups.push({rule,items});
    }
    groups.sort((a,b)=>alphabet.compare(a.rule.title,b.rule.title));
    const select=$("theme-select");select.replaceChildren(...groups.map(({rule,items})=>new Option(`${themeLabel(rule).title} · ${items.length.toLocaleString()}`,rule.id)));
    if(!groups.some(group=>group.rule.id===selectedThemeId))selectedThemeId=groups[0]?.rule.id||"";
    select.value=selectedThemeId;
    const selected=groups.find(group=>group.rule.id===selectedThemeId),list=$("theme-list"),examplesBox=$("theme-examples");list.replaceChildren();examplesBox.replaceChildren();
    if(!selected){$("theme-description").textContent=tr('noThemedWords');$("theme-count").textContent="";return;}
    const themeCaution=selectedThemeId==='veiqaraqaravi-vakavanua'?'Fijian sentence examples and local ceremonial context still need review.':selected.items.every(entry=>entry.themes?.includes(selectedThemeId))?'Entries still need language review.':tr('themeCheck');
    $("theme-description").textContent=`${themeLabel(selected.rule).description}. ${themeCaution}`;
    $("theme-count").textContent=`${selected.items.length.toLocaleString()} ${tr('wordsShown')} · A–Z`;
    if(selectedThemeId==="counting"){
      const ten=all.find(entry=>key(entry.fijian)==="tini"&&entry.englishPos==="numeral");
      if(ten?.usageExamples?.length)examplesBox.append(usageExamplesPanel(ten.usageExamples,ten.fijian));
    }
    if(selectedThemeId==="veiqaraqaravi-vakavanua"){
      const overview=node('article','culture-overview');
      overview.append(node('h3','','Words in a wider practice'));
      overview.append(node('p','','These words belong to different moments in a visit: arrival, presentation, gathering, and departure. Their full procedures and distinctions are in the Vakavanua guide.'));
      overview.append(node('p','culture-review-note','Both veiqaraqaravi vakavanua and veiqaravi vakavanua occur in institutional use. Local spelling preference still needs review.'));
      const guideButton=node('button','button button-outline','Read the full Vakavanua guide');guideButton.type='button';guideButton.addEventListener('click',()=>{setView('culture');$('culture-view').scrollIntoView({block:'start',behavior:'smooth'});});overview.append(guideButton);
      examplesBox.append(overview);
    }
    for(const entry of selected.items.slice(0,themeLimit)){
      const li=node("li",""),button=node("button","theme-word");button.type="button";button.append(node("strong","",entry.fijian),node("span","",meaningPreview(entry)));
      button.addEventListener("click",()=>{$("search").value=entry.fijian;$("pos-filter").value="";$("status-filter").value="";selectedId=headKey(entry.fijian);selectedSenseId=entry.id;setView("dictionary");});li.append(button);list.append(li);
    }
    if(selected.items.length>themeLimit){const li=node("li",""),more=node("button","theme-word",`${tr('showMoreWords')} (${(selected.items.length-themeLimit).toLocaleString()} ${tr('remaining')})`);more.type="button";more.addEventListener("click",()=>{themeLimit+=80;renderThemes();});li.append(more);list.append(li);}
  }
  function renderProverbs() {
    const query=key($("proverb-search").value);
    const matches=proverbs().filter(p=>!query||key([p.fijian,p.literal,p.meaning].join(" ")).includes(query)).sort((a,b)=>alphabet.compare(a.fijian,b.fijian));
    $("proverb-count").textContent=`${matches.length.toLocaleString()} ${tr('sayingsShown')} · ${proverbs().filter(p=>p.status==="reviewed").length.toLocaleString()} ${tr('reviewed')}`;
    const list=$("proverb-list");list.replaceChildren();
    if(!matches.length){list.append(node("div","empty-state",tr('noSayings')));renderProverbDetail(null);return;}
    if(!matches.some(p=>p.id===selectedProverbId))selectedProverbId=matches[0].id;
    for(const proverb of matches.slice(0,proverbLimit)){
      const row=node("button","entry-row"+(proverb.id===selectedProverbId?" selected":""));row.type="button";row.setAttribute("role","listitem");row.setAttribute("aria-label",proverb.fijian);
      row.append(node("span","entry-word",proverb.fijian),node("span","entry-preview",meaningPreview(proverb)));
      const meta=node("span","entry-meta");meta.append(node("span","chip",sayingLabel(proverb)),node("span","chip "+(proverb.status==="reviewed"?"reviewed":"needs-review"),reviewStatusLabel(proverb.status)));row.append(meta);
      row.addEventListener("click",()=>{selectedProverbId=proverb.id;renderProverbs();});list.append(row);
    }
    if(matches.length>proverbLimit){const more=node("button","entry-row",`${tr('showMoreSayings')} (${matches.length-proverbLimit} ${tr('remaining')})`);more.type="button";more.addEventListener("click",()=>{proverbLimit+=50;renderProverbs();});list.append(more);}
    renderProverbDetail(matches.find(p=>p.id===selectedProverbId));
  }
  function renderProverbDetail(proverb) {
    const box=$("proverb-detail");box.replaceChildren();
    if(!proverb){box.append(node("div","empty-state",tr('chooseSaying')));return;}
    if(wordPlayOrigin)box.append(wordPlayReturnBar());
    const top=node("div","detail-top"),title=node("div");title.append(node("p","detail-kicker",sayingLabel(proverb)),node("h2","proverb-headword",proverb.fijian));
    top.append(title,correctionLink(proverb.fijian));box.append(top);
    if(proverb.literal){const literal=node("div","proverb-field");literal.append(node("span","",tr('literalEnglish')),node("p","",proverb.literal));box.append(literal);}
    const meaning=node("div","proverb-field");meaning.append(node("span","",tr('meaning')),meaningPanel(proverb));box.append(meaning);
    const panel=node("div","source-panel");panel.append(node("h3","",tr('sources')));
    for(const ref of (proverb.sources?.length?proverb.sources:[proverb.source]).filter(Boolean)){const s=source(ref.id),line=node("div","sense-source");line.append(node("span","",`${s?.name||tr('personalNote')}${ref.page?` · ${tr('pdfPage')} ${ref.page}`:""}`));const href=sourceHref(s,ref.page);if(href){const link=node("a","",tr('openSource'));link.href=href;link.target="_blank";link.rel="noopener";line.append(link);}panel.append(line);}box.append(panel);
    box.append(node("p","detail-notes",proverb.notes?displayNote(proverb):tr('checkSaying')));
  }
  async function init() {
    language.setup();
    ensureGrammarTerms(base);ensureReviewedPdfAdditions(base);ensureTuvavosaEvidence(base);ensureTaukeniEvidence(base);ensureMatavuEvidence(base);ensureEnglishRepairs(base);ensureWordReviews(base);ensurePhoto44Evidence(base);ensureSentenceOrderEvidence(base);ensureMatanauniSet01Evidence(base);ensureFunctionalContrasts(base);ensureFirst300Release(base);ensureLatestPublishedEntries(base);sanitizeDataset(base);
    $("build-date").textContent='';
    renderPosOptions();renderEntries();
    document.addEventListener('naisema:language', () => { renderPosOptions(); renderEntries(); renderThemes(); renderGrammar(); renderProverbs(); });
    document.querySelectorAll(".tab[data-view]").forEach(t=>t.addEventListener("click",()=>setView(t.dataset.view)));
    document.querySelectorAll("[data-open-view]").forEach(button=>button.addEventListener("click",()=>{
      if(button.dataset.openTheme)selectedThemeId=button.dataset.openTheme;
      setView(button.dataset.openView);
      $(button.dataset.openView+"-view").scrollIntoView({block:"start",behavior:"smooth"});
    }));
    document.querySelectorAll("[data-culture-word]").forEach(button=>button.addEventListener("click",()=>{
      $("search").value=button.dataset.cultureWord;
      $("pos-filter").value="";
      $("status-filter").value="";
      selectedId=headKey(button.dataset.cultureWord);
      selectedSenseId=null;
      setView("dictionary");
      $("dictionary-view").scrollIntoView({block:"start",behavior:"smooth"});
    }));
    const showSearchResults=()=>{setView("dictionary");$("dictionary-view").scrollIntoView({block:"start",behavior:"smooth"});};
    $("search").addEventListener("input",()=>{entryLimit=60;selectedSenseId=null;const exact=entries().find(entry=>headKey(entry.fijian)===headKey($("search").value));selectedId=exact?headKey(exact.fijian):null;if(view!=="dictionary")setView("dictionary");else renderEntries();});
    $("search").addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();showSearchResults();}});
    $("hero-search-go").addEventListener("click",showSearchResults);
    for(const id of ["pos-filter","status-filter"])$(id).addEventListener("change",()=>{entryLimit=60;selectedSenseId=null;renderEntries();});
    $("proverb-search").addEventListener("input",()=>{proverbLimit=50;renderProverbs();});
    $("theme-select").addEventListener("change",()=>{selectedThemeId=$("theme-select").value;themeLimit=80;renderThemes();});
    $("grammar-search").addEventListener("input",()=>{selectedGrammarId=null;renderGrammar();});$("grammar-group").addEventListener("change",()=>{selectedGrammarId=null;renderGrammar();});
    if(new URLSearchParams(location.search).get('view')==='icavuti')setView('icavuti');
  }
  init();
})();
