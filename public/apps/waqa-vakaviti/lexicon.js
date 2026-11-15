(() => {
  "use strict";
  const rows = window.NAISEMA_DRUA_LEXICON || [];
  const visualNames = new Set((window.NAISEMA_DRUA_SCENES || []).flatMap(scene => scene.marks).map(mark => window.NAISEMA_DRUA_TERMS?.[mark.term]?.name.toLowerCase()).filter(Boolean));
  const search = document.getElementById("lexiconSearch");
  const results = document.getElementById("lexiconResults");
  const count = document.getElementById("lexiconCount");
  if (!search || !results || !count) return;

  function render() {
    const query = search.value.trim().toLocaleLowerCase();
    const matches = rows.filter(item => `${item.name} ${item.group} ${item.gloss}`.toLocaleLowerCase().includes(query));
    count.textContent = `${matches.length} of ${rows.length} research terms shown`;
    const cards = matches.map(item => {
      const card = document.createElement("article");
      card.className = "lexicon-card";
      const title = document.createElement("h3");
      title.lang = "fj";
      title.textContent = item.name;
      const gloss = document.createElement("p");
      gloss.textContent = item.gloss;
      const tag = document.createElement("small");
      const inVisual = item.name.toLowerCase().split("/").some(name => visualNames.has(name.trim().replace(/^ai /, "")));
      tag.className = inVisual ? "" : "pending";
      tag.textContent = inVisual ? `Ring · ${item.group}` : `Research bank · ${item.group}`;
      card.append(title,gloss,tag);
      return card;
    });
    results.replaceChildren(...cards);
  }
  search.addEventListener("input", render);
  render();
})();
