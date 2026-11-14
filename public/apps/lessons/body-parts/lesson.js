(() => {
  'use strict';

  const STORAGE_KEY = 'naisema-body-possession-preview-v1';
  const words = [
    { id: 'ulu', fj: 'Ulu', en: 'Head', region: 'head', x: 35, y: 11 },
    { id: 'mata', fj: 'Mata', en: 'Eyes / face', region: 'head', x: 36, y: 9 },
    { id: 'balu', fj: 'Balu', en: 'Cheek', region: 'head', x: 32, y: 12 },
    { id: 'gusu', fj: 'Gusu', en: 'Mouth', region: 'head', x: 36, y: 14 },
    { id: 'daliga', fj: 'Daliga', en: 'Ear', region: 'head', x: 26, y: 11 },
    { id: 'kumi', fj: 'Kumi', en: 'Chin / beard', region: 'head', x: 35, y: 17 },
    { id: 'taba', fj: 'Taba', en: 'Shoulder', region: 'upper', x: 20, y: 22 },
    { id: 'liga', fj: 'Liga', en: 'Arm / hand', region: 'upper', x: 14, y: 43 },
    { id: 'saga', fj: 'Saga', en: 'Thigh', region: 'lower', x: 26, y: 66 },
    { id: 'temo', fj: 'Temo', en: 'Calf of leg', region: 'lower', x: 44, y: 79 },
    { id: 'drauniulu', fj: 'Drau ni ulu', en: 'Hair', region: 'head', x: 67, y: 9, accepted: ['drauniulu'] },
    { id: 'bati', fj: 'Bati', en: 'Teeth', region: 'head', x: 76, y: 25 },
    { id: 'tebenigusu', fj: 'Tebe ni gusu', en: 'Lips', region: 'head', x: 70, y: 21, accepted: ['tebenigusu'] },
    { id: 'yame', fj: 'Yame', en: 'Tongue', region: 'head', x: 76, y: 32 },
    { id: 'qaqalo', fj: 'Qaqalo', en: 'Fingers / toes', region: 'upper', x: 85, y: 51 },
    { id: 'taukuku', fj: 'Taukuku', en: 'Nails on fingers / toes', region: 'upper', x: 85, y: 59 },
    { id: 'yava', fj: 'Yava', en: 'Leg / foot', region: 'lower', x: 45, y: 96 }
  ];
  const byId = Object.fromEntries(words.map(w => [w.id, w]));
  const scenarios = [
    { label: 'My · one', people: 'My own body part', suffix: '-qu', note: 'A singular speaker ending on a checked body-part base.' },
    { label: 'Our two · listener out', people: 'Speaker + one other; listener excluded', suffix: '-ikeirau', note: 'This longer directly attached form occurs with certain checked bases.' },
    { label: 'Our few · listener out', people: 'Speaker + a few others; listener excluded', suffix: '-ikeitou', note: 'A few is a group size, not necessarily exactly three.' },
    { label: 'Our many · listener out', people: 'Speaker + many others; listener excluded', suffix: '-ikeimami', note: 'This is not a “your” ending.' },
    { label: 'Your · one', people: 'One listener', suffix: '-mu', note: 'The body part belongs to the person addressed.' },
    { label: 'Your · two', people: 'Two listeners', suffix: '-mudrau', note: 'Two people are being addressed.' },
    { label: 'Your · few', people: 'A few listeners', suffix: '-mudou', note: 'The listener group is a few people.' },
    { label: 'Your · many', people: 'Many listeners', suffix: '-muni', note: 'The listener group is many people.' },
    { label: 'Our two · listener in', people: 'Speaker + listener', suffix: '-daru', note: 'Inclusive: the listener is inside the group.' },
    { label: 'Our few · listener in', people: 'Speaker + listener + others', suffix: '-datou', note: 'Inclusive: the listener is inside the group.' },
    { label: 'Our many · listener in', people: 'Speaker + listener + many', suffix: '-da', note: 'Inclusive: the listener is inside the group.' }
  ];
  const theoryQuestions = [
    { prompt: 'Which is the checked “my teeth” example for this Vosa Vakaviti Raraba lesson?', options: ['batiqu', 'na noqu bati'], answer: 'batiqu', why: 'Bati takes the attached -qu in this checked example. Other Fijian varieties may use a different construction.' },
    { prompt: 'Which short form includes the person you are speaking to?', options: ['daru', 'keirau'], answer: 'daru', why: 'Daru includes the listener; keirau leaves the listener out in this contrast.' },
    { prompt: 'Which attached ending refers to two listeners?', options: ['-mudrau', '-ikeirau'], answer: '-mudrau', why: '-mudrau refers to two listeners; -ikeirau belongs with a speaker-exclusive group on certain bases.' }
  ];
  const practiceQuestions = [
    { prompt: 'My own body part · one speaker', answer: '-qu', options: ['-qu', '-mu', 'noqu'], why: 'The directly attached singular speaker ending is -qu.' },
    { prompt: 'Our body part · two of us, listener excluded', answer: '-ikeirau', options: ['-ikeirau', '-daru', '-mudrau'], why: 'On certain checked bases, -ikeirau points to the speaker’s exclusive pair.' },
    { prompt: 'Our body part · a few of us, listener excluded', answer: '-ikeitou', options: ['-ikeitou', '-datou', '-mudou'], why: '-ikeitou belongs with a speaker-exclusive few on certain checked bases.' },
    { prompt: 'Our body part · many of us, listener excluded', answer: '-ikeimami', options: ['-ikeimami', '-da', '-muni'], why: '-ikeimami belongs with a speaker-exclusive many on certain checked bases.' },
    { prompt: 'Your body part · one listener', answer: '-mu', options: ['-mu', '-qu', 'nomu'], why: 'The directly attached ending for one listener is -mu.' },
    { prompt: 'Your body part · two listeners', answer: '-mudrau', options: ['-mudrau', '-ikeirau', '-daru'], why: '-mudrau points to two people being addressed.' },
    { prompt: 'Your body part · a few listeners', answer: '-mudou', options: ['-mudou', '-ikeitou', '-datou'], why: '-mudou points to a few people being addressed.' },
    { prompt: 'Your body part · many listeners', answer: '-muni', options: ['-muni', '-ikeimami', '-da'], why: '-muni points to many people being addressed.' },
    { prompt: 'Our body part · speaker and listener together', answer: '-daru', options: ['-daru', '-ikeirau', '-mudrau'], why: '-daru is the inclusive pair ending.' },
    { prompt: 'Our body part · speaker, listener, and a few others', answer: '-datou', options: ['-datou', '-ikeitou', '-mudou'], why: '-datou includes the listener in the group of a few.' },
    { prompt: 'Our body part · speaker, listener, and many others', answer: '-da', options: ['-da', '-ikeimami', '-muni'], why: '-da includes the listener in the larger group.' }
  ];

  const initial = { mode: 'study', filter: 'all', selected: 'ulu', answers: {}, order: words.map(w => w.id), review: null, history: [], unlocked: false, best: 0, attempts: 0, theory: {}, scenario: 0, practiceIndex: 0, practiceCorrect: 0, practiceAnswered: false, practiceChoice: null, practiceDone: false };
  let state = { ...initial };
  let storageWorks = true;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && typeof saved === 'object') state = { ...initial, ...saved, answers: saved.answers || {}, history: Array.isArray(saved.history) ? saved.history : [], theory: saved.theory || {} };
  } catch { storageWorks = false; }
  if (!Array.isArray(state.order) || state.order.length !== words.length || state.order.some(id => !byId[id])) state.order = initial.order;
  if (!byId[state.selected]) state.selected = 'ulu';
  if (!['study', 'practice', 'challenge', 'review'].includes(state.mode)) state.mode = 'study';
  if (!Number.isInteger(state.practiceIndex) || state.practiceIndex < 0 || state.practiceIndex > practiceQuestions.length) state.practiceIndex = 0;
  if (!Number.isInteger(state.scenario) || state.scenario < 0 || state.scenario >= scenarios.length) state.scenario = 0;

  const $ = id => document.getElementById(id);
  const save = () => {
    if (!storageWorks) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { storageWorks = false; $('saveStatus').textContent = 'This browser cannot save progress; the lesson still works now.'; }
  };
  if (!storageWorks) $('saveStatus').textContent = 'This browser cannot save progress; the lesson still works now.';
  const norm = value => String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  const matches = (word, value) => [word.fj, ...(word.accepted || [])].some(answer => norm(answer) === norm(value));
  const shuffle = items => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    return copy;
  };

  function selectWord(id) {
    state.selected = id;
    const w = byId[id];
    $('focusRing').style.left = `${w.x}%`;
    $('focusRing').style.top = `${w.y}%`;
    $('focusEnglish').textContent = w.en;
    $('focusFijian').textContent = w.fj;
    $('mapCount').textContent = `${String(words.findIndex(item => item.id === id) + 1).padStart(2, '0')} / 17`;
    document.querySelectorAll('.word-card').forEach(button => button.classList.toggle('selected', button.dataset.word === id));
    save();
  }

  function renderCards() {
    const container = $('wordCards');
    container.replaceChildren();
    for (const [index, word] of words.entries()) {
      if (state.filter !== 'all' && word.region !== state.filter) continue;
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'word-card'; button.dataset.word = word.id; button.dataset.region = word.region;
      button.setAttribute('aria-label', `${word.fj}, ${word.en}. Focus on body map.`);
      const number = document.createElement('span'); number.className = 'word-number'; number.textContent = String(index + 1).padStart(2, '0');
      const pair = document.createElement('span'); pair.className = 'word-pair';
      const fj = document.createElement('strong'); fj.lang = 'fj'; fj.textContent = word.fj;
      const en = document.createElement('small'); en.textContent = word.en;
      pair.append(fj, en); button.append(number, pair); button.addEventListener('click', () => selectWord(word.id)); container.append(button);
    }
    selectWord(state.selected);
  }

  function renderAnswers() {
    const container = $('answerGrid'); container.replaceChildren();
    const list = state.mode === 'challenge' || state.mode === 'review' ? state.order.map(id => byId[id]) : words;
    for (const [index, word] of list.entries()) {
      const card = document.createElement('div'); card.className = 'answer-item'; card.dataset.answer = word.id;
      const title = document.createElement('div'); title.className = 'answer-title';
      const count = document.createElement('span'); count.textContent = String(index + 1).padStart(2, '0');
      const english = document.createElement('strong'); english.textContent = word.en;
      const focus = document.createElement('button'); focus.type = 'button'; focus.textContent = 'Locate'; focus.setAttribute('aria-label', `Locate ${word.en} on the body map`);
      focus.addEventListener('click', () => { selectWord(word.id); $('mapVisual').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
      title.append(count, english, focus);
      const form = document.createElement('div'); form.className = 'answer-form';
      const feedback = document.createElement('p'); feedback.className = 'answer-feedback';
      if (state.mode === 'study') {
        const label = document.createElement('span'); label.className = 'fijian-label'; label.lang = 'fj'; label.textContent = word.fj; form.append(label);
      } else {
        const input = document.createElement('input'); input.type = 'text'; input.autocomplete = 'off'; input.spellcheck = false; input.maxLength = 60;
        input.placeholder = 'Write in Fijian'; input.setAttribute('aria-label', `Fijian for ${word.en}`); input.value = state.answers[word.id] || '';
        input.readOnly = state.mode === 'review';
        input.addEventListener('input', () => { state.answers[word.id] = input.value; save(); });
        if (state.mode === 'practice') input.addEventListener('blur', () => {
          if (!input.value.trim()) return;
          const correct = matches(word, input.value); card.classList.toggle('correct', correct); card.classList.toggle('wrong', !correct);
          feedback.textContent = correct ? 'Yes — that matches this preview label.' : `Try again. Study label: ${word.fj}`;
        });
        form.append(input);
        if (state.mode === 'review' && state.review) {
          const correct = !!state.review[word.id]; card.classList.add(correct ? 'correct' : 'wrong');
          feedback.textContent = correct ? 'Correct.' : `Study label: ${word.fj}`;
        }
      }
      card.append(title, form, feedback); container.append(card);
    }
    $('hideBtn').textContent = state.mode === 'practice' ? 'Show Fijian labels' : 'Hide Fijian labels';
    $('hideBtn').disabled = state.mode === 'challenge';
    $('challengeBtn').disabled = state.mode === 'challenge';
    $('submitBtn').hidden = state.mode !== 'challenge';
    $('recallMode').textContent = state.mode === 'study' ? 'Study mode' : state.mode === 'practice' ? 'Hidden-label practice' : state.mode === 'challenge' ? 'Independent check' : 'Check reviewed';
    $('checkInstruction').textContent = state.mode === 'study' ? 'Use the labels to study, or hide them for a practice round.' : state.mode === 'practice' ? 'Write the Fijian words. Leaving a field checks your attempt without affecting the unlock.' : state.mode === 'challenge' ? 'No hints in this round. Fill every space, then check your answers.' : 'Your answers and corrections remain visible. Begin another round when ready.';
    if (state.mode === 'challenge') $('answerGrid').querySelector('input')?.focus();
  }

  function renderResult() {
    const result = $('result'); result.replaceChildren();
    if (state.mode !== 'review' || !state.review) { result.hidden = true; return; }
    result.hidden = false;
    const score = Object.values(state.review).filter(Boolean).length;
    const passed = score >= Math.ceil(words.length * .9);
    result.classList.toggle('fail', !passed);
    const heading = document.createElement('strong'); heading.textContent = passed ? `${score} / 17 — possession is open` : `${score} / 17 — keep exploring`;
    const detail = document.createElement('p'); detail.textContent = passed ? 'You reached the 90% threshold. Review any missed word, then explore how body-part possession works.' : `You need 16 correct to open possession. Review the highlighted words and try a new round.`;
    const again = document.createElement('button'); again.type = 'button'; again.className = 'button secondary'; again.textContent = 'Try a fresh 17-word check'; again.addEventListener('click', startChallenge);
    const study = document.createElement('button'); study.type = 'button'; study.className = 'button secondary'; study.textContent = 'Study the labels'; study.style.marginLeft = '8px'; study.addEventListener('click', () => { state.mode = 'study'; state.answers = {}; state.review = null; save(); renderAnswers(); renderResult(); });
    result.append(heading, detail, again, study);
  }

  function renderHistory() {
    const wrapper = $('attemptHistory');
    const list = $('historyList'); list.replaceChildren();
    wrapper.hidden = state.history.length === 0;
    [...state.history].reverse().forEach((attempt, index) => {
      const item = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = `Check ${state.history.length - index}: ${attempt.score} / 17`;
      item.append(summary);
      const missed = words.filter(word => !attempt.review[word.id]);
      if (missed.length === 0) { const p = document.createElement('p'); p.textContent = 'Every label was correct.'; item.append(p); }
      else {
        const ul = document.createElement('ul');
        for (const word of missed) { const li = document.createElement('li'); li.textContent = `${word.en}: you wrote “${attempt.answers[word.id] || '—'}”; study label “${word.fj}”.`; ul.append(li); }
        item.append(ul);
      }
      list.append(item);
    });
  }

  function startChallenge() {
    state.mode = 'challenge'; state.answers = {}; state.review = null; state.order = shuffle(words.map(w => w.id)); save();
    renderAnswers(); renderResult(); $('recall').scrollIntoView({ behavior: 'smooth' });
  }

  function submitChallenge() {
    const review = {};
    for (const word of words) review[word.id] = matches(word, state.answers[word.id]);
    const score = Object.values(review).filter(Boolean).length;
    state.review = review; state.mode = 'review'; state.attempts += 1; state.best = Math.max(state.best, score);
    state.history = [...state.history, { score, answers: { ...state.answers }, review: { ...review } }].slice(-5);
    if (score >= Math.ceil(words.length * .9)) state.unlocked = true;
    save(); renderAnswers(); renderResult(); renderHistory(); renderPossession();
    $('result').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderPossession() {
    $('lockedPanel').hidden = state.unlocked;
    $('theoryPanel').hidden = !state.unlocked;
    $('possession').classList.toggle('locked', !state.unlocked);
    $('possessionStage').setAttribute('aria-disabled', state.unlocked ? 'false' : 'true');
    $('possessionStage').querySelector('small').textContent = state.unlocked ? 'Theory & practice' : 'Unlock at 90%';
    $('possessionIntro').textContent = state.unlocked ? 'Explore the theory, then test how person, number, and inclusion change an attached ending.' : 'Earn 16 correct body labels in a fresh check to open this theory and its activities.';
    if (state.unlocked) { renderScenarios(); renderTheoryQuestions(); renderPractice(); }
  }

  function renderScenarios() {
    const container = $('scenarioButtons'); container.replaceChildren();
    scenarios.forEach((scenario, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = scenario.label; button.classList.toggle('active', state.scenario === index);
      button.setAttribute('aria-pressed', state.scenario === index ? 'true' : 'false');
      button.addEventListener('click', () => { state.scenario = index; save(); renderScenarios(); }); container.append(button);
    });
    const current = scenarios[state.scenario] || scenarios[0];
    $('scenarioPeople').textContent = current.people;
    $('scenarioForm').textContent = current.suffix;
    $('scenarioNote').textContent = current.note;
    $('viewpointExplanation').textContent = current.people + '. Notice how the listener’s position changes the meaning before choosing an ending.';
    const icons = $('peopleDisplay').children;
    const count = state.scenario === 0 || state.scenario === 4 ? 1 : state.scenario === 1 || state.scenario === 5 || state.scenario === 8 ? 2 : 4;
    [...icons].forEach((icon, index) => icon.classList.toggle('on', index < count));
    $('listenerIcon').style.background = state.scenario >= 8 ? '#d5eddb' : '#f4d891';
  }

  function renderTheoryQuestions() {
    const container = $('theoryQuestions'); container.replaceChildren();
    theoryQuestions.forEach((question, index) => {
      const wrap = document.createElement('div'); wrap.className = 'theory-q';
      const title = document.createElement('h4'); title.textContent = `${index + 1}. ${question.prompt}`;
      const row = document.createElement('div'); row.className = 'choice-row';
      const feedback = document.createElement('p'); feedback.className = 'q-feedback';
      for (const option of question.options) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = option; if (option.includes('bati') || option.includes('daru') || option.includes('irau')) button.lang = 'fj';
        const chosen = state.theory[index] === option;
        button.classList.toggle('selected', chosen);
        if (chosen) button.classList.add(option === question.answer ? 'correct' : 'incorrect');
        button.setAttribute('aria-pressed', chosen ? 'true' : 'false');
        button.addEventListener('click', () => { state.theory[index] = option; save(); renderTheoryQuestions(); }); row.append(button);
      }
      if (state.theory[index]) feedback.textContent = (state.theory[index] === question.answer ? 'Correct. ' : 'Try again. ') + question.why;
      wrap.append(title, row, feedback); container.append(wrap);
    });
    const allCorrect = theoryQuestions.every((q, index) => state.theory[index] === q.answer);
    $('theoryResult').textContent = allCorrect ? 'All three distinctions are clear. Suffix detective is open below.' : `${theoryQuestions.filter((q, index) => state.theory[index] === q.answer).length} of 3 ideas checked.`;
    $('practicePanel').hidden = !allCorrect;
    if (allCorrect) renderPractice();
  }

  function renderPractice() {
    if ($('practicePanel').hidden) return;
    const container = $('practiceQuestion'); container.replaceChildren();
    const feedback = $('practiceFeedback'); feedback.textContent = '';
    const next = $('nextPractice'); next.hidden = true;
    if (state.practiceDone || state.practiceIndex >= practiceQuestions.length) {
      const heading = document.createElement('p'); heading.className = 'practice-prompt'; heading.textContent = `Session complete: ${state.practiceCorrect} / ${practiceQuestions.length} first choices correct.`;
      const message = document.createElement('p'); message.textContent = 'Revisit any viewpoint and try again. This is suffix recognition practice, not a speaking assessment.';
      const restart = document.createElement('button'); restart.type = 'button'; restart.className = 'button secondary'; restart.textContent = 'Play again'; restart.addEventListener('click', () => { state.practiceIndex = 0; state.practiceCorrect = 0; state.practiceAnswered = false; state.practiceChoice = null; state.practiceDone = false; save(); renderPractice(); });
      container.append(heading, message, restart); $('practiceProgress').textContent = `${practiceQuestions.length} / ${practiceQuestions.length}`; return;
    }
    const q = practiceQuestions[state.practiceIndex];
    $('practiceProgress').textContent = `${state.practiceIndex + 1} / ${practiceQuestions.length}`;
    const prompt = document.createElement('p'); prompt.className = 'practice-prompt'; prompt.textContent = q.prompt;
    const row = document.createElement('div'); row.className = 'practice-options';
    const options = shuffle(q.options);
    for (const option of options) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = option; button.lang = 'fj';
      button.addEventListener('click', () => {
        if (state.practiceAnswered) return;
        state.practiceAnswered = true;
        state.practiceChoice = option;
        if (option === q.answer) state.practiceCorrect += 1;
        [...row.children].forEach(choice => { choice.disabled = true; if (choice.textContent === q.answer) choice.classList.add('correct'); else if (choice === button) choice.classList.add('incorrect'); });
        feedback.textContent = (option === q.answer ? 'Correct. ' : 'Look again. ') + q.why;
        next.hidden = false; next.textContent = state.practiceIndex === practiceQuestions.length - 1 ? 'See session result →' : 'Next viewpoint →'; save();
      }); row.append(button);
    }
    container.append(prompt, row);
    if (state.practiceAnswered) {
      [...row.children].forEach(choice => {
        choice.disabled = true;
        if (choice.textContent === q.answer) choice.classList.add('correct');
        else if (choice.textContent === state.practiceChoice) choice.classList.add('incorrect');
      });
      feedback.textContent = (state.practiceChoice === q.answer ? 'Correct. ' : 'Look again. ') + q.why;
      next.hidden = false;
      next.textContent = state.practiceIndex === practiceQuestions.length - 1 ? 'See session result →' : 'Next viewpoint →';
    }
  }

  document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => {
    state.filter = button.dataset.filter; save();
    document.querySelectorAll('.filter').forEach(item => { const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-pressed', active ? 'true' : 'false'); });
    renderCards();
  }));
  $('hideBtn').addEventListener('click', () => {
    if (state.mode === 'challenge') return;
    state.mode = state.mode === 'practice' ? 'study' : 'practice'; state.answers = {}; state.review = null; save(); renderAnswers(); renderResult();
  });
  $('challengeBtn').addEventListener('click', startChallenge);
  $('submitBtn').addEventListener('click', submitChallenge);
  $('possessionStage').addEventListener('click', event => { if (!state.unlocked) event.preventDefault(); });
  $('nextPractice').addEventListener('click', () => { state.practiceIndex += 1; state.practiceAnswered = false; state.practiceChoice = null; if (state.practiceIndex >= practiceQuestions.length) state.practiceDone = true; save(); renderPractice(); });
  $('resetBtn').addEventListener('click', () => {
    if (!window.confirm('Reset this lesson preview’s saved answers and progress on this device?')) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* The current session can still reset. */ }
    state = { ...initial, answers: {}, order: [...initial.order], review: null, history: [], theory: {} };
    window.location.replace(window.location.pathname);
  });

  document.querySelectorAll('.filter').forEach(button => { const active = button.dataset.filter === state.filter; button.classList.toggle('active', active); button.setAttribute('aria-pressed', active ? 'true' : 'false'); });
  renderCards(); renderAnswers(); renderResult(); renderHistory(); renderPossession();
})();
