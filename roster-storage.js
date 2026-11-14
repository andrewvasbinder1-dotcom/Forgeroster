/* The renderer sees only the roster selected for the current session. */
(() => {
  'use strict';
  const legacyKey = 'forgeroster-roster-v1';
  const guestKey = 'fr-device-roster-v2';
  let owner = null;
  let accountReady = false;
  let signedIn = false;
  let active = null;

  function read(key, store) {
    try {
      const data = JSON.parse(store.getItem(key) || 'null');
      return data;
    } catch {
      return null;
    }
  }
  function draftKey(id) {
    return 'fr-draft-' + owner + '-' + id;
  }
  function readGuest() {
    const device = read(guestKey, localStorage);
    const roster = device || (localStorage.getItem('fr-owner') ? null : read(legacyKey, localStorage));
    return Array.isArray(roster?.units) ? roster : null;
  }
  function readRoster() {
    if (!signedIn) return readGuest();
    if (!accountReady || !active) return null;
    return read(draftKey(active), sessionStorage)?.roster || null;
  }
  function writeRoster(roster) {
    if (!signedIn) {
      localStorage.setItem(guestKey, JSON.stringify(roster));
      return;
    }
    if (!accountReady || !active) throw new Error('Select an army to edit.');
    const draft = read(draftKey(active), sessionStorage);
    sessionStorage.setItem(draftKey(active), JSON.stringify({ ...draft, roster, dirty: true }));
  }
  function enterAccount(id) {
    signedIn = true;
    accountReady = false;
    active = null;
    owner = id;
  }
  function leaveAccount() {
    accountReady = false;
    active = null;
    owner = null;
    signedIn = false;
  }
  function getDraft(id) {
    const draft = read(draftKey(id), sessionStorage);
    if (Array.isArray(draft?.roster?.units)) return draft;

    // Older builds used a global key. Only its recorded owner may migrate it.
    if (localStorage.getItem('fr-owner') !== owner ||
        sessionStorage.getItem('fr-active-' + owner) !== id) return null;
    const legacy = read(legacyKey, localStorage);
    if (!Array.isArray(legacy?.units)) return null;
    const migrated = { roster: legacy, updatedAt: null, dirty: true };
    saveDraft(id, migrated);
    localStorage.removeItem(legacyKey);
    localStorage.removeItem('fr-owner');
    return migrated;
  }
  function saveDraft(id, draft) {
    sessionStorage.setItem(draftKey(id), JSON.stringify(draft));
  }
  function open(id) {
    accountReady = true;
    active = id;
    const key = 'fr-active-' + owner;
    if (id) sessionStorage.setItem(key, id);
    else sessionStorage.removeItem(key);
    document.dispatchEvent(new Event('fr-roster-opened'));
  }
  window.frRosterStorage = {
    read: readRoster,
    write: writeRoster,
    readGuest,
    enterAccount,
    leaveAccount,
    getDraft,
    saveDraft,
    discardDraft(id) { sessionStorage.removeItem(draftKey(id)); },
    selected() { return sessionStorage.getItem('fr-active-' + owner); },
    open
  };
})();
