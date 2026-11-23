const test = require('node:test');
const assert = require('node:assert/strict');
const { parse } = require('../roster-import.js');
test('imports valid roster without dropping unit metadata', () => {
  const roster = parse({ name: 'Army', faction: 'Krieg', limit: 2000, units: [{ name: 'Infantry', points: 65, models: 10 }] });
  assert.equal(roster.units[0].models, 10);
});
test('rejects malformed imports instead of silently converting costs to zero', () => {
  for (const points of [-1, '100', null, NaN, 1.5, Infinity]) {
    assert.throws(() => parse({ limit: 2000, units: [{ name: 'Infantry', points }] }));
  }
});
test('rejects invalid limits, names, and excessive entries', () => {
  assert.throws(() => parse({ limit: -5, units: [] }));
  assert.throws(() => parse({ limit: 2000, units: [{ name: '', points: 10 }] }));
  assert.throws(() => parse({ limit: 2000, units: Array.from({ length: 1001 }, () => ({ name: 'X', points: 0 })) }));
});
