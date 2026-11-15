(() => {
'use strict';
// The page lists every letter with its own audio control and works without this script. This adds
// the featured letter, tap-to-listen, the seek bar and the speed control. Each letter's details are
// read from the data- attributes the server wrote (app/lib/pronunciation-page.server.tsx), so the
// wording and the recording a visitor hears are always what the sound guide says now.
const root = document.querySelector('.fijian-app');
const tiles = [...document.querySelectorAll('li[data-letter]')];
const el = id => document.getElementById(id);
const audio = el('voice'), play = el('play'), icon = el('play-icon'), label = el('play-label'), hint = el('play-hint');
const hero = el('featured');
if (!root || !tiles.length || !audio || !play || !hero) return;
const featured = el('featured-letter'), group = el('group'), seek = el('seek'), elapsed = el('elapsed'), total = el('duration'), speed = el('speed');
const ipa = el('ipa'), english = el('english-approx'), note = el('phonetic-note'), reviewNote = el('review-state-note');
const byLetter = Object.fromEntries(tiles.map(t => [t.dataset.letter, t]));
let current = tiles[0].dataset.letter;
const fmt = n => `${Math.floor((n || 0) / 60)}:${String(Math.floor((n || 0) % 60)).padStart(2, '0')}`;
const hasAudio = letter => !!byLetter[letter].dataset.src;
const unavailable = letter => byLetter[letter].dataset.recording === 'withheld'
  ? "This recording isn't available right now."
  : 'A recording is still needed.';

function update() {
  const available = hasAudio(current);
  const dur = available && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
  const running = available && !audio.paused;
  elapsed.textContent = fmt(available ? audio.currentTime : 0);
  total.textContent = available ? fmt(dur) : '—';
  seek.value = dur ? Math.min(100, Math.round(audio.currentTime / dur * 100)) : 0;
  play.disabled = !available;
  seek.disabled = !available;
  speed.disabled = !available;
  play.classList.toggle('playing', running);
  icon.textContent = available ? (running ? 'Ⅱ' : '▶') : '○';
  label.textContent = available ? (running ? 'Pause ' + current : 'Hear ' + current) : current + ' recording needed';
  hint.textContent = available ? (running ? 'Tap to pause' : 'Tap to hear the recording') : unavailable(current);
  tiles.forEach(t => {
    const selected = t.dataset.letter === current;
    t.classList.toggle('selected', selected);
    t.querySelector('.tile-link').setAttribute('aria-current', selected ? 'true' : 'false');
    t.querySelector('.icon').textContent = selected && running ? 'Ⅱ' : (t.dataset.src ? '▶' : '○');
  });
}

// The button's name starts with what it shows, so it matches its visible text.
function setSpeed(rate) {
  audio.playbackRate = rate;
  speed.textContent = rate + '×';
  speed.setAttribute('aria-label', rate + '× playback speed, change');
}

async function choose(letter, autoplay, changeHash) {
  const tile = byLetter[letter];
  if (!tile) return;
  audio.pause();
  current = letter;
  featured.textContent = tile.dataset.display;
  group.textContent = tile.dataset.group;
  ipa.textContent = tile.dataset.ipa;
  english.textContent = tile.dataset.english;
  note.textContent = tile.dataset.note + (tile.dataset.src ? '' : ' ' + unavailable(letter));
  reviewNote.textContent = tile.dataset.review;
  audio.removeAttribute('src');
  if (tile.dataset.src) audio.src = tile.dataset.src;
  audio.load();
  setSpeed(1);
  if (changeHash) history.replaceState(null, '', '#' + encodeURIComponent(letter));
  update();
  if (autoplay && tile.dataset.src) {
    try { await audio.play(); } catch (err) { console.warn('Tap play to listen', err); }
    update();
  }
}

async function toggle() {
  if (!hasAudio(current)) return;
  try {
    if (audio.paused) { if (audio.ended) audio.currentTime = 0; await audio.play(); } else audio.pause();
  } catch (err) { console.error(err); }
  update();
}

root.classList.add('enhanced');
hero.hidden = false;
tiles.forEach(t => t.querySelector('.tile-link').addEventListener('click', e => {
  e.preventDefault();
  choose(t.dataset.letter, true, true);
}));
play.addEventListener('click', toggle);
['loadedmetadata', 'durationchange', 'timeupdate', 'play', 'pause', 'ended', 'seeking'].forEach(ev => audio.addEventListener(ev, update));
seek.addEventListener('input', () => {
  if (Number.isFinite(audio.duration) && audio.duration > 0) { audio.currentTime = audio.duration * (+seek.value / 100); update(); }
});
speed.addEventListener('click', () => {
  if (!hasAudio(current)) return;
  const opts = [.75, 1, 1.25];
  const idx = opts.findIndex(v => Math.abs(audio.playbackRate - v) < .01);
  const next = opts[(idx + 1) % opts.length];
  setSpeed(next);
});
window.addEventListener('hashchange', () => {
  const l = decodeURIComponent(location.hash.slice(1));
  if (byLetter[l] && l !== current) choose(l, false, false);
});
const fromHash = decodeURIComponent(location.hash.slice(1));
choose(byLetter[fromHash] ? fromHash : current, false, false);
})();
