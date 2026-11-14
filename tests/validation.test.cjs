'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../validation.js');

const prices = cost => [{ costs: [{ models: 1, points: cost }] }];
const unit = (id, name, models = 1) => ({ id, name, models, points: 999 });
const characters = [
  { name: 'Officer', keywords: ['Character'], role: 'leader', leads: ['Guard'], pricing: prices(40) },
  { name: 'Medic', keywords: ['Character'], role: 'support', leads: ['Guard'], pricing: prices(30) },
  { name: 'Commander', keywords: ['Character', 'Epic Hero'], mustBeWarlord: true, pricing: prices(100) },
];
const faction = {
  name: 'Test Army',
  units: [
    ...characters,
    { name: 'Guard', keywords: ['Battleline'], pricing: prices(20), wargear: [{ item: 'Cannon', points: 5 }] },
    { name: 'Transport', keywords: ['Dedicated Transport'], pricing: prices(25) },
    { name: 'Artillery', keywords: ['Vehicle'], pricing: prices(40) },
  ],
  detachments: [
    { name: 'Main', dp: 3, dispositions: ['Reconnaissance'], validationComplete: true, enhancements: [
      { name: 'Focus', points: 15, validationComplete: true },
      { name: 'Shield', points: 10, upgrade: true, validationComplete: true },
    ] },
    { name: 'Secondary', dp: 1, validationComplete: true },
  ],
};
const sheets = faction.units.map(unit => ({
  name: unit.name, allowedWargear: unit.name === 'Guard' ? ['Cannon', 'Banner'] : [], modelCounts: [1],
}));
const roster = (...units) => ({ faction: faction.name, limit: 1000, units, detachments: ['Main'], warlord: units[0]?.id });
const validate = current => rules.validate(current, faction, { sheets });

test('pricing applies ordinal boundaries, explicit model ranges, and ignores add-on rows', () => {
  const sheet = { pricing: [
    { range: '[1,3)', costs: [{ models: 5, points: 25 }, { models: 10, points: 45, minModels: 6, maxModels: 10 }] },
    { range: '[3,]', costs: [{ models: 5, points: 35 }, { models: 1, points: 5, addon: true }] },
  ] };
  assert.equal(rules.priceFor(sheet, 2, 7), 45);
  assert.equal(rules.priceFor(sheet, 3, 5), 35);
  assert.equal(rules.priceFor(sheet, 3, 1), undefined);
  assert.equal(rules.priceFor(sheet, 0, 5), undefined);
});

test('uses official points, including multiple paid copies of equipment, and reports local overrides', () => {
  const guard = { ...unit('g', 'Guard'), wargear: [{ item: 'Cannon', quantity: 2 }] };
  const current = roster(unit('o', 'Officer'), guard);
  const result = validate(current);
  assert.deepEqual(result.unitTotals, [40, 30]);
  assert.equal(result.total, 70);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.incomplete, []);
  assert.match(rules.validate(current, faction, { sheets, pointOverride: () => ({ points: 100 }) }).incomplete.join(), /local points override/);
});

test('allows a lone 3 DP detachment at Incursion and requires selected detachments to fit collectively', () => {
  const current = roster(unit('o', 'Officer'));
  assert.equal(validate(current).dpLimit, 3);
  current.detachments.push('Secondary');
  assert.equal(validate(current).dpLimit, 2);
  assert.match(validate(current).errors.join(), /4 DP/);
  current.detachments.push('Secondary');
  assert.match(validate(current).errors.join(), /at most once/);
  current.disposition = 'Disruption';
  assert.match(validate(current).errors.join(), /unavailable from the selected detachments/);
});

test('uses doubled Battleline and Dedicated Transport limits and single-copy Epic Heroes', () => {
  const copies = name => Array.from({ length: 4 }, (_, index) => unit(name + index, name));
  const current = roster(unit('c', 'Commander'), ...copies('Guard'), ...copies('Transport'));
  assert.deepEqual(validate(current).errors, []);
  current.units.push(...copies('Artillery'), unit('other', 'Commander'));
  const { errors } = validate(current);
  assert.match(errors.join(), /Artillery.*2-unit limit/);
  assert.match(errors.join(), /Commander.*1-unit limit/);
});

test('checks attachment eligibility, Support attachment and one slot per role', () => {
  const leader = { ...unit('o', 'Officer'), attachedTo: 'g' };
  const support = { ...unit('m', 'Medic'), attachedTo: 'g' };
  const current = roster(leader, support, unit('g', 'Guard'), unit('t', 'Transport'));
  assert.deepEqual(validate(current).errors, []);
  current.units.push({ ...leader, id: 'other' });
  assert.match(validate(current).errors.join(), /only one leader/);
  support.attachedTo = 't';
  assert.match(validate(current).errors.join(), /eligible bodyguard/);
  delete support.attachedTo;
  assert.match(validate(current).errors.join(), /Support units require/);
});

