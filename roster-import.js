/* Strict, side-effect-free validation of imported roster JSON. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.frRosterImport = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  function parse(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Roster must be an object');
    if (!Array.isArray(data.units)) throw Error('Missing units array');
    if (data.units.length > 1000) throw Error('Too many units');
    const limit = data.limit === undefined ? 2000 : data.limit;
    if (typeof limit !== 'number' || !Number.isSafeInteger(limit) || limit < 1 || limit > 10000) throw Error('Invalid points limit');
    const name = data.name === undefined ? 'Imported roster' : data.name;
    const faction = data.faction === undefined ? '' : data.faction;
    if (typeof name !== 'string' || name.length > 100 || typeof faction !== 'string' || faction.length > 120) throw Error('Invalid roster name or faction');
    const units = data.units.map((unit, i) => {
      if (!unit || typeof unit !== 'object' || Array.isArray(unit)) throw Error('Invalid unit at position ' + (i + 1));
      if (typeof unit.name !== 'string' || !unit.name.trim() || unit.name.length > 150) throw Error('Invalid unit name at position ' + (i + 1));
      if (typeof unit.points !== 'number' || !Number.isSafeInteger(unit.points) || unit.points < 0 || unit.points > 10000) throw Error('Invalid points at position ' + (i + 1));
      return { ...unit, name: unit.name.trim(), points: unit.points };
    });
    return { ...data, name, faction, limit, units };
  }
  return { parse };
});
