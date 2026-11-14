import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const catalog = JSON.parse(await readFile(new URL('../data/mfm.json', import.meta.url), 'utf8'));
const bySlug = slug => catalog.factions.find(faction => faction.slug === slug);
const allUnits = catalog.factions.flatMap(faction => faction.units);

test('snapshot exposes the 30 faction catalogs and source scope', () => {
  assert.equal(catalog.schemaVersion, 2);
  assert.equal(catalog.meta.edition, '11th');
  assert.equal(catalog.factions.length, 30);
  assert.equal(new Set(catalog.factions.map(faction => faction.slug)).size, 30);
  assert.ok(catalog.factions.every(faction => faction.units.length && faction.source.startsWith(catalog.meta.source)));
  assert.equal(allUnits.length, 1768);
  assert.equal(catalog.factions.flatMap(faction => faction.detachments).length, 334);
});

test('roster names are unique, and base pricing has positive counts and non-negative integer costs', () => {
  for (const faction of catalog.factions) {
    assert.equal(new Set(faction.units.map(unit => unit.name)).size, faction.units.length, faction.slug);
    for (const unit of faction.units) {
      assert.ok(unit.pricing.length > 0, unit.name);
      for (const tier of unit.pricing) {
        assert.match(tier.range, /^\[\d+,\d*\]$/);
        const costs = tier.costs.filter(cost => !cost.addon);
        assert.ok(costs.length > 0, unit.name);
        for (const row of costs) {
          assert.ok(Number.isInteger(row.models) && row.models >= 1);
          assert.ok(Number.isInteger(row.points) && row.points >= 0);
        }
      }
    }
  }
});

test('mixed model labels and add-ons retain distinct model counts and prices', () => {
  const crusaders = bySlug('black-templars').units.find(unit => unit.name === 'Crusader Squad');
  const headtakers = bySlug('space-wolves').units.find(unit => unit.name === 'Wolf Guard Headtakers');
  const tidewall = bySlug('tau-empire').units.find(unit => unit.name === 'Tidewall Shieldline');
  assert.deepEqual(crusaders.pricing[0].costs.map(cost => cost.models), [10, 20]);
  assert.deepEqual(headtakers.pricing[0].costs.map(cost => cost.models), [3, 6, 6, 12]);
  assert.equal(new Set(headtakers.pricing[0].costs.map(cost => cost.optionId)).size, 4);
  assert.equal(headtakers.stats.find(profile => profile.name === 'Hunting Wolf')?.m, '10"');
  assert.equal(tidewall.pricing[0].costs.find(cost => cost.addon).points, 20);
  assert.deepEqual(tidewall.wargear[0], { item: 'Tidewall Defence Platform', points: 20, perItem: true });
});

test('selected independent checks for costs, profiles and Leader targets', () => {
  const warriors = bySlug('leagues-of-votann').units.find(unit => unit.name === 'Hearthkyn Warriors');
  const dreir = bySlug('astra-militarum').units.find(unit => unit.name === 'Lord Marshal Dreir');
  assert.deepEqual(warriors.pricing[0].costs[0], { models: 10, points: 90, desc: '10 models', optionId: '10-models' });
  assert.deepEqual(warriors.stats[0], { m: '5"', t: '5', sv: '4+', w: '1', ld: '7+', oc: '2' });
  assert.equal(warriors.weapons.find(weapon => weapon.name === 'HYLas rotary cannon')?.a, '6');
  assert.equal(warriors.weapons.find(weapon => weapon.name === 'Vortex Grenade'), undefined);
  assert.ok(warriors.weapons.some(weapon => weapon.name === 'L7 missile launcher – focused'));
  assert.ok(!warriors.abilityNames.includes('Guerrilla Adepts'));
  assert.equal(dreir.pricing[0].costs[0].points, 70);
  assert.equal(dreir.role, 'leader');
  assert.deepEqual(dreir.leads, ['Death Riders']);
});

test('datasheet data contains factual fields without rule prose', () => {
  assert.equal(allUnits.filter(unit => unit.stats?.length).length, 1736);
  for (const unit of allUnits) {
    if (unit.abilityNames) assert.ok(unit.abilityNames.every(name => typeof name === 'string' && name.length <= 130), unit.name);
    for (const weapon of unit.weapons ?? []) {
      assert.ok(!('text' in weapon) && !('description' in weapon));
      assert.ok(['melee', 'ranged'].includes(weapon.kind), weapon.name);
    }
  }
});

test('Titan factions retain their verified faction and Warlord exceptions', () => {
  const chaos = bySlug('chaos-titan-legions');
  assert.equal(chaos.rosterRules.requiresDetachment, false);
  assert.deepEqual(chaos.rosterRules.warlordKeywords, ['Titanicus Traitoris']);
  assert.ok(chaos.units.every(unit => unit.keywords.includes('Chaos') && unit.keywords.includes('Titanicus Traitoris')));
  assert.ok(chaos.units.every(unit => !unit.keywords.includes('Imperium')));
});
