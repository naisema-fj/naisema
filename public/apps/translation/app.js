const usgs = 'https://www.usgs.gov/water-science-school/science/';
const words = {
  evaporation: {
    number: '01', title: 'Evaporation', subtitle: 'Water leaves the surface',
    meaning: 'Liquid water becomes invisible water vapour in the air.',
    etymology: 'From Latin evaporare: “out” + “vapour.”',
    clue: 'Keep the change from liquid water to invisible vapour clear.',
    science: `${usgs}evaporation-and-water-cycle`,
    wordHistory: 'https://www.etymonline.com/word/evaporation',
  },
  condensation: {
    number: '02', title: 'Condensation', subtitle: 'Tiny drops gather',
    meaning: 'Water vapour becomes tiny liquid drops, which can form clouds.',
    etymology: 'From Latin condensare: “make dense.”',
    clue: 'Describe vapour becoming droplets; a cloud is not the falling rain.',
    science: `${usgs}condensation-and-water-cycle`,
    wordHistory: 'https://www.etymonline.com/word/condensation',
  },
  precipitation: {
    number: '03', title: 'Precipitation', subtitle: 'Water falls from clouds',
    meaning: 'Water falls from clouds as rain, snow, sleet or hail.',
    etymology: 'From Latin praecipitatio, linked to “falling headlong.”',
    clue: 'Choose whether the Fijian wording means all falling water or rain alone.',
    science: `${usgs}precipitation-and-water-cycle`,
    wordHistory: 'https://www.etymonline.com/word/precipitation',
  },
  transpiration: {
    number: '04', title: 'Transpiration', subtitle: 'Water moves through plants',
    meaning: 'Plants release water vapour into the air, mainly through leaves.',
    etymology: 'From Latin trans “through” + spirare “breathe.”',
    clue: 'Keep the plant, the water and its movement into the air together.',
    science: `${usgs}evapotranspiration-and-water-cycle`,
    wordHistory: 'https://www.etymonline.com/word/transpiration',
  },
  runoff: {
    number: '05', title: 'Runoff', subtitle: 'Water travels over land',
    meaning: 'Water flows over the ground toward streams, rivers or the sea.',
    etymology: 'An English compound of “run” and “off.”',
    clue: 'Show movement across the surface, distinct from water entering soil.',
    science: `${usgs}surface-runoff-and-water-cycle`,
    wordHistory: 'https://www.etymonline.com/word/runoff',
  },
  infiltration: {
    number: '06', title: 'Infiltration', subtitle: 'Water enters the ground',
    meaning: 'Water at the surface soaks into soil and rock.',
    etymology: 'From “in” + “filter,” for passing through pores.',
    clue: 'Keep the direction clear: from the surface down into the ground.',
    science: `${usgs}infiltration-and-water-cycle`,
    wordHistory: 'https://www.etymonline.com/word/infiltration',
  },
};

const methods = {
  existing: { label: 'Existing usage', rule: 'Show where speakers already use it for this meaning.' },
  literal: { label: 'Literal', rule: 'Check the complete phrase, not only its separate parts.' },
  descriptive: { label: 'Descriptive', rule: 'Explain the process clearly in natural Fijian.' },
  borrowed: { label: 'Borrowed', rule: 'Show real use and check spelling and pronunciation.' },
  new: { label: 'New wording', rule: 'Mark it as a proposal and invite other expressions.' },
};

const layout = document.getElementById('explorer-layout');
const panel = document.getElementById('process-panel');
const form = document.getElementById('translation-form');
const methodSelect = document.getElementById('translation-method');
const feedback = document.getElementById('translation-feedback');
const savedBox = document.getElementById('saved-draft');
let currentTerm = null;

function put(id, value) { document.getElementById(id).textContent = value; }
function storageKey(term) { return `naisema.translation.draft.v2.${term}`; }
function readDraft(term) {
  try { return JSON.parse(localStorage.getItem(storageKey(term)) || 'null'); }
  catch { return null; }
}
function updateMethodRule() {
  put('method-rule', methods[methodSelect.value]?.rule || 'Choose an approach to see its rule.');
}

