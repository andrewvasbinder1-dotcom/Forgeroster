const { test } = require('node:test');
const assert = require('node:assert/strict');
const { countWeapons } = require('../weapon-bearers.js');
const engine = require('../combat-engine.js');

test('counts unequal copies, excludes casualties, requires recorded models', () => {
  const unit = [
    { alive: true, weapons: ['Cannon','Cannon'] },
    { alive: true, weapons: ['Cannon','Pistol'] },
    { alive: false, weapons: ['Cannon','Cannon'] },
  ];
  assert.deepEqual(countWeapons(unit, 3, 'Cannon'), { bearers: 2, weapons: 3 });
  assert.deepEqual(countWeapons(unit, 3, 'Rifle'), { bearers: 0, weapons: 0 });
  assert.equal(countWeapons([...unit,null], 4, 'Cannon'), null);
  assert.equal(countWeapons(unit, 4, 'Cannon'), null);
});

test('explicit weapon counts drive attacks and zero surviving weapons stays zero', () => {
  const plan = engine.compile({ ...engine.example, weaponCountOverride: 3 });
  assert.equal(engine.calculate(plan).attacks, 12);
  const none = engine.compile({ ...engine.example, weaponCountOverride: 0 });
  assert.equal(engine.calculate(none).attacks, 0);
  assert.equal(engine.live(none, () => 6).finish().damage, 0);
});

const { scenarioUnit, countScenario, setModelStatus, resetStrength } = require('../weapon-bearers.js');
const model = (...weapons) => ({ alive: true, weapons });

test('uniform loadout reduces 10 to 9 or 5 and updates projected attacks and damage', () => {
  const unit = scenarioUnit({models:10, combatLoadout:Array.from({length:10}, () => model('Rifle'))});
  let previous = Infinity;
  for (const remaining of [10,9,5,0]) {
    unit.remaining = remaining;
    const { weapons } = countScenario(unit,'Rifle','ranged');
    assert.equal(weapons,remaining);
    const result = engine.calculate(engine.compile({...engine.example,weaponCountOverride:weapons}));
    assert.equal(result.attacks,remaining * 4);
    assert.ok(result.rawDamage < previous);
    previous = result.rawDamage;
  }
});

test('mixed equipment needs identities and excludes the specific lost bearer', () => {
  const saved = {models:10,combatLoadout:[...Array.from({length:8},()=>model('Rifle')),model('Plasma'),model('Heavy','Pistol')]};
  const unit = scenarioUnit(saved);
  unit.remaining = 9;
  assert.equal(countScenario(unit,'Plasma','ranged').weapons,null);
  setModelStatus(unit,0,'destroyed');
  assert.equal(countScenario(unit,'Rifle','ranged').weapons,7);
  assert.equal(countScenario(unit,'Plasma','ranged').weapons,1);
  resetStrength(unit);
  setModelStatus(unit,8,'destroyed');
  assert.equal(countScenario(unit,'Rifle','ranged').weapons,8);
  assert.equal(countScenario(unit,'Plasma','ranged').weapons,0);
  assert.equal(countScenario(unit,'Pistol','ranged').weapons,1);
  assert.equal(saved.combatLoadout[8].alive,true);
});

test('distinct melee profiles and Extra Attacks respect per-model choices and scenario round trip', () => {
  const unit = scenarioUnit({models:2,combatLoadout:[model('Sword','Axe','Claws'),model('Axe')]},
    [{name:'Sword',phase:'melee'},{name:'Axe',phase:'melee'},{name:'Claws',phase:'melee',extra:true}]);
  assert.equal(countScenario(unit,'Axe','melee').weapons,null);
  unit.models[0].melee = 'Sword';
  setModelStatus(unit,0,'wounded');
  unit.models[0].wounds = 2;
  const restored = JSON.parse(JSON.stringify({ schemaVersion:1, attackerState:unit })).attackerState;
  assert.equal(restored.models[0].wounds,2);
  assert.deepEqual(countScenario(restored,'Sword','melee').slots,[0]);
  assert.deepEqual(countScenario(restored,'Axe','melee').slots,[1]);
  assert.equal(countScenario(restored,'Claws','melee').weapons,1);
  setModelStatus(restored,0,'destroyed');
  assert.equal(countScenario(restored,'Claws','melee').weapons,0);
});

test('quick groups confirm mixed survivors without double counting multi-weapon models', () => {
  const { bearerGroups, confirmedGroups } = require('../weapon-bearers.js');
  const unit = scenarioUnit({models:10, combatLoadout:[...Array.from({length:8},()=>model('Rifle','Pistol')),model('Plasma'),model('Heavy')]});
  unit.remaining = 9;
  const [rifles,plasma,heavy] = bearerGroups(unit);
  unit.survivors = {[rifles.key]:8,[plasma.key]:1,[heavy.key]:1};
  assert.equal(confirmedGroups(unit),null);
  unit.survivors[plasma.key] = 0;
  assert.ok(confirmedGroups(unit));
  assert.equal(countScenario(unit,'Plasma','ranged').weapons,0);
  assert.equal(countScenario(unit,'Pistol','ranged').weapons,8);
  const restored = JSON.parse(JSON.stringify(unit));
  assert.equal(countScenario(restored,'Heavy','ranged').weapons,1);
  assert.ok(restored.models.every(model => model.status === 'alive'));
  setModelStatus(restored,8,'destroyed');
  assert.equal(restored.remaining,9);
  assert.equal(countScenario(restored,'Plasma','ranged').weapons,0);
  setModelStatus(restored,8,'alive');
  assert.equal(restored.remaining,10);
  resetStrength(restored);
  assert.equal(restored.survivors,undefined);
});

test('advanced casualties remove an attached character and a special bearer independently', () => {
  const unit = scenarioUnit({ models:3, combatLoadout:[model('Rifle'),model('Heavy'),model('Character Blade','Pistol')] },
    [{name:'Character Blade',phase:'melee'}]);
  setModelStatus(unit,2,'destroyed');
  setModelStatus(unit,1,'destroyed');
  assert.equal(unit.remaining,1);
  assert.equal(countScenario(unit,'Character Blade','melee').weapons,0);
  assert.equal(countScenario(unit,'Heavy','ranged').weapons,0);
  assert.equal(countScenario(unit,'Rifle','ranged').weapons,1);
});
