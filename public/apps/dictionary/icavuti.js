(() => {
  const $ = id => document.getElementById(id);
  const query = { province: $('icavuti-province'), district: $('icavuti-district'), village: $('icavuti-village') };
  const form = $('icavuti-form');
  const scopeInput = $('icavuti-form-scope');
  const fields = Object.fromEntries(['province', 'district', 'subdistrict', 'title', 'villages', 'note'].map(name => [name, $(`icavuti-form-${name}`)]));
  const communityEditor = $('icavuti-community-editor');
  const community = window.IcavutiCommunityEditor;
  community.mount(communityEditor, [], saveDraft);
  let records = [];
  let visibleLimit = 4;
  const norm = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const unique = values => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  function options(id, values) {
    const list = $(id);
    list.replaceChildren(...unique(values).map(value => { const option = document.createElement('option'); option.value = value; return option; }));
  }
  function matches(record) {
    return (!query.province.value || norm(record.province).includes(norm(query.province.value))) &&
      (!query.district.value || [record.district, record.subdistrict].some(value => norm(value).includes(norm(query.district.value)))) &&
      (!query.village.value || record.villages.some(value => norm(value).includes(norm(query.village.value))));
  }
  function chooseVillage(village) {
    query.village.value = village;
    visibleLimit = 4;
    render();
    $('icavuti-gap')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function syncScope() {
    const scope = scopeInput.value;
    fields.district.required = scope === 'tikina';
    fields.subdistrict.required = false;
    fields.villages.required = scope === 'koro';
    fields.district.closest('label').hidden = scope === 'yasana';
    fields.subdistrict.closest('label').hidden = scope === 'yasana';
    fields.villages.closest('label').hidden = scope === 'yasana';
    $('icavuti-village-label').textContent = scope === 'tikina' ? 'Koro in this tikina · one village per line (if known)' : 'Koro · Village';
    fields.villages.placeholder = scope === 'tikina' ? 'Village A\nVillage B' : 'Enter one village name';
    $('icavuti-scope-help').textContent = scope === 'yasana' ? 'A yasana icavuti belongs to the whole province.' : scope === 'tikina' ? 'A tikina icavuti belongs to the whole district. You may list its villages if known.' : 'A koro icavuti belongs to one village. The tikina fields help us place it, if you know them.';
  }
  function startCorrection(record) {
    $('icavuti-contribute').hidden = false;
    $('icavuti-kind').value = 'correction';
    $('icavuti-base-id').value = record.id;
    scopeInput.value = record.scope || 'tikina';
    for (const name of ['province', 'district', 'subdistrict', 'title']) fields[name].value = record[name] || '';
    fields.villages.value = record.villages.join('\n');
    community.reset(communityEditor, record.communityGroups || []);
    $('icavuti-community-form').open = !!record.communityGroups?.length;
    fields.note.value = '';
    syncScope();
    $('icavuti-contribute-title').textContent = `Correct this ${scopeInput.value} icavuti`;
    $('icavuti-form-status').textContent = 'Check the place and title, then explain the correction if you can.';
    saveDraft();
    $('icavuti-contribute').scrollIntoView({ block: 'start', behavior: 'smooth' });
    fields.title.focus();
  }
  function startAddition(record = null, village = '') {
    $('icavuti-contribute').hidden = false;
    form.reset();
    community.reset(communityEditor, []);
    $('icavuti-kind').value = 'addition';
    $('icavuti-base-id').value = '';
    scopeInput.value = 'koro';
    $('icavuti-community-form').open = false;
    if (record) {
      for (const name of ['province', 'district', 'subdistrict']) fields[name].value = record[name] || '';
    } else {
      fields.province.value = query.province.value;
      fields.district.value = query.district.value;
    }
    fields.villages.value = village || query.village.value;
    syncScope();
    $('icavuti-contribute-title').textContent = fields.villages.value ? `Add ${fields.villages.value}'s icavuti` : 'Add a koro icavuti';
    $('icavuti-form-status').textContent = '';
    saveDraft();
    $('icavuti-contribute').scrollIntoView({ block: 'start', behavior: 'smooth' });
    (fields.province.value && fields.villages.value ? fields.title : fields.province).focus();
  }
  function card(record) {
    const article = make('article', 'icavuti-card');
    const scope = record.scope || 'tikina';
    article.append(make('span', `icavuti-scope icavuti-scope-${scope}`, scope === 'yasana' ? 'Yasana icavuti · whole province' : scope === 'koro' ? 'Koro icavuti · village title' : 'Tikina icavuti · whole district'));
    const place = make('p', 'icavuti-place');
    for (const part of [record.province, record.district, record.subdistrict].filter((part, index, all) => part && (index === 0 || part !== all[index - 1]))) place.append(make('span', '', part));
    article.append(place, make('h4', '', record.title || `Title not recorded for this ${scope}`));
    if (record.otherTitles?.length) article.append(make('p', 'icavuti-alt', `Also listed: ${record.otherTitles.join(' · ')}`));
    const villageCount = record.villages.length;
    if (scope === 'koro') {
      article.append(make('p', 'icavuti-koro', `Koro: ${record.villages[0] || 'not specified'}`));
    } else if (scope === 'tikina' && villageCount) {
      const holder = make('details', 'icavuti-village-list');
      holder.append(make('summary', '', `Villages listed in this tikina (${villageCount})`));
      const villages = make('div', 'icavuti-villages');
      for (const village of record.villages) {
        const button = make('button', '', village);
        button.type = 'button';
        button.title = `Search for ${village}`;
        button.addEventListener('click', () => chooseVillage(village));
        villages.append(button);
      }
      holder.append(villages);
      article.append(holder);
      const selectedVillage = record.villages.find(village => norm(village) === norm(query.village.value));
      if (selectedVillage && !records.some(other => other.scope === 'koro' && norm(other.province) === norm(record.province) && other.villages.some(village => norm(village) === norm(selectedVillage)))) {
        const addVillage = make('button', 'icavuti-village-add', `Add ${selectedVillage}'s koro icavuti in ${record.province} ↗`);
        addVillage.type = 'button';
        addVillage.addEventListener('click', () => startAddition(record, selectedVillage));
        article.append(addVillage);
      }
    }
    if (record.communityGroups?.length) {
      const details = make('details', 'icavuti-community-details');
      details.append(make('summary', '', `Yavusa and family connections (${record.communityGroups.length})`));
      for (const group of record.communityGroups) {
        const section = make('section', 'icavuti-community-group');
        section.append(make('h5', '', group.yavusa || 'Yavusa name not supplied'));
        if (group.plant) section.append(make('p', '', `Plant: ${group.plant}`));
        if (group.animal) section.append(make('p', '', `Animal: ${group.animal}`));
        if (group.fish) section.append(make('p', '', `Fish: ${group.fish}`));
        for (const entry of group.mataqali || []) {
          const line = make('p', '', `Mataqali: ${entry.name || 'name not supplied'}`);
          if (entry.itokatoka?.length) line.append(make('span', '', ` · iTokatoka: ${entry.itokatoka.join(', ')}`));
          section.append(line);
        }
        details.append(section);
      }
      article.append(details);
    }
    const footer = make('div', 'icavuti-card-foot');
    footer.append(make('span', '', record.community ? 'Community contribution · reviewed' : `${record.source || 'A icavuti'} · p. ${record.page} · needs local confirmation`));
    const edit = make('button', '', 'Suggest a correction');
    edit.type = 'button'; edit.addEventListener('click', () => startCorrection(record));
    footer.append(edit); article.append(footer);
    return article;
  }
  function render() {
    const hasFilter = Object.values(query).some(input => input.value.trim());
    $('icavuti-browse-hint').hidden = hasFilter;
    document.querySelector('.icavuti-results-zone').hidden = !hasFilter;
    if (!hasFilter) {
      $('icavuti-results').replaceChildren();
      $('icavuti-more').hidden = true;
      $('icavuti-count').textContent = `${records.length} place records available. Choose a yasana or search for a tikina or koro to see them.`;
      $('icavuti-gap').hidden = true;
      document.querySelectorAll('#icavuti-province-chips button').forEach(button => button.setAttribute('aria-pressed', 'false'));
      return;
    }
    const direct = records.filter(matches);
    const relatedProvinces = new Set(direct.map(record => norm(record.province)));
    const filtered = records.filter(record => direct.includes(record) || ((query.district.value || query.village.value) && record.scope === 'yasana' && relatedProvinces.has(norm(record.province))));
    const scopeOrder = { yasana: 0, tikina: 1, koro: 2 };
    filtered.sort((a, b) => (scopeOrder[a.scope || 'tikina'] - scopeOrder[b.scope || 'tikina']) || `${a.province}|${a.district}|${a.title}`.localeCompare(`${b.province}|${b.district}|${b.title}`));
    const holder = $('icavuti-results');
    holder.replaceChildren();
    for (const record of filtered.slice(0, visibleLimit)) holder.append(card(record));
    if (!filtered.length) holder.append(make('p', 'icavuti-empty', 'No matching place yet. Try another spelling or add this koro below.'));
    const yasanaCount = filtered.filter(record => record.scope === 'yasana').length;
    const tikinaCount = filtered.filter(record => (record.scope || 'tikina') === 'tikina').length;
    const koroCount = filtered.filter(record => record.scope === 'koro').length;
    $('icavuti-count').textContent = `${yasanaCount} yasana · ${tikinaCount} tikina · ${koroCount} koro icavuti${filtered.length > visibleLimit ? ` · showing first ${visibleLimit}` : ''}`;
    const gap = $('icavuti-gap');
    gap.replaceChildren();
    const village = query.village.value.trim();
    const matchingProvinces = unique(filtered.filter(record => record.scope === 'tikina').map(record => record.province));
    if (village && !koroCount) {
      if (matchingProvinces.length > 1 && !query.province.value) {
        gap.append(make('strong', '', `${village} appears in more than one yasana.`), make('span', '', ' Choose a province or use the add link on the right tikina card.'));
      } else {
        gap.append(make('strong', '', `No koro icavuti recorded for ${village} yet.`), make('span', '', tikinaCount || yasanaCount ? ' The related titles belong to a wider tikina or yasana.' : ' You can help add the village title.'));
        const add = make('button', '', 'Add this koro’s icavuti ↗');
        add.type = 'button'; add.addEventListener('click', () => startAddition(filtered.find(record => record.scope === 'tikina') || filtered[0] || null, village)); gap.append(add);
      }
    }
    gap.hidden = !village || !!koroCount;
    $('icavuti-more').hidden = filtered.length <= visibleLimit;
    document.querySelectorAll('#icavuti-province-chips button').forEach(button => button.setAttribute('aria-pressed', String(query.province.value === button.textContent)));
  }
  function provinceChips() {
    const holder = $('icavuti-province-chips');
    holder.replaceChildren();
    for (const province of unique(records.map(record => record.province))) {
      const button = make('button', '', province);
      button.type = 'button';
      button.addEventListener('click', () => { query.province.value = province; visibleLimit = 4; render(); $('icavuti-results').scrollIntoView({ block: 'start', behavior: 'smooth' }); });
      holder.append(button);
    }
  }
  function saveDraft() {
    try {
      localStorage.setItem('naisema-icavuti-draft', JSON.stringify({ kind: $('icavuti-kind').value, scope: scopeInput.value, baseId: $('icavuti-base-id').value, ...Object.fromEntries(Object.entries(fields).map(([name, input]) => [name, input.value])), communityGroups: community.read(communityEditor) }));
    } catch { /* The online review route remains available without browser storage. */ }
  }
  function restoreDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem('naisema-icavuti-draft') || 'null');
      if (!draft) return;
      $('icavuti-kind').value = draft.kind === 'correction' ? 'correction' : 'addition';
      scopeInput.value = ['yasana', 'tikina', 'koro'].includes(draft.scope) ? draft.scope : 'koro';
      $('icavuti-base-id').value = draft.baseId || '';
      for (const [name, input] of Object.entries(fields)) input.value = draft[name] || '';
      community.reset(communityEditor, draft.communityGroups || []);
      $('icavuti-community-form').open = !!draft.communityGroups?.length;
      $('icavuti-contribute').hidden = !Object.values(fields).some(input => input.value.trim()) && !draft.communityGroups?.length && draft.kind !== 'correction';
      syncScope();
      if (draft.kind === 'correction') $('icavuti-contribute-title').textContent = `Correct this ${scopeInput.value} title`;
    } catch { /* Ignore an invalid local draft. */ }
  }
  async function load() {
    try {
      const baseResponse = await fetch('./icavuti-data.json?v=20261102-03', { cache: 'no-store' });
      if (!baseResponse.ok) throw new Error('Place list unavailable.');
      const base = await baseResponse.json();
      const byId = new Map(base.records.map(record => [record.id, { ...record, scope: record.scope || 'tikina' }]));
      records = [...byId.values()].sort((a, b) => `${a.province}|${a.district}|${a.subdistrict}|${a.title}`.localeCompare(`${b.province}|${b.district}|${b.subdistrict}|${b.title}`));
      options('icavuti-provinces', records.map(record => record.province));
      options('icavuti-districts', records.flatMap(record => [record.district, record.subdistrict]));
      options('icavuti-villages', records.flatMap(record => record.villages));
      provinceChips(); render();
    } catch (error) { $('icavuti-count').textContent = error.message; }
  }
  for (const input of Object.values(query)) input.addEventListener('input', () => { visibleLimit = 4; render(); });
  $('icavuti-clear').addEventListener('click', () => { for (const input of Object.values(query)) input.value = ''; visibleLimit = 4; render(); });
  $('icavuti-more').addEventListener('click', () => { visibleLimit += 4; render(); });
  $('icavuti-add').addEventListener('click', () => startAddition());
  $('icavuti-form-reset').addEventListener('click', () => startAddition());
  $('icavuti-form-close').addEventListener('click', () => { $('icavuti-contribute').hidden = true; });
  scopeInput.addEventListener('change', () => { syncScope(); saveDraft(); });
  form.addEventListener('input', saveDraft);
  // The form is sent to NAISEMA's icavuti form, with its privacy notice and Turnstile's check, and
  // arrives with the team as a Submission. Only what the form itself can't carry is added here.
  const communityText = groups => groups.filter(group => group.yavusa || group.plant || group.animal || group.fish || group.mataqali.some(entry => entry.name || entry.itokatoka.length)).map(group => [
    `Yavusa: ${group.yavusa || '(not named)'}`,
    ...(group.plant ? [`  Plant: ${group.plant}`] : []),
    ...(group.animal ? [`  Animal: ${group.animal}`] : []),
    ...(group.fish ? [`  Fish: ${group.fish}`] : []),
    ...group.mataqali.filter(entry => entry.name || entry.itokatoka.length).map(entry => `  Mataqali: ${entry.name || '(not named)'}${entry.itokatoka.length ? `; iTokatoka: ${entry.itokatoka.join(', ')}` : ''}`),
  ].join('\n')).join('\n');
  form.addEventListener('submit', event => {
    const status = $('icavuti-form-status');
    const scope = scopeInput.value;
    if (scope === 'yasana') fields.district.value = fields.subdistrict.value = fields.villages.value = '';
    if (scope === 'koro' && /[,\r\n]/.test(fields.villages.value.trim())) {
      event.preventDefault();
      status.textContent = 'Enter one koro (village) only.';
      fields.villages.focus();
      return;
    }
    if (scope === 'tikina') fields.villages.value = fields.villages.value.split(/[\r\n,]+/).map(name => name.trim()).filter(Boolean).join(', ');
    if (scope === 'yasana') fields.villages.value = '(the whole yasana)';
    const base = records.find(record => record.id === $('icavuti-base-id').value);
    $('icavuti-form-corrects').value = $('icavuti-kind').value === 'correction' && base ? `${base.title} · ${[base.province, base.district, base.subdistrict].filter(Boolean).join(' · ')} (${base.id})` : '';
    $('icavuti-form-community').value = communityText(community.read(communityEditor));
    try { localStorage.removeItem('naisema-icavuti-draft'); } catch { /* No local storage. */ }
    status.textContent = 'Sending for review…';
  });
  syncScope(); restoreDraft(); load();
})();
