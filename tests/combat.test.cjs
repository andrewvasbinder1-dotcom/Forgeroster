const { test } = require('node:test');
const assert = require('node:assert/strict');
const e = require('../combat-engine.js');
const plan = (options = {}) => e.compile({ ...e.example, ...options });
const calc = options => e.calculate(plan(options));
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, actual + ' ≠ ' + expected);

test('reference scenario including exact kill probability and lost overkill', () => {
  const p = plan(), r = e.calculate(p), q = 8 / 27;
  assert.deepEqual([p.hitNeeded, p.woundNeeded, p.save], [3, 3, 5]);
  near(r.hits, 8 / 3); near(r.wounds, 16 / 9); near(r.failedSaves, 32 / 27);
  near(r.rawDamage, 64 / 27);
  near(r.destroyed, 1 - (1 - q) ** 4 - 4 * q * (1 - q) ** 3);
  near(r.appliedDamage, 2 * r.damage.get(2) + 3 * r.destroyed);
});

test('all wound table bands and natural critical and failure precedence', () => {
  assert.deepEqual([12, 7, 6, 4, 3].map(s => e.woundThreshold(s, 6)), [2, 3, 4, 5, 6]);
  const p = plan({ hitMod: -5, woundMod: 4, critHit: 5, critWound: 4 });
  assert.equal(p.hit(1), 0);
  assert.equal(p.hit(3), 0);
  assert.equal(p.hit(4), 1);
  assert.equal(p.hit(5), 2);
  assert.equal(p.woundRoll(2), 1);
  assert.equal(p.woundRoll(4), 2);
});

test('cover modifies BS apart from capped hit modifiers and does not affect saves', () => {
  const p = plan({ cover: true, hitMod: -2, defHit: -1 });
  assert.equal(p.skill, 4); assert.equal(p.hitNeeded, 5); assert.equal(p.save, 5);
  assert.equal(plan({ cover: true, keywords: ['Ignores Cover'] }).hitNeeded, 3);
  assert.equal(plan({ phase: 'melee', cover: true }).hitNeeded, 3);
});

test('rerolls and Twin-linked', () => {
  near(calc({ hitReroll: 'ones' }).hits, (4 * 2 / 3) * (7 / 6));
  near(calc({ hitReroll: 'all' }).hits, 4 * 8 / 9);
  near(calc({ keywords: ['Twin-Linked'] }).wounds, 4 * 2 / 3 * 8 / 9);
});

test('Sustained hits do not inherit Lethal and Anti interacts with Devastating', () => {
  const r = calc({ attacks: 1, skill: 6, strength: 1, toughness: 6, save: 2, ap: 0,
    damage: 1, targetKeywords: 'Infantry, Vehicle', keywords: ['Lethal Hits', 'Sustained Hits 1', 'Anti-Vehicle 4+', 'Devastating Wounds'] });
  near(r.hits, 1 / 3); near(r.wounds, 1 / 4); near(r.criticalWounds, 1 / 12);
  near(r.failedSaves, 1 / 36); near(r.rawDamage, 1 / 9);
});

test('variable damage, invulnerable saves, FNP and per-model allocation', () => {
  const r = calc({ attacks: 1, damage: 'D6', inv: 4, fnp: 4, wounds: 2, targets: 2,
    keywords: ['Torrent'], strength: 12 });
  near(r.rawDamage, 5 / 6 * 1 / 2 * 3.5 * 1 / 2);
  assert.equal(r.casualties.has(2), false);
  assert.equal(r.destroyed, 0);
  assert.equal(plan({ inv: 4, ap: -5, saveMod: 1 }).save, 4);
});

test('Heavy, Lance, Blast, Cleave, Rapid Fire, Melta and condition boundaries', () => {
  assert.equal(plan({ movedKnown: true, moved: 3, keywords: ['Heavy'] }).hitNeeded, 2);
  assert.equal(plan({ movedKnown: true, moved: 4, keywords: ['Heavy'] }).hitNeeded, 3);
  assert.equal(plan({ movedKnown: true, entered: true, keywords: ['Heavy'] }).hitNeeded, 3);
  assert.equal(plan({ phase: 'melee', charged: true, keywords: ['Lance'] }).woundNeeded, 2);
  assert.equal(calc({ targets: 11, keywords: ['Blast 2', 'Rapid Fire 3'] }).attacks, 11);
  assert.equal(calc({ targetStart: 11, phase: 'melee', keywords: ['Cleave 2'] }).attacks, 8);
  assert.equal(calc({ distance: 13, keywords: ['Rapid Fire 3'] }).attacks, 4);
  assert.equal(plan({ keywords: ['Melta 2'] }).damage(2), 4);
});

