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
