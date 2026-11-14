'use strict';

(() => {
  const engine = window.ForgeRosterCombat;
  const root = document.createElement('section');
  root.id = 'frCombat';
  root.hidden = true;
  root.innerHTML = `
    <header><div><h2>Combat calculator</h2><small>Shooting and Fight phase · Warhammer 40,000 11th edition</small></div>
    <div class="combat-actions"><button data-act="example">Load example</button><button data-act="theme">Light theme</button></div></header>
    <div class="combat-grid">
      <section><h3>Attack profile</h3><div id="combat-offence" class="combat-fields"></div>
        <label>Attacking unit<select id="combat-attacker"></select></label>
        <label>Datasheet weapon<select id="combat-weapon"></select></label>
        <p id="combat-equipment" class="combat-note"></p>
        <details><summary>Weapon keywords <span id="combat-count"></span></summary>
          <label>Search keywords<input id="combat-key-search" type="search"></label>
          <div id="combat-key-options" class="combat-options"></div>
          <div id="combat-tags" class="combat-actions"></div>
          <button data-act="reset-keywords">Reset to Datasheet</button>
        </details>
      </section>
      <section><h3>Target</h3><label>Defending unit<select id="combat-defender"></select></label>
        <label id="combat-profile-label" hidden>Defending model profile<select id="combat-model-profile"></select></label>
        <div id="combat-defence" class="combat-fields"></div>
      </section>
    </div>
    <details><summary>Modifiers & abilities</summary>
      <div id="combat-conditions" class="combat-fields"></div>
      <div id="combat-modifiers" class="combat-fields"></div>
      <button data-act="reset-modifiers">Reset modifiers</button>
      <details><summary>Abilities and rules from selected units</summary><div id="combat-context"></div></details>
    </details>
    <details><summary>Multiple weapons, target comparison & saved scenarios</summary>
      <div class="combat-actions"><button data-act="target-a">Edit target A</button><button data-act="target-b">Edit target B</button>
      <button data-act="queue">Queue current weapon against this target</button><button data-act="clear">Clear queue</button></div>
      <p id="combat-target-label" class="combat-note"></p><div id="combat-queue"></div>
      <p class="combat-note">Queued profiles resolve in listed order. Confirm weapons per bearer, alternative profiles, melee allocation and equipment against the datasheet.</p>
      <div class="combat-actions"><label>Scenario name<input id="combat-name" maxlength="80"></label><button data-act="save">Save scenario</button>
      <label>Saved scenarios<select id="combat-scenarios"></select></label><button data-act="load">Load scenario</button></div>
      <p id="combat-scenario-status" role="status"></p>
    </details>
    <section><h3>Results</h3><div class="combat-actions"><button data-act="probability" aria-pressed="true">Probability</button>
      <button data-act="live" aria-pressed="false">Live dice</button><button data-act="copy">Copy results</button><button data-act="export">Export text</button></div>
      <p id="combat-error" role="status"></p><div id="combat-results"></div>
      <details id="combat-mc"><summary>Monte Carlo settings</summary>
        <div class="combat-fields"><label>Samples<input id="combat-samples" type="number" min="100" max="50000" value="2000"></label>
        <label>Seed<input id="combat-seed" type="number" value="42"></label></div>
        <button data-act="simulate">Run seeded simulation</button>
      </details>
    </section>
    <p class="combat-note"><a href="${engine.source.url}" target="_blank" rel="noopener noreferrer">${engine.source.name}</a>
    · Attack sequence, shooting types, terrain, core abilities and rules appendix.</p>`;
  document.querySelector('main').before(root);
  const $ = id => root.querySelector('#combat-' + id);
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text != null) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const action = (name, label) => { const b = el('button', label); b.dataset.act = name; return b; };
  const offence = [
    ['phase', 'Phase', [['ranged', 'Shooting'], ['melee', 'Fight']]],
    ['models', 'Attacking models'], ['copies', 'Weapons per attacking model'],
    ['attacks', 'Attacks per weapon', 'text'], ['skill', 'Ballistic / Weapon Skill', 'text'], ['strength', 'Strength'],
    ['ap', 'Armour Penetration'], ['damage', 'Damage', 'text'],
  ];
  const defence = [
    ['targets', 'Remaining models'], ['toughness', 'Toughness'], ['save', 'Armour save (7 = none)'], ['inv', 'Invulnerable save (0 = none)'],
    ['wounds', 'Wounds per model'], ['firstWounds', 'First model wounds remaining (blank = full)'], ['fnp', 'Feel No Pain (0 = none)'],
    ['targetKeywords', 'Target keywords, comma-separated', 'text'],
  ];
  const when = (ph, ...keywords) => c => c.phase === ph && (!keywords.length || keywords.some(k => c.keywords.some(x => x.name === k)));
  const conditions = [
    ['range', 'Weapon range (inches)', 'decimal', when('ranged')], ['distance', 'Distance to target (inches)', 'decimal', when('ranged')],
    ['visible', 'Target visible', 'check', when('ranged')], ['cover', 'Target has cover', 'check', when('ranged')],
    ['stealth', 'All target models have Stealth', 'check', when('ranged')],
    ['engaged', 'Attacking unit is engaged', 'check', when('ranged')], ['vehicle', 'Shooting model is a Vehicle / Monster', 'check', when('ranged')],
    ['advanced', 'Attacking unit Advanced', 'check', when('ranged')], ['fellBack', 'Attacking unit Fell Back', 'check', when('ranged')], ['targetEngaged', 'Target is engaged with a friendly unit', 'check', when('ranged')],
    ['targetVehicle', 'Target is an eligible Vehicle / Monster', 'check', when('ranged')],
    ['engagingTarget', 'Target is engaging the attacker', 'check', when('ranged')],
    ['indirect', 'Choose indirect shooting', 'check', when('ranged', 'Indirect Fire')],
    ['stationary', 'Attacking unit remained stationary', 'check', when('ranged', 'Indirect Fire')],
    ['spotter', 'Another friendly unit can see target', 'check', when('ranged', 'Indirect Fire')],
    ['movedKnown', 'Movement distance confirmed', 'check', when('ranged', 'Heavy')],
    ['moved', 'Furthest model moved (inches)', 'decimal', when('ranged', 'Heavy')],
    ['entered', 'Unit entered the battlefield this turn', 'check', when('ranged', 'Heavy')],
    ['inShootingPhase', 'In your Shooting phase', 'check', when('ranged')],
    ['charged', 'Attacker made a Charge move', 'check', when('melee', 'Lance')],
    ['split', 'Attacks split across targets', 'check', when('melee')],
    ['targetStart', 'Models at Select Targets (blank = current)', 'number', c => c.keywords.some(k => ['Blast', 'Cleave'].includes(k.name))],
    ['hazardVehicle', 'Every attacker is a Vehicle / Monster', 'check', c => c.keywords.some(k => k.name === 'Hazardous')],
    ['used', 'One Shot has already been used', 'check', c => c.keywords.some(k => k.name === 'One Shot')],
    ['ignoreSkill', 'Psychic · ignore BS / WS modifiers', 'check', c => c.keywords.some(k => k.name === 'Psychic')],
    ['ignoreHit', 'Psychic · ignore hit roll modifiers', 'check', c => c.keywords.some(k => k.name === 'Psychic')],
    ['skipLethal', 'Roll wounds instead of using Lethal Hits', 'check', c => c.keywords.some(k => k.name === 'Lethal Hits')],
  ];
  const rerolls = [['', 'None'], ['ones', '1s'], ['failures', 'Failures only'], ['all', 'Any die (probability rerolls failures)']];
  const modifiers = [
    ['hitMod', 'Attacker hit roll modifier'], ['defHit', 'Defender hit roll modifier'], ['skillMod', 'BS / WS change (+ worsens)'],
    ['woundMod', 'Attacker wound roll modifier'], ['defWound', 'Defender wound roll modifier'], ['saveMod', 'Improve armour save by'],
    ['hitReroll', 'Hit rerolls', rerolls], ['woundReroll', 'Wound rerolls', rerolls],
    ['critHit', 'Natural critical hit threshold (default 6)'], ['critWound', 'Natural critical wound threshold (default 6)'],
    ['strengthMod', 'Strength change'], ['toughnessMod', 'Toughness change'], ['apMod', 'AP change (+ worsens)'],
    ['attackMod', 'Attacks change'], ['damageMod', 'Damage change'], ['reduce', 'Reduce Damage characteristic by'],
    ['prevent', 'Prevent wounds per damage packet'], ['note', 'Custom rule / stratagem explanation', 'text'],
  ];
  const targetFields = new Set(defence.map(row => row[0]).concat(['distance', 'visible', 'cover', 'stealth', 'targetEngaged', 'targetVehicle', 'engagingTarget', 'targetStart', 'defHit', 'defWound', 'saveMod', 'reduce', 'prevent', 'toughnessMod']));
  const modifierKeys = modifiers.map(row => row[0]).concat(conditions.map(row => row[0]));
  const fields = new Map();
  function controls(id, rows) {
    for (const [key, label, kind = 'number', show] of rows) {
      const wrap = el('label', label);
      const control = el(Array.isArray(kind) ? 'select' : 'input');
      if (Array.isArray(kind)) for (const [v, label] of kind) control.add(new Option(label, v));
      else if (kind === 'check') { control.type = 'checkbox'; wrap.className = 'combat-check'; }
      else { control.type = kind === 'decimal' ? 'number' : kind; control.step = kind === 'decimal' ? 'any' : '1'; }
      control.oninput = () => {
        if (key === 'phase') selectWeapons(true);
        updateConditions();
        resetRoll();
        render();
      };
      wrap.append(control);
      $(id).append(wrap);
      fields.set(key, { wrap, control, show });
    }
  }
  controls('offence', offence);
  controls('defence', defence);
  controls('conditions', conditions);
  controls('modifiers', modifiers);
  const clone = value => JSON.parse(JSON.stringify(value));
  const clean = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const example = () => clone(engine.example);
  let currentKeywords = [], originalKeywords = [], targetSlot = 'A', targets = { A: {}, B: {} };
  let queue = [], mode = 'probability', roll = null, rollIndex = 0, rollQueue = [], liveStates = {}, completedRolls = [], report = '';
  let account = null, cloudScenarios = [], rosterChoices = [], catalog = null, requestedEntry = null, profileTarget = null;
  let pending = 0;

  function read() {
    const obj = { keywords: clone(currentKeywords) };
    for (const [key, { control }] of fields) {
      obj[key] = control.type === 'checkbox' ? control.checked :
        control.type === 'number' && control.value !== '' ? Number(control.value) : key === 'skill' ? control.value.replace(/\+$/, '') : control.value;
    }
    obj.useLethal = !obj.skipLethal;
    return obj;
  }
  function fill(data, keys = Object.keys(data)) {
    for (const key of keys) {
      const node = fields.get(key)?.control;
      if (!node) continue;
      if (node.type === 'checkbox') node.checked = Boolean(data[key]);
      else node.value = data[key] ?? '';
    }
  }
  function setConfig(data) {
    fill({ ...example(), ...data }, [...fields.keys()]);
    currentKeywords = clone(data.keywords || []);
    renderKeywords();
    updateConditions();
  }
  function updateConditions() {
    const cfg = read();
    for (const { wrap, show } of fields.values()) if (show) wrap.hidden = !show(cfg);
    fields.get('skill').wrap.firstChild.textContent = cfg.phase === 'melee' ? 'Weapon Skill' : 'Ballistic Skill';
    $('target-label').textContent = 'Editing target ' + targetSlot + (targetSlot === 'B' ? ' for comparison or split fire.' : '.');
  }
  function renderKeywords() {
    const filter = $('key-search').value.toLowerCase();
    const phase = fields.get('phase').control.value;
    $('key-options').replaceChildren();
    for (const [name, [kind, value]] of Object.entries(engine.definitions)) {
      if (kind !== 'both' && kind !== phase || !name.toLowerCase().includes(filter)) continue;
      const label = el('label', name, 'combat-check');
      const check = el('input');
      check.type = 'checkbox';
      check.checked = currentKeywords.some(k => k.name === name);
      check.onchange = () => {
        if (check.checked) currentKeywords.push({ name, value });
        else currentKeywords = currentKeywords.filter(k => k.name !== name);
        changeKeywords();
      };
      label.append(check);
      $('key-options').append(label);
    }
    $('tags').replaceChildren();
    for (const [index, k] of currentKeywords.entries()) {
      const tag = el('div', null, 'combat-tag');
      const definition = engine.definitions[k.name];
      const remove = el('button', k.name + ' ×');
      remove.setAttribute('aria-label', 'Remove ' + k.name);
      remove.onclick = () => { currentKeywords.splice(index, 1); changeKeywords(); };
      tag.append(remove);
      if (definition?.[1] !== undefined) {
        const value = el('input');
        value.value = k.value ?? '';
        value.setAttribute('aria-label', k.name + ' value');
        value.oninput = () => { k.value = value.value; resetRoll(); render(); };
        tag.append(value);
      }
      if (k.name === 'Anti') {
        const word = el('input');
        word.value = k.target || '';
        word.placeholder = 'Target keyword';
        word.setAttribute('aria-label', 'Anti target keyword');
        word.oninput = () => { k.target = word.value; resetRoll(); render(); };
        tag.append(word);
      }
      $('tags').append(tag);
    }
    $('count').textContent = '(' + currentKeywords.length + ')';
  }
  function changeKeywords() { renderKeywords(); updateConditions(); resetRoll(); render(); }
  $('key-search').oninput = renderKeywords;

  async function catalogue() {
    if (!catalog) catalog = fetch('./data/mfm.json').then(r => {
      if (!r.ok) throw Error('Datasheet catalogue is unavailable.');
      return r.json();
    }).catch(error => { catalog = null; throw error; });
    return catalog;
  }
  function unitProfile(faction, name) {
    const f = rosterChoices.catalogue?.factions.find(entry => clean(entry.name) === clean(faction));
    return f?.units.find(entry => clean(entry.name) === clean(name));
  }
  function options(node, placeholder, choices, previous) {
    node.replaceChildren(new Option(placeholder, ''));
    for (const [value, prompt] of choices) node.add(new Option(prompt, value));
    node.value = previous || '';
    if (node.selectedIndex === -1) node.value = '';
  }
  function selected(id) {
    const value = $(id).value;
    return value ? rosterChoices.find(entry => entry.id === value) : null;
  }
  async function refreshRosters() {
    if (root.hidden) return;
    const token = ++pending;
    const active = window.frRosterStorage.read();
    const cloud = window.frCombatRosterLibrary?.() || [];
    const attackers = $('attacker').value, defenders = $('defender').value;
    try {
      const data = await catalogue();
      if (token !== pending) return;
      const choices = [];
      const groups = [...(active?.units?.length ? [['active', active]] : []), ...cloud];
      for (const [id, roster] of groups) for (const [index, unit] of roster.units.entries()) {
        choices.push({ id: id + ':' + index, roster, unit, profile: data.factions
          .find(f => clean(f.name) === clean(roster.faction))?.units.find(u => clean(u.name) === clean(unit.name)) });
      }
      choices.catalogue = data;
      rosterChoices = choices;
      const rows = choices.map(({ id, roster, unit }) => [id, roster.name + ' · ' + unit.name]);
      options($('attacker'), 'Manual attack profile', rows, attackers);
      options($('defender'), 'Manual target profile', rows, defenders);
      if (requestedEntry) {
        const { faction, name, weapon, id } = requestedEntry;
        const match = choices.find(item => item.id.startsWith('active:') &&
          (id ? item.unit.id === id : clean(item.unit.name) === clean(name)));
        const profile = match?.profile || unitProfile(faction, name);
        if (match && profile) {
          $('attacker').value = match.id;
          attachSource(match, weapon);
        } else if (profile) attachSource({ profile, unit: { name, models: 1 }, roster: { faction } }, weapon);
        else $('error').textContent = 'This unit has no combat profile in the deployed catalogue.';
        requestedEntry = null;
      } else renderContext();
    } catch (error) { if (token === pending) $('equipment').textContent = error.message; }
  }
  function addContext(section, name, text) {
    if (!text) return;
    const detail = el('details');
    detail.append(el('summary', name), el('p', text));
    section.append(detail);
  }
  let sourceUnit = null;
  function renderContext() {
    const output = $('context');
    output.replaceChildren();
    const packs = window.ForgeRosterRules?.getPacks() || [];
    for (const [side, record] of [['Attacker', sourceUnit], ['Defender', selected('defender')]]) {
      if (!record) continue;
      const { roster, unit, profile } = record;
      output.append(el('h4', side + ' · ' + unit.name));
      const attached = (roster.units || []).filter(other => other.attachedTo && other.attachedTo === unit.id || other.id && unit.attachedTo === other.id);
      const names = [unit.name, ...attached.map(other => other.name)];
      const abilities = [...(profile?.abilityNames || []), ...attached.flatMap(other => unitProfile(roster.faction, other.name)?.abilityNames || [])];
      if (abilities.length) output.append(el('p', 'Datasheet and attached-unit abilities · ' + abilities.join(' · ')));
      const detachments = roster.detachments || [roster.detachment];
      const enhancements = (roster.enhancements || []).filter(e => names.some(name => e.unitId && roster.units?.some(u => u.id === e.unitId && u.name === name)));
      const entries = packs.flatMap(pack => pack.entries).filter(entry => clean(entry.faction) === clean(roster.faction) && (
        names.some(name => clean(name) === clean(entry.unit)) || entry.kind === 'faction-rule' ||
        detachments.some(name => name && clean(name) === clean(entry.detachment)) ||
        enhancements.some(item => clean(item.name) === clean(entry.name))));
      for (const entry of entries) addContext(output, entry.name, entry.text);
    }
    output.append(el('p', 'Use the numeric modifiers above after confirming these rules apply. Listed faction, Leader, enhancement and stratagem text does not change the calculation automatically.', 'combat-note'));
  }
  function attachSource(record, requestedWeapon) {
    sourceUnit = record;
    const equipped = (record?.unit.wargear || []).map(w => typeof w === 'string' ? w : w.item);
    $('equipment').textContent = !record ? '' : equipped.length ?
      'Saved equipment: ' + equipped.join(', ') + '. Confirm the selected profile and number of bearers.' :
      'Confirm the equipped profile and number of bearers. This catalog does not encode default and replacement loadouts.';
    if (record) fill({ models: record.unit.models || 1, copies: 1 });
    if (record?.profile?.keywords) {
      const vehicle = record.profile.keywords.some(tag => ['vehicle', 'monster'].includes(clean(tag)));
      fill({ vehicle, hazardVehicle: vehicle });
    }
    if (requestedWeapon) {
      const matching = record?.profile?.weapons?.find(w => clean(w.name) === clean(requestedWeapon));
      if (matching) fill({ phase: matching.kind });
    }
    selectWeapons(true, requestedWeapon);
    renderContext();
  }
  function selectWeapons(auto, desired) {
    const phase = fields.get('phase').control.value;
    const selectedWeapon = $('weapon').value;
    const gear = new Set((sourceUnit?.unit.wargear || []).map(w => clean(typeof w === 'string' ? w : w.item)));
    const weapons = sourceUnit?.profile?.weapons || [];
    const rows = weapons.flatMap((w, i) => w.kind === phase ? [[String(i), w.name + (gear.has(clean(w.name)) ? ' · selected wargear' : '')]] : []);
    const chosen = desired ? weapons.findIndex(w => w.kind === phase && clean(w.name) === clean(desired)) : -1;
    const defaultWeapon = rows.find(([i]) => gear.has(clean(weapons[i].name)));
    options($('weapon'), 'Manual weapon profile', rows, chosen >= 0 ? String(chosen) :
      auto ? defaultWeapon?.[0] || rows[0]?.[0] : selectedWeapon);
    if ($('weapon').value) applyWeapon();
    else { originalKeywords = []; renderKeywords(); }
  }
  function applyWeapon() {
    const weapon = sourceUnit?.profile?.weapons?.[Number($('weapon').value)];
    if ($('weapon').value === '' || !weapon) { originalKeywords = []; return; }
    const num = text => /^-?\d+/.test(String(text)) ? Number(String(text).match(/^-?\d+/)[0]) : '';
    const range = num(weapon.range);
    fill({ attacks: weapon.a, skill: weapon.skill === '-' ? '-' : num(weapon.skill),
      strength: num(weapon.s), ap: num(weapon.ap), damage: weapon.d, range });
    originalKeywords = (weapon.keywords || []).map(engine.keyword);
    currentKeywords = clone(originalKeywords);
    if (['strength', 'ap', 'range'].some(k => fields.get(k).control.value === '' && (k !== 'range' || weapon.kind === 'ranged'))) {
      $('equipment').textContent += ' This profile has a conditional characteristic. Enter the applicable value before calculating.';
    }
    changeKeywords();
  }
  $('attacker').onchange = () => { attachSource(selected('attacker')); resetRoll(); render(); };
  $('weapon').onchange = () => { applyWeapon(); resetRoll(); render(); };
  $('defender').onchange = () => {
    const record = selected('defender');
    profileTarget = record;
    options($('model-profile'), 'Choose target profile', (record?.profile?.stats || []).map((p, i) => [String(i), p.name || record.unit.name]), '0');
    $('model-profile').parentElement.hidden = (record?.profile?.stats?.length || 0) < 2;
    if (record) applyTarget();
    else { resetRoll(); render(); }
    renderContext();
  };
  function applyTarget() {
    const record = profileTarget;
    const p = record?.profile?.stats?.[Number($('model-profile').value)];
    const threshold = v => /^\d\+?$/.test(String(v)) ? Number(String(v)[0]) : 0;
    if (p) {
      fill({ toughness: Number(p.t), save: threshold(p.sv) || 7, inv: threshold(p.inv),
        wounds: Number(p.w), firstWounds: '', targets: record.unit.models || 1, fnp: 0,
        targetKeywords: record.profile.keywords?.join(', ') || '',
        targetVehicle: record.profile.keywords?.some(tag => ['vehicle', 'monster'].includes(clean(tag))) });
    } else $('error').textContent = 'Enter target characteristics manually for this unit.';
    resetRoll();
    render();
  }
  $('model-profile').onchange = applyTarget;
  function captureTarget() {
    targets[targetSlot] = Object.fromEntries(Object.entries(read()).filter(([k]) => targetFields.has(k)));
  }
  function plans() {
    captureTarget();
    if (!queue.length) return [{ slot: targetSlot, label: 'Current weapon', plan: engine.compile(read()) }];
    return queue.map(({ slot, config, label }) => ({
      slot, label, plan: engine.compile({ ...config, ...targets[slot] }),
    }));
  }
  function resetRoll() { roll = null; rollQueue = []; liveStates = {}; completedRolls = []; }
  const fmt = value => Number.isFinite(value) ? value.toFixed(2) : '—';
  const pct = value => Number.isFinite(value) ? (value * 100).toFixed(2) + '%' : '—';
  const threshold = (value, fallback = 'Impossible') => value > 6 ? fallback : value + '+';
  function stat(container, pairs) {
    const list = el('dl', null, 'combat-stats');
    for (const [label, value] of pairs) {
      const group = el('div');
      group.append(el('dt', label), el('dd', value));
      list.append(group);
    }
    container.append(list);
  }
  function distribution(parent, label, dist) {
    if (!dist) return;
    const details = el('details'), chart = el('div');
    details.append(el('summary', label), chart);
    for (const [n, chance] of [...dist].sort((a, b) => a[0] - b[0])) {
      if (chance < .000001) continue;
      const row = el('div', null, 'combat-bar');
      const bar = el('span');
      bar.style.setProperty('--chance', (chance * 100).toFixed(5) + '%');
      row.append(el('span', String(n)), bar, el('span', pct(chance)));
      chart.append(row);
    }
    parent.append(details);
  }
  function preview(parent, entries, simulation) {
    const groups = Map.groupBy ? Map.groupBy(entries, e => e.slot) :
      new Map(['A', 'B'].map(slot => [slot, entries.filter(e => e.slot === slot)]).filter(([, group]) => group.length));
    const lines = [];
    for (const [slot, group] of groups) {
      const panel = el('div', null, 'combat-target-result');
      panel.append(el('h4', 'Target ' + slot));
      let state, result;
      const summaries = [];
      for (const { plan, label } of group) {
        result = engine.calculate(plan, state);
        summaries.push([plan, label, result]);
        state = result.state;
      }
      if (simulation || summaries.some(([, , r]) => r.tooComplex)) {
        const count = Number($('samples').value), seed = Number($('seed').value);
        try { result = engine.simulate(group.map(e => e.plan), count, seed); }
        catch (error) { panel.append(el('p', error.message)); result = { method: 'Exact expected rolls only' }; }
      }
      panel.append(el('p', result.method));
      stat(panel, [
        ['Destroy target', pct(result.destroyed)], ['Expected wounds lost', fmt(result.appliedDamage)],
        ['Expected models destroyed', fmt(result.expectedKills)], ['Expected wounds remaining', fmt(result.remaining)],
      ]);
      distribution(panel, 'Damage probability distribution', result.damage);
      distribution(panel, 'Destroyed model probability distribution', result.casualties);
      lines.push('Target ' + slot + ' · ' + result.method + ' · destroyed ' + pct(result.destroyed) + ' · expected wounds lost ' + fmt(result.appliedDamage));
      for (const [plan, label, stats] of summaries) {
        const detail = el('details');
        detail.open = summaries.length === 1;
        detail.append(el('summary', label + ' · attack sequence'));
        stat(detail, [
          ['Attacks', fmt(stats.attacks)], ['Hits · ' + (plan.torrent ? 'automatic' : threshold(plan.hitNeeded)), fmt(stats.hits)],
          ['Critical hits', fmt(stats.criticalHits)], ['Wounds · ' + threshold(plan.woundNeeded), fmt(stats.wounds)],
          ['Critical wounds', fmt(stats.criticalWounds)],
          ['Failed saves · ' + threshold(plan.save, 'No save'), fmt(stats.failedSaves)],
          ['Unsaved damage before overkill', fmt(stats.rawDamage)],
          ['Expected Hazardous self mortal wounds', fmt(stats.expectedHazard)],
        ]);
        if (plan.inv && plan.save !== plan.armour) detail.append(el('p', 'Armour ' + threshold(plan.armour, 'No armour save') + ' · invulnerable save applies.'));
        for (const text of [...plan.effects, ...plan.warnings]) detail.append(el('p', text, 'combat-note'));
        lines.push(label + ' · attacks ' + fmt(stats.attacks) + ' · hits ' + fmt(stats.hits) +
          ' · wounds ' + fmt(stats.wounds) + ' · failed saves ' + fmt(stats.failedSaves) + ' · unsaved damage ' + fmt(stats.rawDamage),
          ...plan.effects, ...plan.warnings);
        panel.append(detail);
      }
      parent.append(panel);
    }
    return lines.join('\n');
  }
  function drawQueue() {
    $('queue').replaceChildren();
    for (const [index, entry] of queue.entries()) {
      const line = el('div', null, 'combat-actions');
      line.append(el('span', (index + 1) + '. ' + entry.label + ' → target ' + entry.slot));
      const remove = el('button', 'Remove');
      remove.onclick = () => { queue.splice(index, 1); resetRoll(); render(); };
      line.append(remove);
      $('queue').append(line);
    }
  }
  const formatRoll = entry => entry.label + ' · ' + entry.values.join(', ');
  function paintLive(parent, entries) {
    if (!roll) {
      rollIndex = 0;
      rollQueue = entries;
      roll = engine.live(entries[0].plan);
    }
    const active = rollQueue[rollIndex];
    parent.append(el('h4', active.label + ' → target ' + active.slot));
    stat(parent, [
      ['Hit target', active.plan.torrent ? 'Automatic' : threshold(active.plan.hitNeeded)],
      ['Wound target', threshold(active.plan.woundNeeded)], ['Save target', threshold(active.plan.save, 'No save')],
      ...Object.entries(roll.totals).map(([k, v]) => [k, v]),
      ['Wounds removed', roll.result.damage], ['Models destroyed', roll.result.kills],
      ['Hazardous self mortal wounds', roll.result.hazard],
    ]);
    const toolbar = el('div', null, 'combat-actions');
    if (roll.action) toolbar.append(action('next', roll.action), action('finish', 'Roll entire attack sequence'));
    else if (rollIndex + 1 < rollQueue.length) toolbar.append(action('next-weapon', 'Resolve next weapon'));
    toolbar.append(action('new-roll', 'New roll'));
    parent.append(toolbar);
    const dice = el('div', null, 'combat-dice');
    const checked = [];
    for (const [index, d] of roll.dice.entries()) {
      const label = el('label', d.face, 'combat-die d' + d.outcome);
      if (d.eligible) {
        const check = el('input');
        check.type = 'checkbox';
        check.checked = !d.outcome;
        check.setAttribute('aria-label', 'Reroll die ' + (index + 1) + ' showing ' + d.face);
        label.append(check);
        checked.push([index, check]);
      }
      dice.append(label);
    }
    if (checked.length) {
      const button = el('button', roll.stage === 1 ? 'Reroll selected hits' : 'Reroll selected wounds');
      button.onclick = () => { roll.reroll(checked.filter(([, n]) => n.checked).map(([i]) => i)); render(); };
      parent.append(button);
    }
    parent.append(dice);
    for (const text of [...active.plan.effects, ...active.plan.warnings]) parent.append(el('p', text, 'combat-note'));
    for (const [slot, hp] of Object.entries(liveStates)) {
      parent.append(el('p', 'Target ' + slot + ' · ' + hp + ' wounds remaining after previous weapon profiles.'));
    }
    const history = el('details');
    history.open = true;
    history.append(el('summary', 'Roll history'));
    const rows = [...completedRolls.flatMap(item => [item.label, ...item.history.map(formatRoll)]),
      ...roll.history.map(formatRoll)];
    for (const row of rows) history.append(el('p', row));
    parent.append(history);
    return rows.join('\n');
  }

  function render(simulation = false) {
    drawQueue();
    $('error').textContent = '';
    $('results').replaceChildren();
    try {
      const entries = plans();
      report = mode === 'live' ? paintLive($('results'), entries) : preview($('results'), entries, simulation);
    } catch (error) { report = ''; $('error').textContent = error.message; }
  }
  const deviceKey = 'fr-combat-device-scenarios-v1';
  function guestScenarios() {
    try { return JSON.parse(localStorage.getItem(deviceKey) || '[]'); } catch { return []; }
  }
  function scenarios() { return account ? cloudScenarios : guestScenarios(); }
  function scenarioOptions() { options($('scenarios'), 'Choose a scenario', scenarios().map(x => [x.id, x.name]), $('scenarios').value); }
  const status = message => { $('scenario-status').textContent = message; };
  async function loadScenarios(state = account) {
    if (!state) { scenarioOptions(); return; }
    const { data, error } = await state.client.from('combat_scenarios')
      .select('id,name,scenario').eq('user_id', state.user.id).order('created_at', { ascending: false }).limit(100);
    if (state !== account) return;
    if (error) { status('Cloud scenarios unavailable. See the Supabase combat migration.'); return; }
    cloudScenarios = data || [];
    scenarioOptions();
    status('');
  }
  function clearScenario() {
    sourceUnit = null; profileTarget = null; requestedEntry = null;
    queue = []; targetSlot = 'A'; targets = { A: {}, B: {} }; originalKeywords = [];
    options($('weapon'), 'Manual weapon profile', []);
    $('attacker').value = ''; $('defender').value = '';
    $('model-profile').parentElement.hidden = true;
    $('equipment').textContent = '';
    $('name').value = '';
    setConfig(example());
    resetRoll();
    renderContext();
    render();
  }
  async function saveScenario() {
    const name = $('name').value.trim();
    if (!name) throw Error('Enter a scenario name.');
    captureTarget();
    const scenario = { schemaVersion: 1, config: read(), queue: clone(queue), targets: clone(targets), targetSlot };
    const state = account;
    if (state) {
      const { error } = await state.client.from('combat_scenarios').insert({ user_id: state.user.id, name, scenario });
      if (state !== account) return;
      if (error) throw Error('Could not save to your account. Apply the combat scenario migration and try again.');
      await loadScenarios(state);
      status('Saved to your account.');
    } else {
      localStorage.setItem(deviceKey, JSON.stringify([{ id: crypto.randomUUID(), name, scenario }, ...guestScenarios()].slice(0, 100)));
      scenarioOptions();
      status('Saved on this device.');
    }
  }
  const handlers = {
    example: clearScenario,
    theme() { root.classList.toggle('combat-light'); root.querySelector('[data-act=theme]').textContent = root.classList.contains('combat-light') ? 'Dark theme' : 'Light theme'; },
    'reset-keywords'() { currentKeywords = clone(originalKeywords); changeKeywords(); },
    'reset-modifiers'() { fill(example(), modifierKeys); resetRoll(); updateConditions(); render(); },
    'target-a'() { switchTarget('A'); },
    'target-b'() { switchTarget('B'); },
    queue() {
      const config = read();
      engine.compile(config);
      if (queue.length >= 12) throw Error('Queue up to 12 profiles.');
      const weapon = $('weapon').selectedOptions[0];
      const baseMelee = config.phase === 'melee' && !config.keywords.some(k => k.name === 'Extra Attacks');
      const attacker = sourceUnit?.unit.id || $('attacker').value || sourceUnit?.unit.name || 'manual';
      if (baseMelee && !config.split && queue.some(e => e.attacker === attacker &&
        e.config.phase === 'melee' && !e.config.split && !e.config.keywords.some(k => k.name === 'Extra Attacks'))) {
        throw Error('One standard melee profile per attacking model. For different bearers, select a separate roster entry or split and manually allocate attacks.');
      }
      queue.push({ config, attacker, slot: targetSlot, label: weapon?.value ? weapon.textContent : 'Manual ' + (config.phase === 'melee' ? 'melee' : 'ranged') + ' weapon' });
      resetRoll(); render();
    },
    clear() { queue = []; resetRoll(); render(); },
    probability() { switchMode('probability'); },
    live() { switchMode('live'); },
    simulate() { switchMode('probability'); render(true); },
    next() { roll.next(); render(); },
    finish() { roll.finish(); render(); },
    'new-roll'() { resetRoll(); render(); },
    'next-weapon'() {
      const previous = rollQueue[rollIndex];
      liveStates[previous.slot] = roll.result.hp;
      completedRolls.push({ label: previous.label + ' → target ' + previous.slot, history: [...roll.history] });
      const entry = rollQueue[++rollIndex];
      roll = engine.live(entry.plan, undefined, liveStates[entry.slot] ?? entry.plan.hp);
      render();
    },
    async copy() { await navigator.clipboard.writeText(report); $('error').textContent = 'Copied results.'; },
    export() {
      const url = URL.createObjectURL(new Blob([report], { type: 'text/plain' }));
      const link = el('a'); link.href = url; link.download = 'forgeroster-combat.txt'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    save: saveScenario,
    load() {
      const entry = scenarios().find(x => x.id === $('scenarios').value);
      if (entry?.scenario?.schemaVersion !== 1) return;
      clearScenario();
      $('name').value = entry.name;
      queue = clone(entry.scenario.queue || []);
      targets = clone(entry.scenario.targets);
      targetSlot = entry.scenario.targetSlot || 'A';
      setConfig(entry.scenario.config);
      render();
    },
  };
  function switchTarget(slot) {
    if (targetSlot === slot) return;
    captureTarget();
    if (!Object.keys(targets[slot]).length) targets[slot] = { ...targets[targetSlot] };
    targetSlot = slot;
    fill(targets[slot], targetFields);
    $('defender').value = '';
    $('model-profile').parentElement.hidden = true;
    updateConditions(); resetRoll(); render();
  }
  function switchMode(next) {
    mode = next;
    for (const name of ['probability','live']) root.querySelector('[data-act=' + name + ']').setAttribute('aria-pressed', String(name === mode));
    $('mc').hidden = mode !== 'probability';
    render();
  }
  root.addEventListener('click', async event => {
    const name = event.target.closest('button')?.dataset.act;
    if (!handlers[name]) return;
    try { await handlers[name](); } catch (error) { $('error').textContent = error.message; }
  });
  function changeSession(next) {
    ++pending;
    account = next;
    rosterChoices = []; cloudScenarios = [];
    options($('attacker'), 'Manual attack profile', []);
    options($('defender'), 'Manual target profile', []);
    status('');
    clearScenario();
    loadScenarios().catch(() => status('Cloud scenarios unavailable.'));
    refreshRosters();
  }
  document.addEventListener('fr-user-signed-in', e => changeSession(e.detail));
  document.addEventListener('fr-user-signed-out', () => changeSession(null));
  for (const event of ['fr-roster-opened', 'fr-roster-saved', 'fr-cloud-rosters-changed']) document.addEventListener(event, refreshRosters);
  document.addEventListener('fr-rule-packs-changed', () => { if (!root.hidden) renderContext(); });
  document.addEventListener('fr-view-changed', event => {
    root.hidden = event.detail !== 'combat';
    if (!root.hidden) { refreshRosters(); render(); }
  });
  window.frOpenCombat = entry => { requestedEntry = entry; showForgeRosterView('combat'); };
  clearScenario(); scenarioOptions();
})();
