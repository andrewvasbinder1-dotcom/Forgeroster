'use strict';

(() => {
  const engine = typeof module === 'object' ? require('./combat-engine.js') : window.ForgeRosterCombat;
  const revision = '11e-core-2026-06-reference-1';
  const source = { publication: 'Warhammer 40,000 Core Rules', edition: 11, revision: 'June 2026', publicationDate: '2026-06-01', url: 'https://assets.warhammer-community.com/eng_01-06_warhammer40k_new40k_core_rules-was6fbu1ix-hfewhmxyiy.pdf' };
  const checked = 'Checked against the June 2026 Core Rules';
  const slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const entries = [];
  function add(name, category, section, description, conditions = '', related = [], status = checked) {
    entries.push({id: slug(name), name, category, source: {...source, section}, description, conditions,
      related: related.map(slug), status, wording: 'Original explanation', edition: source.edition, revision,
      checkedOn: '2026-11-14', handler: Object.hasOwn(engine.definitions, name) ? name : null});
  }
  const weapon = (name, section, description, conditions, related, status) =>
    add(name, 'Weapon ability', section, description, conditions, related, status);
  weapon('Rapid Fire', '24.30', 'Add {value} attacks per weapon if the target was within half the listed range in the Select Targets step.', 'Use the range on the selected weapon profile.', ['Melta']);
  weapon('Melta', '24.25', 'Increase the Damage characteristic by {value} if the target was within half the listed range in the Select Targets step.', '', ['Rapid Fire']);
  weapon('Sustained Hits', '24.36', 'A critical hit generates {value} additional hits. Resolve those extra hits without treating them as critical hits.', '', ['Lethal Hits']);
  weapon('Anti', '24.03', 'Against {target}, an unmodified wound roll of {value}+ is a critical wound.', 'The target must have the specified keyword.', ['Devastating Wounds']);
  weapon('Blast', '24.05', 'Add {value} attacks per whole group of five models in the target when targets were selected.', 'Check engagement restrictions before selecting the target.');
  weapon('Cleave', '24.06', 'Add {value} attacks per whole group of five models in the target when targets were selected.', 'The attacks must be allocated to a single target.');
  weapon('Lethal Hits', '24.23', 'A critical hit can wound automatically. That automatic wound does not count as a critical wound.', '', ['Sustained Hits','Devastating Wounds']);
  weapon('Devastating Wounds', '24.10', 'A critical wound inflicts mortal wounds equal to the attack’s Damage and ends that attack’s normal sequence.', '', ['Anti','Feel No Pain']);
  weapon('Twin-Linked', '24.38', 'You can reroll the wound roll for this attack.', 'A die may only be rerolled once.');
  weapon('Torrent', '24.37', 'The attack hits automatically without a hit roll.', 'Check the appendix restrictions for combining it with Indirect Fire or Precision.');
  weapon('Heavy', '24.16', 'Add 1 to hit when shooting in your Shooting phase with an unengaged unit that was not set up this turn and moved no more than 3″.', 'Normal hit modifier limits apply.');
  weapon('Lance', '24.21', 'Add 1 to the wound roll in the Fight phase when the bearer’s unit charged this turn.', 'Normal wound modifier limits apply.');
  weapon('Precision', '24.28', 'This attack can be allocated to a visible Character in the target unit when allocating attacks.', 'Select a visible Character allocation group in the calculator.');
  weapon('Indirect Fire', '24.19', 'Can allow an unseen target. Indirect shooting grants the target cover, prohibits hit rerolls, and uses a minimum natural hit result.', 'A natural 6 is normally required. Stationary shooting with an eligible spotter can lower that minimum to 4.', ['Cover']);
  weapon('Ignores Cover', '24.18', 'The target cannot receive the Benefit of Cover against this attack.', '', ['Cover']);
  weapon('Hazardous', '24.15', 'After the unit finishes shooting or fighting, roll one D6 per selected Hazardous weapon. A 1 or 2 causes one mortal wound, or three for a Vehicle or Monster bearer.', '', ['Feel No Pain']);
  weapon('Assault', '24.04', 'The weapon can shoot after its unit Advances.', 'Other shooting and target restrictions still apply.');
  weapon('Close-Quarters', '24.07', 'Allows eligible shooting at an enemy engaging the attacking unit.', 'Check engagement and phase restrictions.');
  weapon('One Shot', '24.26', 'Each weapon can be used once per battle.');
  weapon('Psychic', '24.29', 'Eligible attacks can ignore modifiers to Ballistic Skill, Weapon Skill or hit rolls under the Psychic rule.', 'Use the matching calculator toggles for the modifiers being ignored.');
  weapon('Pistol', '24.27', 'Pistol has the same rules as Close-Quarters in this edition. The June 2026 rules identify Pistol as the older name.', '', ['Close-Quarters']);
  weapon('Extra Attacks', '24.11', 'When the bearer fights, select all its Extra Attacks weapons plus one other melee weapon if it has one.', 'Check the datasheet and its exceptions.', []);
  add('Feel No Pain', 'Core ability', '24.12', 'Roll one D6 for each applicable wound the model would lose. A result of {value}+ prevents that wound.', 'Some versions apply only to specific sources of damage.');
  add('Cover', 'Core ability', '13.08', 'The Benefit of Cover worsens Ballistic Skill by 1 for qualifying ranged attacks.', 'Check terrain, visibility and weapon exceptions.', ['Ignores Cover']);
  add('Invulnerable Save', 'Core ability', '05.03', 'A model can use its invulnerable save instead of its armour save. Armour Penetration does not modify the invulnerable threshold.', 'Use the value from the defending model’s profile.');
  for (const [name, text] of Object.entries({
    Infantry: 'Identifies Infantry for rules that refer to Infantry targets or units.',
    Vehicle: 'Identifies Vehicles for rules such as engaged shooting and Hazardous damage.',
    Monster: 'Identifies Monsters for rules such as engaged shooting and Hazardous damage.',
    Character: 'Identifies Characters for rules such as Precision. Check the datasheet for attachment eligibility.',
    Battleline: 'Identifies units that can qualify for Battleline army-construction rules.',
    'Epic Hero': 'Identifies named heroes that are subject to Epic Hero army-construction restrictions.',
    Fly: 'Identifies a unit that can use applicable movement rules for Fly.',
    Psyker: 'Identifies a model or unit for rules that specifically refer to Psykers.',
  })) add(name, 'Unit keyword', '', text, 'Apply an effect only when another rule calls for this classification.', [], 'Classification reference');

  for (const name of ['Leader', 'Support']) {
    add(name, 'Attachment rule', name === 'Leader' ? '24.22' : '24.34',
      'Check the datasheet’s eligible bodyguard units before attaching this unit. Apply the attached-unit rules in section 19.',
      'Unit-specific permissions and exceptions still apply.');
  }

  const byId = new Map(entries.map(entry => [entry.id, entry]));
  function resolve(input) {
    const label = typeof input === 'string' ? input.trim() : input?.label || input?.name || '';
    const fnp = /^feel no pain\s*([2-6])\+$/i.exec(label);
    const parsed = typeof input === 'object' && input !== null ? input : fnp
      ? {name:'Feel No Pain', value:fnp[1]} : engine.keyword(label);
    const entry = byId.get(slug(parsed.name));
    if (!entry) return {label, name:label, status:'Definition unavailable'};
    const value = typeof input === 'string' && slug(label) === entry.id && entry.id !== 'blast'
      ? undefined : parsed.value;
    const target = parsed.target;
    const threshold = ['anti','feel-no-pain'].includes(entry.id);
    const parameterized = entry.description.includes('{value}');
    const hasValue = value !== '' && value != null && (/^\d+$/.test(String(value))
      ? Number(value) >= (threshold ? 2 : 0) && Number(value) <= (threshold ? 6 : 20)
      : entry.id === 'sustained-hits' && /^D[36]$/i.test(value));
    const valid = (!parameterized || hasValue) && (entry.id !== 'anti' || Boolean(typeof target === 'string' && target.trim()));
    const shownValue = hasValue ? String(value).toUpperCase() : 'X';
    const heading = entry.id === 'anti' && target ? 'Anti-' + target + ' ' + shownValue + '+' :
      parameterized && hasValue ? entry.name + ' ' + shownValue + (threshold ? '+' : '') : label || entry.name;
    return {...entry, label:heading, value, target, valid,
      description:entry.description.replace('{value}', shownValue).replace('{target}', () => target || 'the specified target keyword')};
  }
  function factionIndex(catalogue, packs) {
    const factions = new Map();
    function addRecord(faction, name, category, source, summary) {
      if (!name || typeof name !== 'string') return;
      if (!factions.has(faction)) factions.set(faction, new Map());
      const records = factions.get(faction);
      const key = category + ':' + slug(name);
      if (!records.has(key) || summary) records.set(key, {name, category, source, summary});
    }
    for (const faction of catalogue.factions || []) {
      addRecord(faction.name, faction.name, 'Faction keyword', faction.source);
      for (const detachment of faction.detachments || []) {
        addRecord(faction.name, detachment.name, 'Detachment', faction.source);
      }
      for (const unit of faction.units || []) {
        for (const name of unit.keywords || []) {
          addRecord(faction.name, name, slug(name) === slug(faction.name) ? 'Faction keyword' : 'Unit keyword', unit.datasheetSource);
        }
        for (const name of unit.abilityNames || []) addRecord(faction.name, name, 'Unit ability', unit.datasheetSource);
        for (const weapon of unit.weapons || []) {
          if (Array.isArray(weapon.keywords)) for (const name of weapon.keywords) addRecord(faction.name, name, 'Weapon ability', unit.datasheetSource);
        }
      }
    }
    const categories = {'faction-rule':'Faction rule', 'detachment-rule':'Detachment ability', 'leader-rule':'Attachment rule', detachment:'Detachment', ability:'Unit ability', keyword:'Unit keyword', stratagem:'Stratagem', enhancement:'Enhancement'};
    for (const pack of packs) {
      for (const item of pack.entries) {
        if (!item.faction || !categories[item.kind] || !item.text) continue;
        const sources = (pack.sources || []).filter(ref => /^Games Workshop/i.test(ref.label));
        const reference = (item.references || []).join(' · ');
        const matched = sources.find(ref => /codex preview/i.test(ref.label) && /codex preview/i.test(reference)) ||
          sources.find(ref => /faction pack/i.test(ref.label) && /faction pack/i.test(reference));
        addRecord(item.faction, item.name, item.detachment && item.kind === 'ability' ? 'Detachment ability' : categories[item.kind],
          matched?.url, {text:item.text, publication:matched?.label || pack.title, revision:pack.version, reference});
      }
    }
    return new Map([...factions].map(([name, records]) => [name,
      [...records.values()].sort((a,b) => a.name.localeCompare(b.name))]));
  }
  function replayStatus(saved, engineRevision) {
    if (saved.keywordReferenceRevision && saved.keywordReferenceRevision !== revision ||
        saved.combatEngineRevision && saved.combatEngineRevision !== engineRevision) return 'unavailable';
    return saved.keywordReferenceRevision && saved.combatEngineRevision ? 'pinned' : 'legacy';
  }
  const api = {entries, resolve, source, revision, factionIndex, replayStatus};
  if (typeof module === 'object') { module.exports = api; return; }

  const element = (tag, text) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    return node;
  };
  const dialog = element('dialog');
  dialog.className = 'fr-keyword-dialog';
  dialog.setAttribute('aria-labelledby', 'frKeywordTitle');
  const title = element('h2');
  title.id = 'frKeywordTitle';
  const close = element('button', 'Close rule reference');
  close.autofocus = true;
  close.onclick = () => dialog.close();
  const content = element('div');
  dialog.append(title, close, content);
  document.body.append(dialog);
  let opener;
  dialog.addEventListener('close', () => opener?.focus());
  function open(input, options = {}) {
    const rule = resolve(input);
    if (!dialog.open) opener = options.opener || document.activeElement;
    title.textContent = rule.label;
    content.replaceChildren();
    const paragraph = text => { if (text) content.append(element('p', text)); };
    paragraph([rule.category, options.category && !rule.category ? options.category : '', options.summary && !rule.id ? 'Existing rules pack summary' : rule.status].filter(Boolean).join(' · '));
    paragraph(rule.description || options.summary?.text || 'This keyword has no verified explanation in ForgeRoster.');
    paragraph(rule.conditions);
    paragraph(options.context);
    if (rule.valid === false) paragraph('A valid parameter is required to show this rule’s exact effect.');
    if (options.activity) {
      content.append(element('h3', 'Current calculator effect'));
      paragraph(options.activity(rule));
    }
    if (rule.related?.length) {
      content.append(element('h3', 'Related rules'));
      for (const id of rule.related) content.append(chip(byId.get(id).name, options));
    }
    const ref = rule.source || (options.source || options.summary ? {url:options.source, publication:options.summary?.publication || 'Datasheet source', revision:options.summary?.revision} : null);
    if (ref) {
      paragraph([ref.publication, ref.revision, ref.section ? '§' + ref.section : '', rule.wording].filter(Boolean).join(' · '));
      paragraph(options.summary?.reference);
      try {
        const url = new URL(ref.url || '');
        if (url.protocol === 'https:') {
          const link = element('a', 'Open source reference');
          link.href = url.href;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          content.append(link);
        }
      } catch {}
    }
    if (!dialog.open) dialog.showModal();
  }
  function chip(input, options = {}) {
    const button = element('button', resolve(input).label);
    button.className = 'fr-keyword-chip';
    button.type = 'button';
    button.setAttribute('aria-haspopup', 'dialog');
    button.onclick = () => open(typeof options.currentInput === 'function' ? options.currentInput() : input, {...options, currentInput:undefined, opener:button});
    return button;
  }
  let catalogueRequest;
  async function loadFactionIndex() {
    catalogueRequest ||= fetch('./data/mfm.json').then(response => {
      if (!response.ok) throw Error('Faction references are unavailable.');
      return response.json();
    }).catch(error => { catalogueRequest = null; throw error; });
    return factionIndex(await catalogueRequest, window.ForgeRosterRules?.getPacks() || []);
  }
  function reviewQueue(index) {
    return [...index].flatMap(([faction, records]) => records.filter(record =>
      !record.summary && !resolve(record.name).id).map(record => ({...record, faction})));
  }
  async function factionPicker(label, display) {
    const index = await loadFactionIndex();
    const select = element('select');
    select.setAttribute('aria-label', label);
    select.append(new Option('Choose a faction', ''));
    for (const faction of [...index.keys()].sort()) select.append(new Option(faction, faction));
    select.onchange = () => display(index.get(select.value), select.value);
    return select;
  }
  function linkedText(container, text, extra = []) {
    const names = [...new Set([...entries.map(entry => entry.name), ...extra])].filter(Boolean)
      .sort((a,b) => b.length - a.length).map(name => [...name].map(char => '.*+?^${}()|[]\\'.includes(char) ? '\\' + char : char).join(''));
    const pattern = new RegExp('(?<![\\p{L}\\p{N}])(' + names.join('|') + ')(?![\\p{L}\\p{N}])', 'giu');
    let offset = 0;
    for (const match of text.matchAll(pattern)) {
      container.append(text.slice(offset, match.index), chip(match[0]));
      offset = match.index + match[0].length;
    }
    container.append(text.slice(offset));
  }
  window.ForgeRosterKeywords = {...api, chip, loadFactionIndex, reviewQueue, factionPicker, linkedText};
})();
