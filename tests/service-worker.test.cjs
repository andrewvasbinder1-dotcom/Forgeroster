const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function worker({ network, cache }) {
  const handlers = {};
  vm.runInNewContext(fs.readFileSync(require.resolve('../sw.js'), 'utf8'), {
    URL, Request, Response, fetch: network, caches: { open: async () => cache },
    self: { registration: { scope: 'https://example.test/Forgeroster/' },
      addEventListener: (name, handler) => { handlers[name] = handler; } },
  });
  return (path, mode) => {
    let result;
    handlers.fetch({ request: { method:'GET', url:'https://example.test/Forgeroster/' + path, mode },
      respondWith: promise => { result = promise; } });
    return result;
  };
}

test('offline navigation preserves the installed shell and mismatched asset revisions pass through', async () => {
  const lookedUp = [];
  const handle = worker({ network: async () => { throw Error('offline'); }, cache: {
    match: async key => { lookedUp.push(key); return new Response('installed'); },
  } });
  assert.equal(await (await handle('?release=other','navigate')).text(),'installed');
  assert.equal(await (await handle('combat.js?v=20261114.13','same-origin')).text(),'installed');
  assert.equal(handle('combat.js?v=another-release','same-origin'),undefined);
  assert.deepEqual(lookedUp,['https://example.test/Forgeroster/','https://example.test/Forgeroster/combat.js?v=20261114.13']);
});

test('cache quota errors preserve the network response and online navigation leaves the installed shell intact', async () => {
  let writes = 0;
  const handle = worker({ network: async () => new Response('network'), cache: {
    put: async () => { writes++; throw Error('quota'); },
  } });
  assert.equal(await (await handle('combat.js?v=20261114.13','same-origin')).text(),'network');
  assert.equal(await (await handle('','navigate')).text(),'network');
  assert.equal(writes,1);
});
