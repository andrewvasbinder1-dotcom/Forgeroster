/* ForgeRoster account-scoped cloud library.
   Requires supabase/rosters.sql applied in Supabase SQL Editor. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const style=document.createElement('style');style.textContent=`
#frLibrary{max-width:1080px;margin:14px auto;padding:0 12px}#frLibrary .fr-wrap{background:#151e30;border:1px solid #34435e;border-radius:14px;padding:16px}#frLibrary .fr-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}#frLibrary .fr-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin:12px 0}#frLibrary .fr-item{background:#101827;border:1px solid #34435e;border-radius:10px;padding:13px;min-width:0}#frLibrary .fr-item strong{display:block;overflow-wrap:anywhere}#frLibrary .fr-item small{display:block;color:#b2bfd6;margin:6px 0}#frLibrary button{margin:3px;min-height:44px}#frSyncStatus{font-size:13px;color:#b5c4e0}#frLibrary .fr-danger{color:#ffb9ad}#frLibrary .fr-current{border-color:#83a7e9}#frLibrary .fr-toolbar{display:flex;gap:8px;flex-wrap:wrap}#frLibrary .fr-error{color:#ffb5a8}@media(max-width:600px){#frLibrary{margin:8px auto;padding:0 10px}#frLibrary .fr-list{grid-template-columns:1fr}#frLibrary .fr-head{align-items:flex-start}#frLibrary button{flex:1}}
`;document.head.append(style);
const wrap=document.createElement('div');wrap.id='frLibrary';wrap.hidden=true;wrap.innerHTML='<div class="fr-wrap"><div class="fr-head"><div><h2 style="margin:0 0 6px">My Armies</h2><span id="frSyncStatus" role="status" aria-live="polite">Connecting…</span></div><div class="fr-toolbar"><button id="frNewCloud">+ New army</button><button id="frRefreshCloud">Refresh</button><button id="frImportLegacy" hidden>Import device roster</button><button id="frUseCloud" hidden>Discard local changes</button></div></div><div id="frCloudList" class="fr-list"></div></div>';
document.querySelector('main')?.before(wrap);
const storage = window.frRosterStorage;
const columns = 'id,name,faction,points_limit,roster_data,updated_at';
let account = null;

function status(message, error = false) {
  $('frSyncStatus').textContent = message;
  $('frSyncStatus').className = error ? 'fr-error' : '';
}

function record(roster) {
  const { name, faction, limit, ...rosterData } = roster;
  return {
    name: String(name || 'My Army').slice(0, 100),
    faction: String(faction || ''),
    points_limit: Math.min(10000, Math.max(1, Math.trunc(Number(limit) || 2000))),
    roster_data: rosterData
  };
}

function fromRow(row) {
  return {
    ...row.roster_data,
    name: row.name,
    faction: row.faction,
    limit: row.points_limit,
    units: Array.isArray(row.roster_data?.units) ? row.roster_data.units : []
  };
}

function acceptCloud(row) {
  storage.saveDraft(row.id, { roster: fromRow(row), updatedAt: row.updated_at, dirty: false });
}

function showConflict(message) {
  status(message, true);
  $('frUseCloud').hidden = false;
}

function draw(state) {
  const list = $('frCloudList');
  list.replaceChildren();
  $('frImportLegacy').hidden = !state.loaded || !storage.readGuest();
  for (const row of state.items) {
    const card = document.createElement('div');
    card.className = 'fr-item' + (row.id === state.active ? ' fr-current' : '');
    const title = document.createElement('strong');
    title.textContent = row.name;
    const detail = document.createElement('small');
    detail.textContent = row.faction + ' · ' + row.points_limit + ' pts';
    const open = document.createElement('button');
    open.textContent = row.id === state.active ? 'Open now' : 'Open';
    open.disabled = row.id === state.active;
    open.onclick = () => action(state, async () => {
      await flush(state);
      const fresh = await selectOwned(state).eq('id', row.id).maybeSingle();
      if (fresh.error) throw fresh.error;
      if (!fresh.data) throw Error('This army was removed. Refresh the library.');
      if (account === state) openRoster(state, fresh.data);
    });
    const del = document.createElement('button');
    del.className = 'fr-danger';
    del.textContent = 'Delete';
    del.onclick = () => {
      if (!confirm('Permanently delete ' + row.name + ' from your account?')) return;
      action(state, async () => {
        if (row.id === state.active) await flush(state);
        const revision = state.items.find(item => item.id === row.id)?.updated_at;
        if (!revision) throw Error('This army was removed.');
        const { data, error } = await state.client.from('rosters').delete()
          .eq('user_id', state.id).eq('id', row.id).eq('updated_at', revision).select('id');
        if (error) throw error;
        if (!data?.length) throw Error('This army changed on another device. Refresh the library before deleting.');
        if (account !== state) return;
        storage.discardDraft(row.id);
        if (state.active === row.id) openRoster(state, null);
        await refresh(state);
      });
    };
    card.append(title, detail, open, del);
    list.append(card);
  }
  if (state.loaded && !state.items.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No saved armies yet.';
    list.append(empty);
  }
}

// Include the owner in every read/update filter as a second check alongside RLS.
function selectOwned(state) {
  return state.client.from('rosters').select(columns).eq('user_id', state.id);
}

function openRoster(state, row) {
  const id = row?.id || null;
  state.active = id;
  $('frUseCloud').hidden = true;
  if (row && !storage.getDraft(id)?.dirty) acceptCloud(row);
  storage.open(id);
  if (row && storage.getDraft(id)?.dirty) queue(state);
  draw(state);
}

async function action(state, operation) {
  if (!state || state.action) return;
  state.action = true;
  try {
    await operation();
  } catch (error) {
    if (account === state && $('frUseCloud').hidden) status(error.message, true);
  } finally {
    state.action = false;
  }
}

async function refresh(state) {
  const { data, error } = await selectOwned(state).order('updated_at', { ascending: false });
  if (error) throw error;
  if (account !== state) return;
  state.items = data || [];
  const firstLoad = !state.loaded;
  state.loaded = true;
  const selected = firstLoad ? storage.selected() : state.active;
  const row = state.items.find(item => item.id === selected);
  const draft = selected ? storage.getDraft(selected) : null;
  if (draft?.dirty) {
    if (firstLoad) {
      state.active = selected;
      storage.open(selected);
    }
    if (!row || draft.updatedAt !== row.updated_at) {
      showConflict('This army changed on another device. Export your local edits or discard them to load the latest cloud version.');
    } else {
      queue(state);
    }
  } else if (firstLoad) {
    openRoster(state, row || state.items[0] || null);
  } else if (selected && (!row || !draft || draft.updatedAt !== row.updated_at)) {
    openRoster(state, row);
  }
  if (!draft?.dirty) status('Cloud connected · ' + state.items.length + ' saved armies');
  draw(state);
}

async function createRoster(roster) {
  const state = account;
  if (!state?.loaded) throw Error('Cloud storage is unavailable. Refresh and try again.');
  if (state.action) throw Error('Wait for the current library action to finish.');
  state.action = true;
  try {
    await flush(state);
    if (account !== state) return;
    const { data, error } = await state.client.from('rosters').insert({
      ...record(roster), user_id: state.id
    }).select(columns).single();
    if (error) throw error;
    if (account !== state) return;
    state.items.unshift(data);
    openRoster(state, data);
    status('Saved to cloud');
  } finally {
    state.action = false;
  }
}

async function saveChanges(state) {
  const id = state.active;
  let draft = id ? storage.getDraft(id) : null;
  while (account === state && draft?.dirty) {
    if (!draft.updatedAt) {
      showConflict('This roster predates revision tracking. Export your local edits or discard them to load the cloud version.');
      throw Error('Local and cloud revisions could not be compared.');
    }
    status('Saving to cloud…');
    const lastRevision = Date.parse(draft.updatedAt);
    if (!Number.isFinite(lastRevision)) throw Error('The cloud roster revision is invalid.');
    const nextRevision = new Date(Math.max(Date.now(), lastRevision + 1)).toISOString();
    const { data, error } = await state.client.from('rosters').update({
      ...record(draft.roster), updated_at: nextRevision
    })
      .eq('user_id', state.id).eq('id', id).eq('updated_at', draft.updatedAt).select(columns).maybeSingle();
    if (account !== state) return;
    if (error) throw error;
    if (!data) {
      showConflict('This army changed on another device. Export your local edits or discard them to load the latest cloud version.');
      throw Error('The cloud version changed before this edit could sync.');
    }
    const current = storage.getDraft(id);
    const changedWhileSaving = JSON.stringify(current.roster) !== JSON.stringify(draft.roster);
    draft = { ...current, updatedAt: data.updated_at, dirty: changedWhileSaving };
    storage.saveDraft(id, draft);
    state.items = state.items.map(item => item.id === id ? data : item);
  }
  if (id && account === state) {
    $('frUseCloud').hidden = true;
    status('Saved to cloud');
    draw(state);
  }
}

async function flush(state) {
  if (!state || account !== state) return;
  if (!state.loaded) {
    if (state.active && storage.getDraft(state.active)?.dirty) throw Error('Cloud is unavailable. Local changes are pending.');
    return;
  }
  clearTimeout(state.timer);
  if (!state.save) {
    state.save = saveChanges(state).finally(() => { state.save = null; });
  }
  await state.save;
}

function queue(state) {
  if (account !== state || !state || !state.active || !$('frUseCloud').hidden) return;
  clearTimeout(state.timer);
  status('Unsaved changes…');
  state.timer = setTimeout(() => {
    flush(state).catch(error => {
      if (account === state && $('frUseCloud').hidden) status('Not synced. ' + error.message, true);
    });
  }, 700);
}

function leave() {
  clearTimeout(account?.timer);
  account = null;
  storage.leaveAccount();
  wrap.hidden = true;
  $('frCloudList').replaceChildren();
}

function connect(client, user) {
  if (account?.id === user.id) return;
  leave();
  storage.enterAccount(user.id);
  document.dispatchEvent(new Event('fr-roster-opened'));
  const selected = storage.selected();
  const draft = selected ? storage.getDraft(selected) : null;
  account = { client, id: user.id, active: draft ? selected : null, items: [], loaded: false };
  if (draft) storage.open(selected);
  const state = account;
  window.frCreateCloudRoster = createRoster;
  $('frUseCloud').hidden = true;
  wrap.hidden = false;
  status('Connecting to cloud…');
  action(state, () => refresh(state));
}

$('frRefreshCloud').onclick = () => {
  const state = account;
  action(state, async () => {
    if ($('frUseCloud').hidden) {
      try { await flush(state); } catch { /* Refresh can reveal the conflicting revision. */ }
    }
    await refresh(state);
  });
};
$('frNewCloud').onclick = () => {
  const state = account;
  action(state, async () => {
    if (!state.loaded) throw Error('Cloud storage is unavailable. Refresh and try again.');
    await flush(state);
    if (account === state) openRoster(state, null);
  });
};
$('frUseCloud').onclick = () => {
  const state = account;
  if (!confirm('Discard unsynced edits to this army?')) return;
  action(state, async () => {
    const id = state.active;
    const { data, error } = await selectOwned(state).eq('id', id).maybeSingle();
    if (error) throw error;
    if (account !== state) return;
    storage.discardDraft(id);
    openRoster(state, data);
    await refresh(state);
  });
};
$('frImportLegacy').onclick = () => {
  const roster = storage.readGuest();
  if (!roster) return;
  createRoster(roster).catch(error => status(error.message, true));
};
document.addEventListener('fr-roster-saved', () => queue(account));
document.addEventListener('fr-user-signed-in', event => connect(event.detail.client, event.detail.user));
document.addEventListener('fr-user-signed-out', () => {
  leave();
  delete window.frCreateCloudRoster;
  document.dispatchEvent(new Event('fr-roster-opened'));
});
window.frFlushCloudRoster = () => flush(account);
function syncVisible() {
  const state = account;
  if (!state || document.visibilityState !== 'visible') return;
  action(state, async () => {
    if ($('frUseCloud').hidden) {
      try { await flush(state); } catch { /* Keep the offline draft, then try the library. */ }
    }
    await refresh(state);
  });
}
document.addEventListener('visibilitychange', syncVisible);
window.addEventListener('online', syncVisible);
window.addEventListener('focus', syncVisible);
setInterval(syncVisible, 30000);
})();
