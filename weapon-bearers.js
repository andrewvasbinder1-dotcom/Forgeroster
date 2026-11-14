'use strict';

(() => {
  function valid(loadout, count) {
    return Array.isArray(loadout) && loadout.length === count && count >= 1 && count <= 100 &&
      loadout.every(model => model === null || (typeof model?.alive === 'boolean' &&
        Array.isArray(model.weapons) && model.weapons.length <= 30 &&
        model.weapons.every(name => typeof name === 'string' && name.trim() && name.length <= 200)));
  }

  function countWeapons(loadout, count, weapon) {
    if (!valid(loadout, count) || loadout.includes(null)) return null;
    let bearers = 0, weapons = 0;
    for (const model of loadout) {
      if (!model.alive) continue;
      const copies = model.weapons.filter(name => name === weapon).length;
      if (copies) bearers++;
      weapons += copies;
    }
    return { bearers, weapons };
  }

  const api = { valid, countWeapons };
  if (typeof module === 'object') module.exports = api;
  else window.ForgeRosterBearers = api;
})();
