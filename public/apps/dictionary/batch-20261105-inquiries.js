// Questions for the bounded 5 November English release. Each pair stays with its word.
// These are about attested meanings and contexts; uncertain grammar is not presented as fact.
(() => {
  const q = (word, question, options, correct, answer, clues = []) => ({word, question, options, correct, answer, incorrectHint: 'Read the word and the scene again.', clues});
  const play = (title, intro, cards, label, href) => ({title, intro, cards, link: {label, href}});
  const p = {
    'māmada': play('A light sound, not a light load', 'In a pronunciation guide, māmada describes a vowel said lightly. The unmarked mamada can describe something light in weight; read the setting before choosing a sense.', [
      q('māmada', 'If a teacher calls a vowel māmada, are they describing its sound or the weight of an object?', ['Its sound', 'An object’s weight'], 'Its sound', 'This is the pronunciation-guide use. Mamada in an everyday weight comparison is a different entry.', ['mamada']),
      q('māmada', 'Does the line over ā mean “say this lightly”?', ['No, it marks vowel length', 'Yes'], 'No, it marks vowel length', 'The macron marks a long vowel. That spelling mark is a different matter from the guide’s description of how strongly a vowel is spoken.')
    ], 'Read a study of Fijian vowel length', 'https://meigaku.repo.nii.ac.jp/record/2000255/files/eibeibungaku_139_51-57.pdf'),
    sovuniyame: play('Where is the tip?', 'A Fijian guide to speech sounds calls the tip of the tongue sovuniyame. It distinguishes this small part from batiniyame, the sides.', [
      q('sovuniyame', 'A mouth diagram points to the very front of the tongue. Which label fits?', ['Sovuniyame', 'Batiniyame'], 'Sovuniyame', 'Sovuniyame labels the tip; batiniyame labels the sides.', ['batiniyame']),
      q('sovuniyame', 'A phonetic account calls the Fijian r a tongue-tip trill or tap. Which named part would you pay attention to while trying that sound?', ['Sovuniyame', 'Batiniyame'], 'Sovuniyame', 'The r account concerns a movement of the tongue tip. Listen to a speaker too: a short tap and a longer trill are both reported.', ['rūrū'])
    ], 'Read the Fijian consonant account', 'https://manifold.uhpress.hawaii.edu/projects/the-fijian-language'),
    batiniyame: play('Find the tongue edge', 'Batiniyame names the sides of the tongue in a Fijian guide to speech sounds. Sovuniyame names its tip.', [
      q('batiniyame', 'A speech diagram points to the sides of the tongue. Which label fits?', ['Batiniyame', 'Sovuniyame'], 'Batiniyame', 'Batiniyame is the side of the tongue; sovuniyame points to the tip.', ['sovuniyame']),
      q('batiniyame', 'Does batiniyame label the whole tongue, or a particular part of it?', ['A particular part', 'The whole tongue'], 'A particular part', 'It singles out the sides. Knowing that location helps when following a diagram of how a sound is formed.', ['sovuniyame'])
    ], 'Read a Fijian body-parts list', 'https://theswissbay.ch/pdf/Books/Linguistics/Mega%20linguistics%20pack/Austronesian/Fijian%20Language%2C%20Handbook%20of%20the%20%28Moore%29%20%281893%29.pdf'),
    cecelevu: play('What kind of ground?', 'An older definition uses cecelevu for open ground without trees or bushes. Older Fijian Bible passages also use it for upland terrain, so the full range needs local checking.', [
      q('cecelevu', 'In the older open-ground sense, would a densely wooded patch be cecelevu?', ['No', 'Yes'], 'No', 'The older description singles out land without trees or bushes.', ['veikau']),
      q('vanua cecelevu', 'A Bible passage uses vanua cecelevu near a mountain. Does that prove every cecelevu is both high and treeless?', ['No', 'Yes'], 'No', 'It shows another historical setting for the word. A fuller local account is needed before treating height and lack of trees as one fixed definition.', ['buca'])
    ], 'See an older Fijian passage', 'https://www.bible.com/bible/3839/DEU.34.FIJ1864'),
    'ba via': play('A particular dalo', 'Ba via names a taro variety, not every dalo.', [
      q('ba via', 'A grower calls one dalo ba via. Are they naming a variety or the whole taro crop?', ['A variety', 'Every taro'], 'A variety', 'Ba via identifies a named variety of dalo.'),
      q('Tusi Tusi', 'A report also calls Ba via Tusi Tusi in an Australian planting. Does that make the two names separate crops?', ['No, names for the same reported variety', 'Yes, different crops'], 'No, names for the same reported variety', 'The report pairs the names for this variety. Local naming still needs context.', ['dalo'])
    ], 'Read the taro variety report', 'https://phamaplus.com.au/wp-content/uploads/2024/07/TR-51-FIJI06-Substantiation-of-Australias-Requirements-for-Devitalisation-of-Taro-Imports-v1.0-FINAL.pdf'),
    babakau: play('Breakfast, or a house wall?', 'The same spelling has been used for a fried food and for a wooden wall. The context decides.', [
      q('babakau', 'Someone buys babakau to eat with breakfast. Which sense is intended?', ['Fried bread', 'Wooden wall'], 'Fried bread', 'Here babakau is fried bread made from dough, sold as food.'),
      q('babakau', 'Would the food sense alone tell you what babakau means in a description of a house?', ['No', 'Yes'], 'No', 'No. The wall sense is separate and still needs its own checking. Read the whole phrase before choosing a meaning.', ['vale'])
    ], 'Read a Fiji market account', 'https://www.fijitimes.com.fj/the-pastry-seller/'),
    babale: play('What is a babale?', 'Babale names a dolphin. Longer names can distinguish kinds of dolphin.', [
      q('babale', 'Dolphins swim like fish. Is a babale a fish or a marine mammal?', ['Marine mammal', 'Fish'], 'Marine mammal', 'A dolphin is a marine mammal; its life in the sea does not make it a fish.', ['ika']),
      q('babale', 'Can the single word babale reliably identify one scientific dolphin species?', ['No', 'Yes'], 'No', 'No. Fiji records use additional words with babale to distinguish particular dolphins. A species needs more than this broad name.')
    ], 'See Fiji’s species list', 'https://parliament.gov.fj/wp-content/uploads/2017/02/FINAL-ENDANGERED-N-PROTECTED-SPECIES-BILL-2016-4-Final-Copy.pdf'),
    baca: play('A worm or bait?', 'Baca has two recorded senses. One names worms; another names bait placed on a hook or in a trap.', [
      q('baca', 'You see baca ni qele in a word list. Is it an earthworm or a fishhook?', ['An earthworm', 'A fishhook'], 'An earthworm', 'Baca ni qele names an earthworm. The added ni qele narrows the kind of baca.', ['ni', 'qele']),
      q('baca', 'A fisher puts baca on a hook. Which sense fits this scene?', ['Bait', 'A type of canoe'], 'Bait', 'Here baca is the bait. The worm and bait senses may meet in fishing, but they remain separate dictionary meanings.', ['siwa'])
    ], 'See baca in a Fijian learning course', 'https://fsi-languages.yojik.eu/languages/PeaceCorps/Fijian/ED131693.pdf'),
    'balabala sa': play('One fern, several names', 'Balabala can cover tree ferns more widely. Balabala sa points to a traditionally named kind.', [
      q('balabala sa', 'Does balabala sa mean every fern in Fiji?', ['No, a named tree fern', 'Yes, every fern'], 'No, a named tree fern', 'It is a named tree fern; balabala is a wider name in the accounts checked.'),
      q('balabala sa', 'Can a historical plant name alone settle its modern scientific species?', ['No', 'Yes'], 'No', 'No. The older identification and today’s botanical assignment still need comparison with a specimen. The name is useful even while the species is being checked.', ['balabala'])
    ], 'Explore Fiji tree ferns', 'https://collections.tepapa.govt.nz/topic/4060'),
    balaka: play('A palm with several species', 'Balaka is a Fijian palm name that also gave its name to a botanical genus.', [
      q('balaka', 'If someone points to a balaka, are they pointing to a palm or a bamboo cane?', ['A palm', 'Bamboo'], 'A palm', 'Balaka names a palm; bitu is bamboo.', ['bitu']),
      q('balaka', 'Does the name balaka alone identify one and only one scientific species?', ['No', 'Yes'], 'No', 'No. Several Balaka species are recorded. A photographed example cannot identify every palm bearing the name.')
    ], 'See a Fiji conservation account of Balaka', 'https://www.naturefiji.org/balaka-balaka-streptostachys/'),
    'bale, baleca': play('Falling, and falling onto', 'The two recorded forms direct attention differently: the fall itself and what the fall reaches.', [
      q('bale', 'A tree falls. Which form can describe the fall without naming what it lands on?', ['bale', 'baleca'], 'bale', 'Bale can describe falling from an upright position.'),
      q('baleca', 'A phrase names the thing a falling tree strikes. Which form makes that target relevant?', ['baleca', 'bale'], 'baleca', 'Baleca is recorded when the thing fallen on or towards is named. A complete Fijian sentence is still needed for its role.', ['dewa'])
    ], 'Read a local use of bale about a tree', 'https://www.fijitimes.com.fj/understanding-itaukei-figures-of-speech-part-14/'),
    'bali, balia': play('Kneading and the mixture', 'These forms are recorded for working a soft food mixture by hand.', [
      q('bali', 'A cook works soft dough by hand. Is that bali or a word for cutting it?', ['bali', 'Cutting'], 'bali', 'Bali can describe kneading a soft mixture.'),
      q('balia', 'The recipe names the dough being kneaded. Which recorded form points to that named mixture?', ['balia', 'bali only'], 'balia', 'Balia is used when the thing being kneaded is named. Keep the full recipe phrase in view.', ['madrai'])
    ], 'See balia in a Fijian bread recipe', 'https://www.churchofjesuschrist.org/study/friend/2023/03/write-a-parable?id=title2&lang=fij'),
    'balu-na': play('A cheek and its ending', 'The old written form balu-na displays an attached ending associated with a possessor.', [
      q('balu-na', 'On a face, what does balu name?', ['The cheek', 'An eyelash'], 'The cheek', 'Balu is the fleshy side of the face. The longer written form shows an attached ending.', ['mata']),
      q('balu-na', 'In the recorded form balu-na, is -na a separate word placed before balu?', ['No, it is attached', 'Yes'], 'No, it is attached', 'The form shows -na after balu. Its use in a full phrase still needs checking before we assign a grammatical role.', ['-na'])
    ], 'Read the historical Fijian word list', '/apps/dictionary/sources/fijian%20english%20volavosa.pdf'),
    banuve: play('A growing insect', 'Banuve is a caterpillar, the feeding stage before a moth or butterfly becomes an adult.', [
      q('banuve', 'A banuve eats a bean pod. Is the insect an adult moth or a caterpillar?', ['A caterpillar', 'An adult moth'], 'A caterpillar', 'The Fiji pest guide describes a bean-pod borer caterpillar as one example of banuve.'),
      q('banuve', 'Does that bean-pod example prove every banuve is the same insect species?', ['No', 'Yes'], 'No', 'No. Banuve is a wider word for caterpillars. A pest name may narrow it to one kind.')
    ], 'Read the Fiji pest guide', 'https://apps.lucidcentral.org/pppw_v12/text/web_mini/entities_fiji_fijian/manumanu_meca_ni_bean_037.htm'),
    'bari, baria': play('Nibbling at what?', 'These recorded forms concern gnawing or nibbling.', [
      q('bari', 'An animal takes little bites along an edge. Does bari suggest nibbling or carrying?', ['Nibbling', 'Carrying'], 'Nibbling', 'Bari is recorded for gnawing or nibbling, rather than carrying.'),
      q('baria', 'When the phrase names what is being gnawed, which recorded form can include that target?', ['baria', 'bari only'], 'baria', 'Baria can name the object of the nibbling. The particular sentence decides what was bitten.', ['dewa'])
    ], 'Read the historical Fijian word list', '/apps/dictionary/sources/fijian%20english%20volavosa.pdf'),
    'basu, basuka': play('Break a thing, break a rule', 'The physical and figurative uses share a break-apart idea, but the object changes the scene.', [
      q('basuka', 'If a person basuka na lawa, is the thing broken a branch or a law?', ['A law', 'A branch'], 'A law', 'A Fiji government statement uses basuka na lawa for breaking a law.', ['lawa']),
      q('basu', 'Does that legal example mean basu has no physical breaking sense?', ['No', 'Yes'], 'No', 'Historical sources also record breaking or forcing a physical thing apart. The phrase tells you which sense is intended.')
    ], 'Read the government’s Fijian statement', 'https://www.pmoffice.gov.fj/prime-minister-hon-josaia-voreqe-bainimaramas-statement-on-fijis-fifth-covid-19-case-25-03-2020/'),
    'bati leka': play('A traditional guarding role', 'Bati leka is used for a traditional warrior or guard group, with duties that depend on the community.', [
      q('bati leka', 'Is bati leka here a tooth or a traditional warrior role?', ['A warrior role', 'A tooth'], 'A warrior role', 'The full expression names people with a close guarding role, not the body part bati alone.', ['bati']),
      q('bati leka', 'Does one account of bati leka tell us the exact duties in every village?', ['No', 'Yes'], 'No', 'No. Local relationships and responsibilities vary. Compare the related bati balavu term before treating the two as identical.')
    ], 'Read a local account of bati leka', 'https://www.fijitimes.com.fj/loyalty-to-family-ties/'),
    'bati madramadra': play('A plant with bati in its name', 'Bati madramadra identifies a herb, Bidens pilosa, in a Fiji plant-medicine record.', [
      q('bati madramadra', 'Would you look for this bati madramadra among plants or among teeth?', ['Plants', 'Teeth'], 'Plants', 'The whole name identifies a herb. A word inside a plant name does not turn it into a body part.', ['bati']),
      q('bati madramadra', 'Does the historical plant name itself tell you how to prepare a medicine safely?', ['No', 'Yes'], 'No', 'No. A university thesis records the plant identification, but the older preparation claim has not been independently checked. The name and a treatment instruction are different kinds of information.')
    ], 'Read the Fiji plant thesis', 'https://researchcommons.waikato.ac.nz/bitstream/handle/10289/14136/thesis.pdf'),
    'bati-ni-sucu': play('First teeth, later teeth', 'A school passage uses bati ni sucu for a child’s first teeth. Spacing in the passage differs from this older lookup spelling.', [
      q('bati ni sucu', 'Are bati ni sucu a child’s first teeth or the teeth acquired in adulthood?', ['First teeth', 'Adult teeth'], 'First teeth', 'They are baby or milk teeth. The school passage gives the number as 20.', ['bati', 'sucu']),
      q('bati ni sucu', 'The school text writes bati ni sucu with spaces. Should we assume the older hyphens prove a different body part?', ['No', 'Yes'], 'No', 'No. The spacing varies in the sources; the first-teeth meaning is shared. Standard spelling still needs review.')
    ], 'Read the Fijian school passage', 'https://beaconmedia.com.au/beaconmedia/wp-content/uploads/2025/09/Yr-9-NANUMALESUNANODAVOSA9StudentsTextbook.pdf'),
    batibasaga: play('Which small creature?', 'Batibasaga is recorded for a scorpion. Older sources also list other creatures under the same form.', [
      q('batibasaga', 'In the checked local report about a sting, what kind of creature is batibasaga?', ['A scorpion', 'A heron'], 'A scorpion', 'The reported animal is a scorpion.'),
      q('batibasaga', 'Can every old occurrence be assigned to the same scorpion species from the spelling alone?', ['No', 'Yes'], 'No', 'No. A historical list also gives other animal uses. The animal and the setting need to be identified in each passage.')
    ], 'Read a Fiji report about scorpions', 'https://www.fijitimes.com.fj/common-arachnid/'),
    batikaciwa: play('A seasonal shorebird', 'Batikaciwa names the bar-tailed godwit, a migratory bird recorded in Fiji.', [
      q('batikaciwa', 'Is the bird described as returning seasonally or staying at one Fiji site all year?', ['Returning seasonally', 'Staying all year'], 'Returning seasonally', 'A Pacific seasonal calendar records its return to Fiji in September.'),
      q('batikaciwa', 'Does a matching spelling in an older list of landforms prove every batikaciwa is this bird?', ['No', 'Yes'], 'No', 'No. The bird and cliff-edge senses are separate. Read the context before choosing one.', ['bici'])
    ], 'See the Pacific seasonal calendar', 'https://library.sprep.org/sites/default/files/2025-03/Voices-of-the-Pacific.pdf'),
    batiri: play('Which kind of coast?', 'Batiri points to a mangrove shore; baravi can point to a more open coast or beach.', [
      q('batiri', 'A place is lined with mangroves. Is batiri or baravi the more specific name?', ['batiri', 'baravi'], 'batiri', 'Batiri identifies a mangrove shore in the accounts checked.'),
      q('batiri', 'If you move from mangrove roots to an open beach, would batiri still describe the same shore type?', ['No', 'Yes'], 'No', 'No. The contrast with baravi helps locate the kind of coastline; local place names may have their own uses.', ['dogo'])
    ], 'Read the Fiji coastal account', 'https://repository.si.edu/server/api/core/bitstreams/9956f2e7-f7d1-43a5-a91a-ae8249f07ceb/content'),
    'bau vudi': play('A tree name, more than one species', 'Botanical surveys apply bau vudi to more than one Palaquium tree.', [
      q('bau vudi', 'Is bau vudi the name of a tree or a particular taro variety?', ['A tree', 'Taro'], 'A tree', 'The botanical surveys list Palaquium trees under bau vudi.'),
      q('bau vudi', 'Can the name alone give every bau vudi tree one scientific species?', ['No', 'Yes'], 'No', 'No. Several Palaquium species are listed with this Fijian name. A specimen needs closer identification.')
    ], 'See the Fiji biodiversity survey', 'https://www.fao.org/fileadmin/user_upload/sap/docs/FPAM-Biodiversity%20study%20Fiji.pdf'),
    bavelo: play('Which canoe?', 'A bavelo is recorded as a small single-log canoe without an outrigger.', [
      q('bavelo', 'Would an outrigger be part of the traditional bavelo described in the older dictionary?', ['No', 'Yes'], 'No', 'No. The recorded form is dug from one log without an outrigger.', ['cama']),
      q('bavelo', 'A local account mentions paddling a bavelo. Does that prove every modern bavelo must be made from one exact timber?', ['No', 'Yes'], 'No', 'No. The account confirms the canoe name in use, but material and construction need to be checked in each setting.')
    ], 'Read a Fiji account of a bavelo', 'https://www.fijitimes.com.fj/a-murder-and-a-song-living-life-through-music/'),
    beli: play('A fish on the banknote', 'Beli names a freshwater goby. Fiji’s $10 note depicts one identified as Lever’s goby.', [
      q('beli', 'Where does the banknote’s beli live: a fast freshwater stream or a coral reef?', ['A fast freshwater stream', 'A coral reef'], 'A fast freshwater stream', 'The Reserve Bank places the fish in fast-running freshwater.', ['ika']),
      q('beli', 'Is the $10-note identification enough to prove every fish called beli has the same life cycle?', ['No', 'Yes'], 'No', 'No. Sources disagree about life history. The banknote identifies one beli as Lever’s goby; local fish identification still matters.')
    ], 'See the Reserve Bank’s $10 note account', 'https://www.rbf.gov.fj/wp-content/uploads/2012/12/Press-Release-No.-37-Fijis-New-Flora-and-Fauna-Design-Banknotes-and-Coins-Officially-Unveiled-by-His-Excellency-the-President-Ratu-Epeli-Nailatikau.pdf'),
    belo: play('From reef to inland stream', 'Belo is the reef heron Egretta sacra in a Fiji bird list.', [
      q('belo', 'Would you expect a belo only at the ocean reef?', ['No', 'Yes'], 'No', 'NatureFiji also records this heron by inland streams.', ['wai']),
      q('belo', 'Does the English name “reef heron” mean the bird can never forage in a forest stream?', ['No', 'Yes'], 'No', 'No. Its habitat spans exposed reef and inland water. English names can give a clue without listing every habitat.')
    ], 'Read NatureFiji’s heron account', 'https://www.naturefiji.org/birds-in-fijis-forests-belo-dravu/'),
    bici: play('Meet a banded rail', 'Bici is the banded rail in a Malolo Island bird list.', [
      q('bici', 'Is the bici on the Malolo list a rail or a reef heron?', ['A rail', 'A reef heron'], 'A rail', 'The list pairs bici with the banded rail and belo with the reef heron.', ['belo']),
      q('bici', 'Does an old claim of extinction on the main islands prove you cannot see a bici anywhere in Fiji today?', ['No', 'Yes'], 'No', 'No. A Malolo list records the bird. Its distribution needs current field evidence, not a sweeping statement from an old entry.')
    ], 'See the Malolo Island bird list', 'https://likulikulagoon.com/flora-fauna/'),
    liliwa: play('Cold in the weather', 'Draki liliwa is an attested phrase for cold weather.', [
      q('draki liliwa', 'In draki liliwa, is liliwa describing cold or wind?', ['Cold', 'Wind'], 'Cold', 'It describes the temperature of the weather.', ['draki']),
      q('liliwa', 'If the same word appears outside a weather report, should we assume draki is always present?', ['No', 'Yes'], 'No', 'No. Draki liliwa is one checked phrase, not a requirement for every use of liliwa.')
    ], 'Read a Fijian use of draki liliwa', 'https://www.jw.org/fj/ka-e-vakarautaki/ivola/Na-Cava-Mada-e-Kaya-na-iVolatabu/a-sucu-o-jisu-ena-tiseba/'),
    tubu: play('Growth in two settings', 'Tubu can describe a plant growing or a number increasing.', [
      q('tubu', 'Mangroves have grown quickly. Does tubu describe growth or cutting?', ['Growth', 'Cutting'], 'Growth', 'In the founder-approved mangrove sentence, tubu describes the trees growing.', ['dogo']),
      q('tubu', 'A report uses tubu for a rising count. Must the thing increasing be a plant?', ['No', 'Yes'], 'No', 'No. The growth idea also applies to numbers; the phrase tells you what is increasing.')
    ], 'See tubu in a Fiji government report', 'https://www.fiji.gov.fj/itaukei-statement-by-permanent-secretary-for-health-medical-services-dr-james-fong-28-03-22/'),
    vuca: play('What has decayed?', 'Vuca can describe something rotten or decaying, including a crop affected by prolonged wet weather.', [
      q('vuca', 'After long heavy rain, a crop becomes vuca. Is it thriving or decaying?', ['Decaying', 'Thriving'], 'Decaying', 'The Fijian weather advisory uses the word for plants at risk of rot.'),
      q('vuca', 'Would a bare vuca tell you which plant has rotted?', ['No', 'Yes'], 'No', 'No. The surrounding phrase names the plant or material. A second historical Vuca record remains under review.')
    ], 'Read the Fiji weather advisory', 'https://www.met.gov.fj/media/climate_product_files/FSCRO_February_2026.pdf')
  };
  for (const [key, activity] of Object.entries(p)) {
    if (Object.hasOwn(window.NAISEMA_WORD_PLAY, key)) throw new Error(`Repeated inquiry key: ${key}`);
    window.NAISEMA_WORD_PLAY[key] = activity;
  }
})();