test('shooting restrictions and Indirect Fire natural floors', () => {
  assert.equal(calc({ distance: 25 }).attacks, 0);
  assert.equal(calc({ visible: false }).attacks, 0);
  assert.equal(calc({ advanced: true }).attacks, 0);
  assert.equal(calc({ advanced: true, keywords: ['Assault'] }).attacks, 4);
  assert.equal(calc({ engaged: true, engagingTarget: true, keywords: ['Pistol', 'Blast'] }).attacks, 0);
  const p = plan({ visible: false, keywords: ['Indirect Fire'], hitReroll: 'all', critHit: 5 });
  assert.equal(p.hit(5), 0); assert.equal(p.hitReroll, '');
  assert.equal(plan({ indirect: true, stationary: true, spotter: true, keywords: ['Indirect Fire'] }).hitNeeded, 4);
});

test('partial target wounds, multiple profiles and probability conservation', () => {
  const options = { attacks: 1, targets: 2, firstWounds: 1 };
  const p = plan(options);
  const first = e.calculate(p), second = e.calculate(p, first.state);
  const q = 8 / 27;
  near(first.expectedKills, q);
  near(second.expectedKills, 1 - (1 - q) ** 2);
  near([...second.state.values()].reduce((a, b) => a + b), 1);
});

test('live reroll history tracks eligibility and accepts a reroll only once', () => {
  const values = [1, 6, 4, 2, 1];
  const live = e.live(plan({ attacks: 1, hitReroll: 'all', keywords: ['Hazardous'] }), () => values.shift());
  live.next(); live.next();
  assert.equal(live.dice[0].eligible, true);
  live.reroll([0, 0]); live.reroll([0]);
  assert.equal(live.dice[0].outcome, 2);
  live.finish();
  assert.equal(live.result.damage, 2);
  assert.equal(live.result.hazard, 1);
  assert.ok(live.history.some(r => r.values.includes('1 → 6')));
});

test('seeded simulation is reproducible and agrees with exact results', () => {
  const p = plan({ attacks: 'D3', damage: 'D6', fnp: 5 });
  const r = e.simulate([p], 12000, 42);
  assert.deepEqual(r.damage, e.simulate([p], 12000, 42).damage);
  near(r.destroyed, e.calculate(p).destroyed, .025);
});

test('unsupported abilities and unknown profiles are explicit', () => {
  assert.ok(plan({ keywords: ['Precision', 'Unknown rule', 'Sustained Hits 1', 'Sustained Hits 2'] }).warnings.length >= 3);
  assert.throws(() => plan({ strength: '' }), /Enter strength/);
  assert.throws(() => plan({ attacks: '*' }), /dice notation/);
});

test('older catalogue mixed tables classify weapon profiles by Melee range', () => {
  assert.equal(e.weaponPhase({ kind: 'ranged', range: 'Melee' }), 'melee');
  assert.equal(e.weaponPhase({ kind: 'ranged', range: '24"' }), 'ranged');
});

test('mixed save dice resolve lowest first against the current model', () => {
  const p = plan({ attacks: 2, targets: 2, ap: 0, damage: 3, keywords: ['Torrent'],
    defensiveGroups: '1,2,6,0,0,1,0\n1,4,2,0,0,4,0' });
  const dice = [6, 6, 2, 1];
  const result = e.live(p, () => dice.shift()).finish();
  assert.deepEqual(result.modelHp, [0, 4]);
  assert.equal(result.damage, 1);
  assert.equal(result.kills, 1);
  assert.equal(e.calculate(p).tooComplex, true);
});

test('Precision targets visible Character then returns to bodyguard without spillover', () => {
  const p = plan({ attacks: 2, targets: 2, ap: 0, damage: 4, keywords: ['Precision'],
    defensiveGroups: '1,3,6,0,0,3,0\n1,2,4,2,0,2,1', precisionTarget: 2, precisionVisible: true });
  const dice = [6, 6, 6, 6, 3, 1];
  assert.deepEqual(e.live(p, () => dice.shift()).finish().modelHp, [0, 0]);
  assert.throws(() => plan({ ...p.c, precisionVisible: false }), /visible Character/);
});

test('mixed groups use model-specific Feel No Pain and keep state across weapons', () => {
  const p = plan({ attacks: 1, targets: 2, ap: 0, damage: 2, keywords: ['Torrent'],
    defensiveGroups: '1,1,7,0,0,1,0\n1,3,6,0,5,3,0' });
  const first = e.live(p, () => 6).finish();
  assert.deepEqual(first.modelHp, [0, 3]);
  const dice = [6, 1, 6, 2];
  assert.deepEqual(e.live(p, () => dice.shift(), first.modelHp).finish().modelHp, [0, 2]);
  const seeded = e.simulate([p,p], 500,42);
  assert.deepEqual(seeded.casualties,e.simulate([p,p],500,42).casualties);
  assert.throws(() => plan({ models: '' }), /eligible attacking models/);
});
