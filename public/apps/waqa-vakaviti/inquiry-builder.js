(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const key = "naisema-waqa-inquiry-drafts-v1";
  const fields = ["synthesisPart", "synthesisSeen", "synthesisSource", "synthesisChallenge", "synthesisTrial"];
  const labels = ["Fijian part name", "What the view shows", "Another account", "Present-day need or skill", "An action and a reason to revise"];
  let saved = [];
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    if (Array.isArray(value)) saved = value.filter(item => item && typeof item.part === "string");
  } catch { /* Learners can still work during this session. */ }

  function readDraft() {
    return fields.map(id => $(id).value.trim());
  }
  function describe(container, draft) {
    const list = document.createElement("dl");
    draft.forEach((value, index) => {
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      term.textContent = labels[index];
      description.textContent = value;
      if (index === 0) description.lang = "fj";
      list.append(term, description);
    });
    container.append(list);
  }
  function buildDraft() {
    const draft = readDraft();
    const missing = draft.findIndex(value => !value);
    if (missing >= 0) {
      $("synthesisStatus").textContent = `Add ${labels[missing].toLowerCase()} before building your inquiry.`;
      $(fields[missing]).focus();
      return null;
    }
    const result = $("synthesisResult");
    result.replaceChildren();
    const title = document.createElement("h5");
    title.textContent = `My inquiry begins with ${draft[0]}`;
    result.append(title);
    describe(result, draft);
    result.hidden = false;
    $("synthesisStatus").textContent = "You have combined a name, two kinds of evidence, a purpose and a test. What might make you revise it?";
    return draft;
  }
  function renderSaved() {
    const list = $("synthesisSaved");
    list.replaceChildren();
    saved.forEach((item, index) => {
      const entry = document.createElement("li");
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = `${index + 1}. ${item.part} · ${item.challenge}`;
      details.append(summary);
      describe(details, [item.part, item.seen, item.source, item.challenge, item.trial]);
      entry.append(details);
      list.append(entry);
    });
  }
  $("synthesisRing").addEventListener("click", () => {
    if ($("partContent").hidden) {
      $("synthesisStatus").textContent = "Choose a ring in a canoe view first, then return to this inquiry.";
      return;
    }
    $("synthesisPart").value = $("detailTitle").textContent.trim();
    $("synthesisStatus").textContent = "Part name added. Record what you can actually see before drawing a conclusion.";
  });
  $("synthesisForm").addEventListener("submit", event => {
    event.preventDefault();
    buildDraft();
  });
  $("saveSynthesis").addEventListener("click", () => {
    const draft = buildDraft();
    if (!draft) return;
    saved.push({part:draft[0], seen:draft[1], source:draft[2], challenge:draft[3], trial:draft[4]});
    renderSaved();
    try {
      localStorage.setItem(key, JSON.stringify(saved));
      $("synthesisStatus").textContent = "Inquiry saved on this device. Revisit it when a sailor, builder or new source changes your thinking.";
    } catch {
      $("synthesisStatus").textContent = "Inquiry kept here for this session; this device could not save it.";
    }
  });
  renderSaved();
})();
