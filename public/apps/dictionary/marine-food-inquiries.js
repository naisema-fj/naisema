// Checked Fiji seafood distinctions. Each pair stays with the word being explored.
(() => {
  const card = (word, question, options, correct, answer, clues = []) =>
    ({word, question, options, correct, answer, clues, incorrectHint: 'Look at where it lives and what kind of organism it is.'});
  const play = (title, intro, cards, label, href) => ({title, intro, cards, link: {label, href}});
  const entries = {
    cawaki: play('The sea urchin on the menu', 'Cawaki is an edible sea urchin found in Fiji. A USP study identifies it as Tripneustes gratilla and discusses the edible roe.', [
      card('cawaki', 'Which part of the cawaki is harvested for food in the USP study?', ['Its roe', 'Its spines'], 'Its roe', 'The roe is the edible part discussed in the study.'),
      card('cawaki', 'Both cawaki and nama come from the sea. Which one is an animal?', ['Cawaki', 'Nama'], 'Cawaki', 'Cawaki is a sea urchin; nama is an edible seaweed.', ['nama'])
    ], 'Read the Fiji sea-urchin study', 'https://repository.usp.ac.fj/8622/1/JL_Chilled_Sea_Urchin_Progress_Report_Final.pdf'),
    'kai koso': play('An ark shell, not a sea snail', 'A Fiji marine inventory pairs kai koso with the ark shell Anadara cornea.', [
      card('kai koso', 'A field list records kai koso. Would you look among bivalve shells or sea urchins?', ['Bivalve shells', 'Sea urchins'], 'Bivalve shells', 'The recorded identification is an ark shell, a bivalve.', ['cawaki']),
      card('kai koso', 'Madrali is also collected for food. Which name points to the ark shell rather than a marine snail?', ['Kai koso', 'Madrali'], 'Kai koso', 'The inventory identifies kai koso as an ark shell and madrali as a nerite snail.', ['madrali'])
    ], 'Read the Fiji marine inventory', 'https://rsis.ramsar.org/RISapp/files/38105685/documents/FJ2331_lit171016.pdf'),
    madrali: play('A polished little shell', 'Madrali is recorded as Nerita polita, a small marine snail with a smooth shell.', [
      card('madrali', 'A shell is smooth and polished. Which recorded name fits the nerite snail?', ['Madrali', 'Kai koso'], 'Madrali', 'Madrali is paired with Nerita polita; kai koso is an ark shell.', ['kai koso']),
      card('madrali', 'Are madrali and sigawale the same kind of shellfish?', ['No, snail and clam', 'Yes, both surf clams'], 'No, snail and clam', 'Madrali is a nerite snail. Sigawale is recorded as a surf clam.', ['sigawale'])
    ], 'Read the Fiji marine inventory', 'https://rsis.ramsar.org/RISapp/files/38105685/documents/FJ2331_lit171016.pdf'),
    mana: play('Mana in the mangroves', 'In this food sense, mana is the mud lobster Thalassina anomala. Keep it apart from other uses of the same spelling.', [
      card('mana', 'Where would you look for the mud lobster called mana?', ['In mangrove mud', 'On a dry hillside'], 'In mangrove mud', 'This recorded mana is a mangrove mud lobster.'),
      card('mana', 'Which of these seafood names belongs to a crustacean rather than a seaweed?', ['Mana', 'Nama'], 'Mana', 'Mana names a mud lobster in this sense; nama is sea grapes.', ['nama'])
    ], 'Read the Fiji fisheries report', 'https://openjicareport.jica.go.jp/pdf/10845352_02.pdf'),
    nama: play('Sea grapes without a vine', 'Nama is an edible Caulerpa seaweed. One common Fiji species is Caulerpa racemosa.', [
      card('nama', 'Are the “grapes” in sea grapes fruit from a vine?', ['No, they are seaweed', 'Yes, they grow on a vine'], 'No, they are seaweed', 'The grape-like beads belong to an edible seaweed.'),
      card('nama', 'Does finding the name nama alone prove every sample is the single species C. racemosa?', ['No', 'Yes'], 'No', 'C. racemosa is a common recorded species; the wider food name needs a specimen to settle exact species.')
    ], 'Read the USP sea-grapes study', 'https://repository.usp.ac.fj/id/eprint/5647/1/Value_adding_and_supply_chain_development_for_fisheries_and_aquaculture_products_in_Fiji_Samoa_and_Tonga-seagrapes_post-harvest_and_value_addition_in_Fiji-progress_report.pdf'),
    sigawale: play('A clam from the sand', 'Sigawale is an edible surf clam from sandy shallows. Atactodea striata is one recorded species.', [
      card('sigawale', 'Which setting fits the surf clam called sigawale?', ['Sandy shallows', 'A mangrove mud burrow'], 'Sandy shallows', 'The recorded surf clam lives in sand; mana is the mangrove mud lobster.', ['mana']),
      card('sigawale', 'Can one recorded scientific species identify every sigawale someone collects?', ['No, check the specimen', 'Yes, always'], 'No, check the specimen', 'The inventory records Atactodea striata, but the common name alone does not settle every specimen.')
    ], 'Read the Fiji marine inventory', 'https://rsis.ramsar.org/RISapp/files/38105685/documents/FJ2331_lit171016.pdf')
  };
  window.NAISEMA_WORD_PLAY ||= {};
  for (const [key, value] of Object.entries(entries)) {
    if (Object.hasOwn(window.NAISEMA_WORD_PLAY, key)) throw new Error(`Repeated marine-food inquiry: ${key}`);
    window.NAISEMA_WORD_PLAY[key] = value;
  }
})();
