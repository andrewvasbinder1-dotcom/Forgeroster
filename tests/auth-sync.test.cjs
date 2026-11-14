const { Script, createContext } = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vmFiles = Object.fromEntries(['roster-storage.js','cloud.js','auth.js'].map(filename => [filename, new Script(fs.readFileSync(path.join(__dirname, '..', filename), 'utf8'))]));
const db = new Map();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function site() {
  const ids = new Map();
  const document = new EventTarget();
  function node(tag) {
    const el = new EventTarget();
    el.tagName = tag;
    el.children = [];
    el.append = (...nodes) => el.children.push(...nodes);
    el.before = () => {};
    el.replaceChildren = () => { el.children.length = 0; };
    el.classList = { add() {}, remove() {} };
    el.setAttribute = () => {};
    el.showModal = () => { el.open = true; };
    el.close = () => { el.open = false; el.dispatchEvent(new Event('close')); };
    el.previousElementSibling = {};
    el.value = '';
    Object.defineProperties(el, {
      id: { set(id) { ids.set(id, el); } },
      innerHTML: { set(html) { for (const match of html.matchAll(/id="([^"]+)"/g)) node('div').id = match[1]; } }
    });
    return el;
  }
  document.createElement = node;
  document.getElementById = id => ids.get(id);
  document.head = node('head');
  document.body = node('body');
  document.visibilityState = 'visible';
  const header = node('header');
  const main = node('main');
  document.querySelector = selector => selector === 'header' ? header : main;
  const window = new EventTarget();
  window.FORGEROSTER_SUPABASE = {url:'https://public.example.com',anonKey:'test-only'};
  let callback;
  let identity;
  function authEvent(event) { callback(event, identity ? {user:identity} : null); }
  window.supabase = {
    createClient() { return {
      auth: {
        onAuthStateChange(fn) { callback = fn; authEvent('INITIAL_SESSION'); },
        async signInWithPassword({email}) { identity={id:email,email}; authEvent('SIGNED_IN'); return {}; },
        async signOut() { identity=null; authEvent('SIGNED_OUT'); return {}; },
        async updateUser() { return {data:{user:identity}}; }
      },
      from() {
        let type = 'select', payload, single = false;
        const filters = {};
        return {
          select() { return this; },
          insert(value) { type = 'insert'; payload = value; return this; },
          update(value) { type = 'update'; payload = value; return this; },
          eq(field,value) { filters[field] = value; return this; },
          order() { return this; },
          single() { single = true; return this; },
          maybeSingle() { single = true; return this; },
          then(resolve) {
            let rows = Array.from(db.values()).filter(row => Object.entries(filters).every(([key,value]) => row[key] === value));
            assert.equal(type === 'insert' ? payload.user_id : filters.user_id, identity.id);
            if (type === 'insert') {
              const row = {...payload,id:String(db.size+1), updated_at:new Date(Date.now()-5000).toISOString()};
              rows = [row];
              db.set(row.id,row);
            }
            if (type === 'update') {
              rows = rows.map(old => {
                const row = {...old,...payload};
                db.set(row.id,row);
                return row;
              });
            }
            resolve({data:single ? rows[0] || null : rows});
          }
        };
      }
    }; }
  };
  const makeStorage = () => {
    const values = new Map();
    return {
      setItem:(key,value) => values.set(key,value),
      getItem:key => values.get(key) || null,
      removeItem:key => values.delete(key)
    };
  };
  const context = createContext({
    window,document,setTimeout,clearTimeout,setInterval:() => {},confirm:() => true,
    localStorage:makeStorage(),sessionStorage:makeStorage(),Event,CustomEvent,location:{
      origin:'http://localhost',pathname:'/',search:'',hash:''
    }
  });
  for (const script of Object.values(vmFiles)) script.runInContext(context);
  return {
    window, document, ids,
    async signIn(address) {
      await sleep(10);
      ids.get('frAuthOpen').onclick();
      ids.get('frEmail').value = address;
      ids.get('frPassword').value = 'test-only-password';
      await ids.get('frAuthForm').onsubmit({preventDefault() {}});
      await sleep(10);
      assert.match(ids.get('frSyncStatus').textContent,/Cloud connected/);
    },
    authEvent
  };
}

test('device rosters and cloud sessions isolate accounts and preserve conflicting edits', async () => {
  const one = site();
  const storage = one.window.frRosterStorage;
  const deviceArmy = {name:'Guest',faction:'Deathwatch',units:[],limit:2000,extensions:{a:1}};
  storage.write(deviceArmy);
  assert.equal(storage.read().name, 'Guest');
  await one.signIn('first@example.com');
  assert.equal(storage.read(), null);
  await one.window.frCreateCloudRoster(deviceArmy);
  assert.equal(db.get('1').roster_data.extensions.a, 1);
  storage.write({...storage.read(),name:'One'});
  await one.window.frFlushCloudRoster();
  assert.equal(db.get('1').name,'One');
  const two = site();
  await two.signIn('first@example.com');
  assert.equal(two.window.frRosterStorage.read().name,'One');
  two.window.frRosterStorage.write({...two.window.frRosterStorage.read(),name:'Two'});
  await two.window.frFlushCloudRoster();
  storage.write({...storage.read(),name:'Conflict'});
  await assert.rejects(one.window.frFlushCloudRoster(), /changed/);
  assert.equal(storage.read().name,'Conflict');
  assert.equal(one.ids.get('frUseCloud').hidden,false);
  one.ids.get('frUseCloud').onclick();
  await sleep(10);
  assert.equal(storage.read().name,'Two');
  await one.ids.get('frAuthOpen').onclick();
  await sleep(10);
  assert.equal(storage.read().name,'Guest');
  await one.signIn('second@example.com');
  assert.equal(storage.read(),null);
  one.authEvent('PASSWORD_RECOVERY');
  await sleep(10);
  assert.equal(one.ids.get('frSubmit').textContent,'Save password');
  await one.ids.get('frAuthForm').onsubmit({preventDefault() {}});
  assert.equal(one.ids.get('frAuthGate').hidden,true);
});