function showSavedDraft(draft) {
  if (!draft) { savedBox.hidden = true; savedBox.replaceChildren(); return; }
  const top = document.createElement('div');
  top.className = 'saved-top';
  const expression = document.createElement('strong');
  expression.textContent = draft.expression;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = 'Remove draft';
  remove.addEventListener('click', () => {
    try { localStorage.removeItem(storageKey(currentTerm)); }
    catch { feedback.textContent = 'Browser storage is unavailable.'; return; }
    form.reset();
    updateMethodRule();
    showSavedDraft(null);
    feedback.textContent = 'Draft removed from this browser.';
  });
  top.append(expression, remove);
  const details = document.createElement('p');
  details.textContent = `${methods[draft.method]?.label || 'Suggested approach'} · ${draft.reason}`;
  savedBox.replaceChildren(top, details);
  if (draft.context) {
    const context = document.createElement('p');
    context.textContent = `Source or local example: ${draft.context}`;
    savedBox.append(context);
  }
  // The draft stays on this device until the person chooses to send it, through NAISEMA's form.
  const idea = words[currentTerm]?.title || currentTerm || '';
  const message = [
    `Fijian expression: ${draft.expression}`,
    `Approach: ${methods[draft.method]?.label || draft.method}`,
    `Why this wording: ${draft.reason}`,
    ...(draft.context ? [`Source or local example: ${draft.context}`] : []),
  ].join('\n');
  const send = document.createElement('a');
  send.className = 'send-draft';
  send.href = `/forms/suggest-translation?idea=${encodeURIComponent(`${idea} (water cycle)`)}&message=${encodeURIComponent(message)}`;
  send.textContent = 'Send this draft to the team for review →';
  savedBox.append(send);
  savedBox.hidden = false;
}

function render(scrollToPanel = false) {
  const key = new URLSearchParams(location.search).get('term');
  const word = words[key];
  currentTerm = word ? key : null;
  layout.classList.toggle('has-selection', !!word);
  panel.hidden = !word;
  document.title = word ? `${word.title} · Community translation · NAISEMA` : 'Follow the water · NAISEMA';
  document.querySelectorAll('[data-term]').forEach(link => {
    const active = link.dataset.term === currentTerm;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.querySelectorAll('.flow-arrow').forEach(arrow => {
    arrow.classList.toggle('is-active', !!currentTerm && arrow.classList.contains(`${currentTerm}-arrow`));
  });
  if (!word) return;

  put('process-count', `${word.number} / 06`);
  put('process-title', word.title);
  put('process-subtitle', word.subtitle);
  put('process-meaning', word.meaning);
  put('process-etymology', word.etymology);
  put('process-clue', word.clue);
  document.getElementById('science-source').href = word.science;
  document.getElementById('etymology-source').href = word.wordHistory;
  form.reset();
  const draft = readDraft(key);
  if (draft && typeof draft.expression === 'string') {
    form.elements.expression.value = draft.expression;
    form.elements.method.value = methods[draft.method] ? draft.method : '';
    form.elements.reason.value = draft.reason || '';
    form.elements.context.value = draft.context || '';
    document.querySelector('.source-details').open = !!draft.context;
    showSavedDraft(draft);
  } else {
    document.querySelector('.source-details').open = false;
    showSavedDraft(null);
  }
  updateMethodRule();
  feedback.textContent = 'Saved only in this browser. Nothing is sent.';
  if (scrollToPanel && matchMedia('(max-width: 1100px)').matches) {
    requestAnimationFrame(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
}

document.querySelectorAll('[data-term]').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    const term = link.dataset.term;
    if (!words[term]) return;
    history.pushState(null, '', `?term=${term}`);
    render(true);
  });
});
document.getElementById('back-to-cycle').addEventListener('click', event => {
  event.preventDefault();
  history.pushState(null, '', location.pathname);
  render();
  document.getElementById('page-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
window.addEventListener('popstate', () => render());
methodSelect.addEventListener('change', updateMethodRule);

form.addEventListener('submit', event => {
  event.preventDefault();
  if (!currentTerm || !form.reportValidity()) return;
  const draft = {
    expression: form.elements.expression.value.trim(),
    method: form.elements.method.value,
    reason: form.elements.reason.value.trim(),
    context: form.elements.context.value.trim(),
  };
  if (!draft.expression || !draft.reason || !methods[draft.method]) return;
  try { localStorage.setItem(storageKey(currentTerm), JSON.stringify(draft)); }
  catch { feedback.textContent = 'This browser could not save the draft.'; return; }
  showSavedDraft(draft);
  feedback.textContent = 'Draft saved here. It has not been sent for review.';
});

render();
