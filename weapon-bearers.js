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

  function scenarioUnit(unit, profiles = []) {
    const start = unit?.models;
    if (!Number.isInteger(start) || start < 1 || start > 100) return null;
    const loadout = valid(unit.combatLoadout, start) ? unit.combatLoadout : Array(start).fill(null);
    return {
      name: unit.name, start, profiles,
      remaining: start - loadout.filter(model => model?.alive === false).length,
      models: loadout.map(model => ({
        status: model?.alive === false ? 'destroyed' : 'alive',
        weapons: model ? [...model.weapons] : null,
        wounds: null, melee: '',
      })),
    };
  }

  function setModelStatus(unit, index, status) {
    if (!['alive','wounded','destroyed'].includes(status) || !unit.models[index]) return;
    const model = unit.models[index];
    if (model.status !== 'destroyed' && status === 'destroyed') {
      const known = unit.models.filter(row => row.status !== 'destroyed').length;
      if (known === unit.remaining) unit.remaining--;
    } else if (model.status === 'destroyed') unit.remaining++;
    if (model.status === 'destroyed' || status === 'destroyed') delete unit.survivors;
    model.status = status;
    if (status !== 'wounded') model.wounds = null;
  }

  function resetStrength(unit) {
    unit.remaining = unit.start;
    delete unit.survivors;
    for (const model of unit.models) { model.status = 'alive'; model.wounds = null; }
  }

  function bearerGroups(unit) {
    const groups = new Map();
    for (const model of unit.models) {
      if (model.status === 'destroyed') continue;
      const key = JSON.stringify([model.weapons ? [...model.weapons].sort() : null, model.melee || '', model.source || '']);
      const group = groups.get(key) || { key, weapons: model.weapons, melee: model.melee, source: model.source, size: 0 };
      group.size++;
      groups.set(key, group);
    }
    return [...groups.values()];
  }

  function confirmedGroups(unit) {
    const groups = bearerGroups(unit);
    if (!unit.survivors || !groups.every(g => Number.isInteger(unit.survivors[g.key]) &&
      unit.survivors[g.key] >= 0 && unit.survivors[g.key] <= g.size) ||
      groups.reduce((sum,g) => sum + unit.survivors[g.key],0) !== unit.remaining) return null;
    return groups;
  }

  function countScenario(unit, weapon, phase) {
    if (unit.remaining === 0) return { weapons: 0, issue: '' };
    const candidates = unit.models.filter(model => model.status !== 'destroyed');
    if (unit.remaining > candidates.length) return { weapons: null, issue: 'Restore a destroyed model in Manage Casualties.' };
    const profile = unit.profiles.find(p => p.id === weapon);
    const copiesFor = model => {
      if (profile?.source && model.source !== profile.source) return 0;
      if (profile?.ambiguous || !model.weapons) return null;
      const name = profile?.name || weapon;
      const amount = model.weapons.filter(item => item === name).length;
      const standardMelee = new Set(unit.profiles.filter(p => p.phase === 'melee' && !p.extra &&
        (!p.source || p.source === model.source)).map(p => p.name));
      if (!amount || phase !== 'melee' || !standardMelee.has(name)) return amount;
      const choices = new Set(model.weapons.filter(item => standardMelee.has(item)));
      if (choices.size > 1 && !choices.has(model.melee)) return null;
      return choices.size === 1 || model.melee === name ? 1 : 0;
    };
    const groups = confirmedGroups(unit);
    if (groups && unit.remaining < candidates.length) {
      const selected = groups.filter(g => unit.survivors[g.key] > 0);
      if (selected.every(g => copiesFor(g) !== null)) return {
        weapons: selected.reduce((sum,g) => sum + copiesFor(g) * unit.survivors[g.key],0), slots: null, issue: '',
      };
    }
    const copies = candidates.map(copiesFor);
    if (copies.includes(null)) return { weapons: null, issue: 'Confirm the bearer count manually or resolve the missing model equipment or melee choices.' };
    if (unit.remaining < candidates.length && new Set(copies).size > 1) {
      return { weapons: null, issue: 'Identify the lost models in Manage Casualties or enter a confirmed surviving weapon count.' };
    }
    return {
      weapons: unit.remaining < candidates.length ? unit.remaining * copies[0] : copies.reduce((a,b) => a+b,0),
      slots: unit.remaining === candidates.length
        ? unit.models.flatMap((model, i) => model.status !== 'destroyed' && copies[candidates.indexOf(model)] > 0 ? [i] : [])
        : null,
      issue: '',
    };
  }

  const api = { valid, countWeapons, scenarioUnit, setModelStatus, resetStrength, countScenario, bearerGroups, confirmedGroups };
  if (typeof module === 'object') module.exports = api;
  else window.ForgeRosterBearers = api;
})();
