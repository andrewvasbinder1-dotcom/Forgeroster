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
  const api = {entries, resolve, source, revision};
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
    paragraph([rule.category, options.category && !rule.category ? options.category : '', rule.status].filter(Boolean).join(' · '));
    paragraph(rule.description || 'This keyword has no verified explanation in ForgeRoster.');
    paragraph(rule.conditions);
    if (rule.valid === false) paragraph('A valid parameter is required to show this rule’s exact effect.');
    if (options.activity) {
      content.append(element('h3', 'Current calculator effect'));
      paragraph(options.activity(rule));
    }
    if (rule.related?.length) {
      content.append(element('h3', 'Related rules'));
      for (const id of rule.related) content.append(chip(byId.get(id).name, options));
    }
    const ref = rule.source || (options.source ? {url:options.source, publication:'Datasheet source'} : null);
    if (ref) {
      paragraph([ref.publication, ref.revision, ref.section ? '§' + ref.section : '', rule.wording].filter(Boolean).join(' · '));
      try {
        const url = new URL(ref.url);
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
  window.ForgeRosterKeywords = {...api, chip};
})();
