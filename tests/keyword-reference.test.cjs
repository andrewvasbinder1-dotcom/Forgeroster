const {test} = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../combat-engine.js');
const reference = require('../keyword-reference.js');

test('every calculator weapon ability resolves to a unique edition-scoped reference', () => {
  const ids = new Set();
  for (const name of Object.keys(engine.definitions)) {
    const rule = reference.resolve(name);
    assert.equal(rule.handler, name);
    assert.equal(rule.edition, 11);
    assert.equal(rule.revision, reference.revision);
    assert.ok(rule.source.url.startsWith('https://assets.warhammer-community.com/'));
    assert.ok(!ids.has(rule.id));
    ids.add(rule.id);
  }
  assert.equal(reference.resolve('Vehicle').handler, null);
  assert.equal(reference.resolve('Vehicle').category, 'Unit keyword');
});

test('parameterized references show the actual values and reject malformed inputs', () => {
  assert.match(reference.resolve('Rapid Fire 2').description, /2 attacks/);
  assert.match(reference.resolve('Anti-Infantry 4+').description, /Infantry.*4\+/);
  assert.match(reference.resolve('Feel No Pain 5+').description, /5\+/);
  assert.match(reference.resolve('Sustained Hits D3').description, /D3 additional/);
  assert.equal(reference.resolve('Rapid Fire').valid, false);
  assert.equal(reference.resolve({name:'Melta',value:'bad'}).valid, false);
  assert.equal(reference.resolve({name:'Anti',target:53,value:4}).valid, false);
  assert.equal(reference.resolve('Unsupported ability').status, 'Definition unavailable');
});

test('activation reports the same half-range and eligibility used by attack resolution', () => {
  const keywords = ['Rapid Fire 1','Melta 2','Ignores Cover'];
  const at = distance => engine.compile({...engine.example, keywords, distance});
  assert.equal(at(12).keywordActivity['Rapid Fire'], 'active');
  assert.equal(at(12).attacks(4), 5);
  assert.equal(at(12).damage(2), 4);
  assert.equal(at(12.1).keywordActivity['Rapid Fire'], 'inactive');
  assert.equal(at(12.1).attacks(4), 4);
  assert.equal(at(12.1).keywordActivity.Melta, 'inactive');
  assert.equal(at(24.1).keywordActivity.Melta, 'unavailable');
  assert.equal(at(12).keywordActivity['Ignores Cover'], 'inactive');
  assert.equal(engine.compile({...engine.example,keywords,cover:true}).keywordActivity['Ignores Cover'], 'active');
});

test('conditional effects distinguish inactive, active and blocked combinations', () => {
  const plan = options => engine.compile({...engine.example,...options});
  assert.equal(plan({keywords:['Anti-Infantry 4+'],targetKeywords:'Vehicle'}).keywordActivity.Anti, 'inactive');
  assert.equal(plan({keywords:['Anti-Infantry 4+'],targetKeywords:'Infantry, Character'}).keywordActivity.Anti, 'active');
  assert.equal(plan({keywords:['Torrent','Lethal Hits']}).keywordActivity['Lethal Hits'], 'inactive');
  assert.equal(plan({keywords:['Torrent','Precision']}).keywordActivity.Torrent, 'unavailable');
  assert.equal(plan({keywords:['Hazardous'],weaponCountOverride:0}).keywordActivity.Hazardous, 'unavailable');
});

test('faction index keeps existing scoped summaries and missing definitions separate', () => {
  const catalogue = require('../data/mfm.json');
  const packs = require('../data/rules/bundled.json').packs;
  const index = reference.factionIndex(catalogue, packs);
  assert.equal(index.size, catalogue.factions.length);
  const votann = index.get('Leagues of Votann');
  const efficiency = votann.find(record => record.name === 'Prioritised Efficiency' && record.category === 'Faction rule');
  assert.ok(efficiency.summary.text.length > 0);
  assert.match(efficiency.source, /^https:\/\/www\.warhammer-community\.com\//);
  assert.ok(votann.some(record => record.category === 'Detachment'));
  assert.ok(votann.some(record => record.name === 'Hearthkyn Warriors' && !record.summary));
});

test('scenario replay refuses unknown rule revisions and labels legacy scenarios', () => {
  const pinned = {keywordReferenceRevision: reference.revision, combatEngineRevision: engine.revision};
  assert.equal(reference.replayStatus(pinned, engine.revision), 'pinned');
  assert.equal(reference.replayStatus({}, engine.revision), 'legacy');
  assert.equal(reference.replayStatus({...pinned, combatEngineRevision:'older-engine'}, engine.revision), 'unavailable');
  assert.equal(reference.replayStatus({...pinned, keywordReferenceRevision:'older-reference'}, engine.revision), 'unavailable');
});
