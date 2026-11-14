// House-part questions grounded in Na Viti Va, printed p. 21, and a Cautata build study.
// The diagram's short labels are not made into invented example sentences.
(() => {
  const lesson = '/apps/vale-vakaviti/';
  const card = (word, question, options, correct, answer, clues = []) =>
    ({word, question, options, correct, answer, clues, incorrectHint: 'Compare where each timber sits in the house frame.'});
  const activity = (title, intro, cards) => ({
    title, intro, cards,
    link: {label: 'Explore this part in the Vale Vakaviti lesson', href: lesson}
  });
  const entries = {
    boutoka: activity('What holds up the ridge?',
      'A boutoka is a main upright above a cross beam. It carries the ridge at the top of the roof; the field study writes the name bou toka.', [
        card('boutoka', 'Which timber does the boutoka help support?', ['The roof ridge', 'The floor mat'], 'The roof ridge', 'The main upright carries the ridgepole, called doka.', ['doka']),
        card('boutoka', 'If the icoka is the cross beam, where does the boutoka stand in relation to it?', ['Above it', 'Below the house site'], 'Above it', 'The main upright is placed on top of the cross beam in the recorded build.', ['icoka'])
      ]),
    icoka: activity('Follow a beam across the house',
      'Icoka is a cross beam. The same term is written i coka in the Cautata building study.', [
        card('icoka', 'Does an icoka run across the frame or along the very top ridge?', ['Across the frame', 'Along the top ridge'], 'Across the frame', 'The top ridge is the doka; icoka names a cross or tie beam.', ['doka']),
        card('icoka', 'In the recorded build, what is set on the cross beams after they are fixed?', ['The main posts called boutoka', 'The floor mats'], 'The main posts called boutoka', 'The main roof uprights are placed above the cross beams.', ['boutoka'])
      ]),
    icavai: activity('Read the layers of the roof',
      'Icavai is an upper purlin: a lengthwise timber fixed across the roof rafters. The field study writes i cavai.', [
        card('icavai', 'What is fitted first in the recorded building sequence?', ['Rafters', 'Upper purlins'], 'Rafters', 'The rafters are placed before the purlins are fixed over them.'),
        card('icavai', 'The study distinguishes icavai from bolo. Which sits higher in its list of roof purlins?', ['Icavai', 'Bolo'], 'Icavai', 'Icavai is the upper purlin; bolo is the middle purlin.', ['bolo'])
      ]),
    latu: activity('Look at the wall frame',
      'Latu names an additional upright along the wall. It is not the main post carrying the roof ridge.', [
        card('latu', 'Where does the Viti diagram point when it labels latu?', ['To the wall frame', 'To the roof ridge'], 'To the wall frame', 'The label points to an upright in the wall frame.', ['doka']),
        card('latu', 'Which named part carries the ridge above a cross beam in the recorded build?', ['Boutoka', 'Latu'], 'Boutoka', 'Boutoka is a main upright; latu is an additional wall upright.', ['boutoka'])
      ]),
    bolo: activity('A word in the roof frame',
      'In this house-building sense, bolo is a middle purlin. The same spelling has other meanings, so the setting matters.', [
        card('bolo', 'In the house diagram, is bolo a roof timber or a wall post?', ['A roof timber', 'A wall post'], 'A roof timber', 'Here it names a purlin running through the middle part of the roof.', ['latu']),
        card('bolo', 'Compared with icavai, where is bolo listed in the study?', ['In the middle roof layer', 'Above the ridgepole'], 'In the middle roof layer', 'The study calls icavai the upper purlin and bolo the middle purlin.', ['icavai'])
      ]),
    kautabu: activity('Find the top of the wall',
      'Kautabu is a timber along the top of a house wall. The field study writes kau tabu and calls it a wall plate.', [
        card('kautabu', 'Does the kautabu sit along the top of the wall or at the roof ridge?', ['Along the top of the wall', 'At the roof ridge'], 'Along the top of the wall', 'The ridgepole is doka. Kautabu runs along the wall top.', ['doka']),
        card('kautabu', 'In the recorded construction sequence, what goes in first?', ['The upright posts', 'The wall plates'], 'The upright posts', 'The builders set the posts first, then fitted wall plates to their tops.')
      ])
  };
  window.NAISEMA_WORD_PLAY ||= {};
  for (const [key, value] of Object.entries(entries)) {
    if (Object.hasOwn(window.NAISEMA_WORD_PLAY, key)) throw new Error(`Repeated house inquiry: ${key}`);
    window.NAISEMA_WORD_PLAY[key] = value;
  }
})();
