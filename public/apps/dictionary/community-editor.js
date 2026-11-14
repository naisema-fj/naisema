(() => {
  const editors = new WeakMap();
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  };
  function field(labelText, value, className, multiline = false) {
    const label = node('label', 'icavuti-community-field', labelText);
    const input = node(multiline ? 'textarea' : 'input', className);
    input.value = value || '';
    input.maxLength = multiline ? 2020 : ['community-yavusa', 'community-mataqali'].includes(className) ? 100 : 160;
    if (multiline) input.rows = 2;
    label.append(input);
    return label;
  }
  function read(host) {
    return [...host.querySelectorAll('.icavuti-yavusa-editor')].map(group => ({
      yavusa: group.querySelector('.community-yavusa').value.trim(),
      plant: group.querySelector('.community-plant').value.trim(),
      animal: group.querySelector('.community-animal').value.trim(),
      fish: group.querySelector('.community-fish').value.trim(),
      mataqali: [...group.querySelectorAll('.icavuti-mataqali-editor')].map(entry => ({
        name: entry.querySelector('.community-mataqali').value.trim(),
        itokatoka: entry.querySelector('.community-itokatoka').value.split(/\r?\n/).map(name => name.trim()).filter(Boolean),
      })),
    }));
  }
  function mount(host, initial = [], onChange = () => {}) {
    let groups = Array.isArray(initial) ? initial : [];
    let active = groups.length - 1;
    function update() { groups = read(host); onChange(); }
    function render() {
      host.replaceChildren();
      groups.forEach((group, index) => {
        const wrapper = node('details', 'icavuti-yavusa-editor');
        wrapper.open = index === active;
        const name = group.yavusa || `Yavusa ${index + 1}`;
        wrapper.append(node('summary', '', name));
        const body = node('div', 'icavuti-yavusa-body');
        body.append(field('Yavusa name · if known', group.yavusa, 'community-yavusa'));
        const pairs = node('div', 'icavuti-community-pairs');
        pairs.append(field('Plant name · neitou kau', group.plant, 'community-plant'), field('Animal name · neitou manumanu', group.animal, 'community-animal'), field('Fish name · keitou ika', group.fish, 'community-fish'));
        body.append(pairs);
        const mataqali = node('div', 'icavuti-mataqali-list');
        (group.mataqali || []).forEach((entry, entryIndex) => {
          const row = node('div', 'icavuti-mataqali-editor');
          row.append(field(`Mataqali ${entryIndex + 1} · if known`, entry.name, 'community-mataqali'));
          row.append(field('iTokatoka in this Mataqali · one name per line', (entry.itokatoka || []).join('\n'), 'community-itokatoka', true));
          const remove = node('button', 'icavuti-remove-line', 'Remove this Mataqali');
          remove.type = 'button';
          remove.addEventListener('click', () => { update(); groups[index].mataqali.splice(entryIndex, 1); active = index; render(); onChange(); });
          row.append(remove);
          mataqali.append(row);
        });
        body.append(mataqali);
        const addMataqali = node('button', 'icavuti-add-line', '+ Add a Mataqali');
        addMataqali.type = 'button';
        addMataqali.disabled = (group.mataqali || []).length >= 20;
        addMataqali.addEventListener('click', () => { update(); groups[index].mataqali.push({ name: '', itokatoka: [] }); active = index; render(); onChange(); });
        body.append(addMataqali);
        const removeGroup = node('button', 'icavuti-remove-line', 'Remove this Yavusa group');
        removeGroup.type = 'button';
        removeGroup.addEventListener('click', () => { update(); groups.splice(index, 1); active = Math.min(index, groups.length - 1); render(); onChange(); });
        body.append(removeGroup);
        wrapper.append(body);
        wrapper.addEventListener('input', () => {
          update();
          wrapper.querySelector('summary').textContent = wrapper.querySelector('.community-yavusa').value.trim() || `Yavusa ${index + 1}`;
        });
        host.append(wrapper);
      });
      const add = node('button', 'icavuti-add-line', '+ Add a Yavusa');
      add.type = 'button';
      add.disabled = groups.length >= 12;
      add.addEventListener('click', () => { update(); groups.push({ yavusa: '', plant: '', animal: '', fish: '', mataqali: [] }); active = groups.length - 1; render(); onChange(); host.querySelector('.icavuti-yavusa-editor:last-of-type .community-yavusa')?.focus(); });
      host.append(add);
    }
    render();
    editors.set(host, { reset: next => { groups = Array.isArray(next) ? next : []; active = groups.length - 1; render(); }, read: () => read(host) });
  }
  window.IcavutiCommunityEditor = { mount, read: host => editors.get(host)?.read() || [], reset: (host, groups) => editors.get(host)?.reset(groups) };
})();