test('counts repeatable Upgrades once and charges each bearer, with one enhancement per attachment group', () => {
  const current = roster(unit('o', 'Officer'), unit('g1', 'Guard'), unit('g2', 'Guard'), unit('g3', 'Guard'));
  current.enhancements = [{ name: 'Focus', unitId: 'o' },
    ...[1, 2, 3].map(index => ({ name: 'Shield', detachment: 'Main', unitId: 'g' + index }))];
  assert.deepEqual(validate(current).errors, []);
  assert.equal(validate(current).total, 145);
  current.units[0].attachedTo = 'g1';
  assert.match(validate(current).errors.join(), /separate unit or attachment group/);
  current.enhancements[0] = { name: 'Focus', unitId: 'g2' };
  assert.match(validate(current).errors.join(), /ineligible/);
});

test('checks explicit pack requirements and flags unknown equipment or faction membership', () => {
  const current = roster(unit('o', 'Officer'), unit('x', 'Unknown'));
  const rule = { kind: 'detachment', faction: faction.name, name: 'Main', requiredUnits: ['Guard'], forbiddenUnits: ['Unknown'] };
  const ruledFaction = rules.withRules(faction, [rule]);
  const result = rules.validate(current, ruledFaction, { sheets });
  assert.match(result.errors.join(), /requires unit Guard.*prohibits unit Unknown/);
  assert.match(result.incomplete.join(), /Unknown.*faction eligibility/);
  assert.match(result.incomplete.join(), /Unknown.*equipment rules/);
});

test('checks equipment caps, exclusive selections, invalid model counts and mandatory Warlords', () => {
  const current = roster(unit('o', 'Officer'), unit('c', 'Commander'), {
    ...unit('g', 'Guard', 3), wargear: [{ item: 'Cannon', quantity: 2 }, 'Banner', 'Invalid'],
  });
  const constraints = { wargearLimits: [{ item: 'Cannon', maxPerUnit: 1 }], exclusiveWargearGroups: [['Cannon', 'Banner']] };
  const result = rules.validate(current, faction, { sheets: sheets.map(sheet => sheet.name === 'Guard' ? { ...sheet, ...constraints } : sheet) });
  assert.match(result.errors.join(), /model count is outside/);
  assert.match(result.errors.join(), /Invalid is outside/);
  assert.match(result.errors.join(), /too many copies of Cannon/);
  assert.match(result.errors.join(), /choose only one of Cannon, Banner/);
  assert.match(result.errors.join(), /mandatory Warlord/);
});

test('prices equal-size compositions by option ID and flags legacy ambiguity', () => {
  const sheet = { pricing: [
    { range: '[1,2]', costs: [
      { models: 6, points: 115, optionId: 'with-wolves' },
      { models: 6, points: 170, optionId: 'without-wolves' },
    ] },
    { range: '[3,]', costs: [
      { models: 6, points: 125, optionId: 'with-wolves' },
      { models: 6, points: 180, optionId: 'without-wolves' },
    ] },
  ] };
  assert.equal(rules.priceFor(sheet, 2, 6, 'with-wolves'), 115);
  assert.equal(rules.priceFor(sheet, 3, 6, 'without-wolves'), 180);
  assert.equal(rules.priceFor(sheet, 3, 6), undefined);
});

test('enforces the selected role when a model can join in more than one role', () => {
  const officer = {
    ...characters[0], joins: [{ role: 'leader', targets: ['Guard'] }, { role: 'support', targets: ['Guard'] }],
  };
  const dualFaction = { ...faction, units: faction.units.map(entry => entry.name === 'Officer' ? officer : entry) };
  const o = { ...unit('o', 'Officer'), attachedTo: 'g' };
  const m = { ...unit('m', 'Medic'), attachedTo: 'g' };
  const current = roster(o, m, unit('g', 'Guard'));
  assert.deepEqual(rules.validate(current, dualFaction, { sheets }).errors, []);
  o.attachmentRole = 'support';
  assert.match(rules.validate(current, dualFaction, { sheets }).errors.join(), /one support/);
  o.attachmentRole = 'commander';
  assert.match(rules.validate(current, dualFaction, { sheets }).errors.join(), /role is unavailable/);
});

test('allows Titan factions to skip detachments and select a qualifying non-Character Warlord', () => {
  const titans = {
    name: 'Titans', units: [
      { name: 'Warhound', keywords: ['Titan'], pricing: prices(700) },
      { name: 'Escort', keywords: ['Vehicle'], pricing: prices(80) },
    ], detachments: [],
    rosterRules: { requiresDetachment: false, warlordUnitNames: ['Warhound'], dispositions: ['Take and Hold'] },
  };
  const current = { ...roster(unit('t', 'Warhound'), unit('e', 'Escort')), faction: 'Titans', detachments: [] };
  const result = rules.validate(current, titans);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.dispositions, ['Take and Hold']);
  current.warlord = 'e';
  assert.match(rules.validate(current, titans).errors.join(), /eligible faction unit/);
});
