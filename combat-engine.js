'use strict';

(() => {
  const source = {
    name: 'Warhammer 40,000 11e Core Rules · June 2026',
    url: 'https://www.warhammer-community.com/en-gb/articles/nhqt9wx3/new40k-rules-download-the-free-core-rules-now/',
  };
  const definitions = {
    Blast: ['ranged', 1], Torrent: ['ranged'], 'Rapid Fire': ['ranged', 1], Melta: ['ranged', 1],
    Assault: ['ranged'], Heavy: ['ranged'], 'Indirect Fire': ['ranged'], 'Ignores Cover': ['ranged'],
    Pistol: ['ranged'], 'Close-Quarters': ['ranged'], 'One Shot': ['ranged'],
    Lance: ['melee'], 'Extra Attacks': ['melee'], Cleave: ['melee', 1],
    Hazardous: ['both'], 'Lethal Hits': ['both'], 'Sustained Hits': ['both', 1],
    'Devastating Wounds': ['both'], 'Twin-Linked': ['both'], Anti: ['both', 4],
    Precision: ['both'], Psychic: ['both'],
  };
  const example = {
    phase: 'ranged', models: 1, copies: 1, attacks: '4', skill: 3, strength: 8, ap: -2,
    damage: '2', toughness: 6, save: 3, wounds: 3, targets: 1, inv: 0, fnp: 0,
    range: 24, distance: 12, visible: true, inShootingPhase: true, keywords: [],
  };
  const d6 = [1, 2, 3, 4, 5, 6];
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const norm = v => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const num = (v, fallback = 0) => v === '' || v == null ? fallback : Number(v);
  const add = (map, k, p) => { if (p) map.set(k, (map.get(k) || 0) + p); };
  const mean = map => [...map].reduce((sum, [v, p]) => sum + v * p, 0);
  function pmf(expr) {
    const str = String(expr).replace(/\s/g, '').toUpperCase();
    if (/^\d{1,3}$/.test(str)) return new Map([[Number(str), 1]]);
    const match = /^(\d?)D([36])([+-]\d{1,2})?$/.exec(str);
    if (!match || match[1] === '0') throw Error('Use a whole number or dice notation such as D6, 2D6 or D3+1.');
    let result = new Map([[Number(match[3] || 0), 1]]);
    for (let i = 0; i < Number(match[1] || 1); i++) {
      const next = new Map();
      for (const [n, p] of result) for (let d = 1; d <= Number(match[2]); d++) add(next, n + d, p / Number(match[2]));
      result = next;
    }
    return result;
  }
  function rollExpression(expr, die) {
    const match = /^(\d?)D([36])([+-]\d{1,2})?$/i.exec(String(expr).replace(/\s/g, ''));
    if (!match) return { value: Number(expr), dice: [] };
    const dice = Array.from({ length: Number(match[1] || 1) }, () => die(Number(match[2])));
    return { value: dice.reduce((sum, face) => sum + face, Number(match[3] || 0)), dice };
  }
  function keyword(text) {
    const label = String(text).trim();
    const anti = /^anti[-–‑ ](.+?)\s+([2-6])\+$/i.exec(label);
    if (anti) return { name: 'Anti', target: anti[1], value: Number(anti[2]), label };
    for (const [name, [, fallback]] of Object.entries(definitions)) {
      if (norm(label) === norm(name)) return { name, value: fallback, label };
      const prefix = label.slice(0, name.length);
      const value = label.slice(name.length).trim();
      if (fallback !== undefined && norm(prefix) === norm(name) && /^(?:\d+|D[36])$/i.test(value)) {
        return { name, value, label };
      }
    }
    return { name: label, label };
  }
  function weaponPhase(profile) {
    return /^melee$/i.test(String(profile.range).trim()) ? 'melee' : profile.kind;
  }
  function woundThreshold(s, t) {
    if (s >= 2 * t) return 2;
    if (s > t) return 3;
    if (s === t) return 4;
    return 2 * s <= t ? 6 : 5;
  }
  function classify(face, threshold, critical, modifier = 0, floor = 2) {
    if (face < floor) return 0;
    if (face >= critical) return 2;
    return face + modifier >= threshold ? 1 : 0;
  }
  function eligible(face, mode, result) {
    return mode === 'ones' ? face === 1 : mode === 'all' || mode === 'failures' && !result;
  }
  function outcomes(classifier, reroll) {
    const result = [0, 0, 0];
    for (const face of d6) {
      const outcome = classifier(face);
      if (eligible(face, reroll, outcome) && !outcome) {
        for (const next of d6) result[classifier(next)] += 1 / 36;
      } else result[outcome] += 1 / 6;
    }
    return result;
  }
  function compile(input) {
    const c = { ...example, ...input };
    const effects = [], warnings = [];
    const keywords = new Map();
    const flag = (pass, label) => { if (!pass) throw Error(label); };
    const bounded = (name, low, high, fallback) => {
      const value = num(c[name], fallback);
      flag(Number.isInteger(value) && value >= low && value <= high, name + ' must be a whole number from ' + low + ' to ' + high + '.');
      return value;
    };
    const phase = c.phase === 'melee' ? 'melee' : 'ranged';
    for (const raw of c.keywords || []) {
      const k = typeof raw === 'string' ? keyword(raw) : raw;
      if (!Object.hasOwn(definitions, k.name)) { warnings.push(k.name + ' requires manual configuration.'); continue; }
      const [type] = definitions[k.name];
      if (type !== 'both' && type !== phase) { warnings.push(k.name + ' is unavailable in this phase.'); continue; }
      if (keywords.has(k.name)) { warnings.push('Choose one instance of ' + k.name + ' under §24.02. The first is used.'); continue; }
      keywords.set(k.name, k);
    }
    const unverifiedCount = warnings.length;
    const has = name => keywords.has(name);
    const value = name => keywords.get(name)?.value;
    const fixed = name => {
      const n = Number(value(name));
      flag(Number.isInteger(n) && n >= 0 && n <= 20, name + ' needs a whole-number value from 0 to 20.');
      return n;
    };
    const exactCount = c.weaponCountOverride != null && c.weaponCountOverride !== '';
    flag(exactCount || c.models !== '', 'Enter the number of eligible attacking models.');
    const weaponCount = exactCount ? bounded('weaponCountOverride', 0, 2000, 0) :
      bounded('models', 1, 100, 1) * bounded('copies', 1, 20, 1);
    const models = bounded('targets', 1, 100, 1);
    const wounds = bounded('wounds', 1, 100, 3);
    const first = bounded('firstWounds', 1, wounds, wounds);
    const hp = (models - 1) * wounds + first;
    const starts = num(c.targetStart, models);
    flag(Number.isInteger(starts) && starts >= models && starts <= 100, 'Model count when targets were selected must be at least the remaining model count.');
    const range = num(c.range), distance = num(c.distance);
    if (rangedProfileNeedsRange()) throw Error('Enter the weapon range to resolve the selected ability.');
    function rangedProfileNeedsRange() {
      return phase === 'ranged' && !range && (has('Rapid Fire') || has('Melta'));
    }
    flag(Number.isFinite(range) && range >= 0 && Number.isFinite(distance) && distance >= 0, 'Enter valid nonnegative range and distance.');
    const ranged = phase === 'ranged';
    const half = ranged && range > 0 && distance <= range / 2;
    const indirect = ranged && (c.indirect || !c.visible) && has('Indirect Fire');
    const torrent = has('Torrent');
    if (ranged && range && distance > range) warnings.push('Target is out of range.');
    if (ranged && !c.visible && !indirect) warnings.push('Target is not visible and Indirect Fire is unavailable.');
    if (ranged && c.advanced && !has('Assault')) warnings.push('Advancing requires an eligible Assault weapon.');
    if (ranged && c.advanced && c.engaged) warnings.push('Assault shooting requires an unengaged unit.');
    if (ranged && c.engaged && !c.vehicle && !has('Pistol') && !has('Close-Quarters')) warnings.push('Engaged non-Vehicle/Monster needs a Close-Quarters weapon.');
    if (indirect && (torrent || has('Precision') || c.engaged || c.advanced)) warnings.push('Selected weapon or unit cannot use indirect shooting in this situation.');
    if (ranged && c.targetEngaged && !c.engaged && !c.targetVehicle && !indirect) warnings.push('An engaged target must qualify for standard shooting as a Monster or Vehicle.');
    if (ranged && has('Blast') && (c.targetEngaged || c.engagingTarget)) warnings.push('Blast cannot target these engaged models.');
    if (ranged && c.engaged && !c.vehicle && !c.engagingTarget) warnings.push('Close-Quarters shooting requires a target engaging the attacking unit.');
    if (ranged && c.targetEngaged && c.targetVehicle && !c.inShootingPhase && !c.engagingTarget) warnings.push('The engaged Vehicle / Monster targeting exception applies in your Shooting phase.');
    if (ranged && c.fellBack) warnings.push('Fallback shooting requires a separate permission. Uncheck this only after confirming that permission.');
    if (ranged && !has('Indirect Fire') && c.indirect && !c.visible) warnings.push('Indirect shooting cannot make this weapon target an unseen unit.');
    if (has('One Shot') && c.used) warnings.push('This One Shot weapon has already been used.');
    const blocked = warnings.length > unverifiedCount || has('Torrent') && (has('Indirect Fire') || has('Precision'));

    let bonus = 0;
    if (has('Blast')) {
      const amount = fixed('Blast') * Math.floor(starts / 5);
      bonus += amount; effects.push('Blast · +' + amount + ' attacks per weapon (§24.05)');
    }
    if (has('Cleave') && !c.split) {
      const amount = fixed('Cleave') * Math.floor(starts / 5);
      bonus += amount; effects.push('Cleave · +' + amount + ' attacks per weapon (§24.06)');
    }
    if (has('Rapid Fire') && half) { bonus += fixed('Rapid Fire'); effects.push('Rapid Fire · extra attacks at half range (§24.30)'); }
    const melta = has('Melta') && half ? fixed('Melta') : 0;
    if (melta) effects.push('Melta · +' + melta + ' damage at half range (§24.25)');
    const cover = ranged && (c.cover || c.stealth || indirect) && !has('Ignores Cover');
    if (cover) effects.push((c.stealth ? 'Stealth / cover' : 'Cover') + ' · worsens BS by 1 (§13.08)');
    if (has('Ignores Cover')) effects.push('Ignores Cover · removes the cover penalty (§24.18)');
    if (indirect) effects.push('Indirect Fire · cover, no hit rerolls, and natural-roll minimum (§10.07)');
    const heavy = ranged && has('Heavy') && c.inShootingPhase && !c.engaged && !c.entered && c.movedKnown && num(c.moved) <= 3;
    const lance = has('Lance') && c.charged;
    if (heavy) effects.push('Heavy · +1 to hit (§24.16)');
    if (lance) effects.push('Lance · +1 to wound (§24.22)');
    for (const name of ['strength', 'toughness', 'save', 'skill', 'ap', 'wounds']) {
      flag(c[name] !== '', 'Enter ' + name + ' before calculating.');
    }
    const rawSkill = c.skill === '-' && torrent ? 6 : bounded('skill', 2, 6, 3);
    const skill = clamp(rawSkill + (has('Psychic') && c.ignoreSkill ? 0 : num(c.skillMod) + Number(cover)), 2, 6);
    const close = has('Pistol') || has('Close-Quarters');
    const engagedPenalty = ranged && !(close && c.engaged && c.engagingTarget) &&
      (c.engaged && c.vehicle || c.targetEngaged && c.targetVehicle);
    if (ranged && c.engaged && c.vehicle && engagedPenalty) effects.push('Close-Quarters shooting · −1 to hit (§10.06)');
    if (ranged && c.targetEngaged && c.targetVehicle && engagedPenalty) effects.push('Engaged Vehicle / Monster target · −1 to hit (§17.03)');
    const engagementMod = Number(Boolean(engagedPenalty && c.engaged && c.vehicle)) + Number(Boolean(engagedPenalty && c.targetEngaged && c.targetVehicle));
    const hitMod = has('Psychic') && c.ignoreHit ? 0 : clamp(num(c.hitMod) + num(c.defHit) + Number(heavy) - engagementMod, -1, 1);
    const woundMod = clamp(num(c.woundMod) + num(c.defWound) + Number(lance), -1, 1);
    const strength = Math.max(1, bounded('strength', 1, 100, 8) + num(c.strengthMod));
    const toughness = Math.max(1, bounded('toughness', 1, 100, 6) + num(c.toughnessMod));
    const wound = woundThreshold(strength, toughness);
    const anti = keywords.get('Anti');
    const targetWords = String(c.targetKeywords || '').split(/[,;]+/).map(norm);
    const antiActive = anti?.target && targetWords.includes(norm(anti.target));
    if (has('Torrent') && (has('Indirect Fire') || has('Precision'))) warnings.push('Torrent cannot be combined with Indirect Fire or Precision under the 11e Rules Appendix. Remove the invalid keyword.');
    if (anti && !anti.target) warnings.push('Anti requires a target keyword.');
    const antiValue = antiActive ? Number(anti.value) : 6;
    flag(Number.isInteger(antiValue) && antiValue >= 2 && antiValue <= 6, 'Anti threshold must be 2+ through 6+.');
    if (antiActive) effects.push('Anti-' + anti.target + ' · critical wounds on natural ' + antiValue + '+ (§24.03)');
    if (has('Precision') && !c.defensiveGroups) warnings.push('Precision needs a visible Character allocation group. Set up that group manually; overflow to bodyguards is unavailable.');
    const critHit = bounded('critHit', 2, 6, 6);
    const critWound = Math.min(bounded('critWound', 2, 6, 6), antiValue);
    const hitFloor = indirect ? c.stationary && c.spotter ? 4 : 6 : 2;
    const hit = face => classify(face, skill, critHit, hitMod, hitFloor);
    const woundRoll = face => classify(face, wound, critWound, woundMod);
    const armour = Math.max(2, bounded('save', 2, 7, 3) - num(c.saveMod)) -
      Math.min(0, bounded('ap', -30, 0, -2) + num(c.apMod));
    const inv = bounded('inv', 0, 6, 0);
    flag(inv !== 1, 'The invulnerable save cannot be 1+.');
    const save = Math.max(2, Math.min(armour, inv || Infinity));
    const fnp = bounded('fnp', 0, 6, 0);
    const attackPmf = pmf(c.attacks), damagePmf = pmf(c.damage);
    const attackMod = bonus + num(c.attackMod);
    const sustainedExpr = has('Sustained Hits') ? value('Sustained Hits') : 0;
    const sustained = pmf(sustainedExpr);
    const damageMod = melta - bounded('reduce', 0, 100, 0) + num(c.damageMod);
    const prevent = bounded('prevent', 0, 100, 0);
    const damage = amount => Math.max(0, Math.max(1, amount + damageMod) - prevent);
    const attacks = amount => blocked ? 0 : Math.max(1, amount + attackMod);
    flag([...attackPmf.keys()].every(n => n >= 0) && [...damagePmf.keys()].every(n => n >= 0), 'Dice expressions cannot generate negative characteristics.');
    flag(Math.max(...attackPmf.keys()) + attackMod <= 300 &&
      weaponCount * Math.max(1, Math.max(...attackPmf.keys()) + attackMod) <= 2000, 'Reduce the attack pool to 2,000 dice or fewer.');
    flag(Math.max(...damagePmf.keys()) + damageMod <= 150 && Math.max(...sustained.keys()) <= 20, 'Damage and Sustained Hits exceed the calculator limits.');
    for (const key of ['moved', 'skillMod', 'hitMod', 'defHit', 'woundMod', 'defWound', 'strengthMod', 'toughnessMod', 'saveMod', 'apMod', 'attackMod', 'damageMod']) {
      flag(Number.isSafeInteger(num(c[key])) && Math.abs(num(c[key])) <= 100, 'Enter a valid whole number for ' + key + '.');
    }
    const woundReroll = has('Twin-Linked') ? 'all' : c.woundReroll;
    const hitReroll = indirect || torrent ? '' : c.hitReroll;
    const lethal = has('Lethal Hits') && c.useLethal !== false;
    const dev = has('Devastating Wounds');
    for (const [name] of keywords) if (!effects.some(x => x.startsWith(name + ' ') || x.startsWith(name + '-'))) effects.push(name + ' · selected');
    if (c.note) effects.push('Manual effect · ' + c.note);
    if (hitMod || woundMod) effects.push('Net roll modifiers after caps · hit ' + hitMod + ', wound ' + woundMod + ' (§02.02.01)');
    const hazard = has('Hazardous') && !blocked ? weaponCount : 0;
    const groups = parseDefensiveGroups(c.defensiveGroups, c.saveMod, armour - Math.max(2, num(c.save, 3) - num(c.saveMod)));
    if (groups.length && groups.length !== models) throw Error('Defensive group counts must add up to Remaining models.');
    if (groups.length && starts < groups.length) throw Error('Select Targets count cannot be smaller than the defensive groups.');
    const selectedCharacter = has('Precision') && c.precisionTarget ? Number(c.precisionTarget) : 0;
    if (selectedCharacter && (!Number.isInteger(selectedCharacter) || !groups[selectedCharacter - 1]?.character || !c.precisionVisible)) {
      throw Error('Precision requires a selected visible Character group.');
    }
    if (groups.length) effects.push('Mixed groups · ordered saves and per-model Feel No Pain. Probability uses seeded simulation.');
    if (selectedCharacter) effects.push('Precision · Character group ' + selectedCharacter + ' receives attacks first (§24.28).');
    const keywordActive = {
      'Rapid Fire': half, Melta: half, Heavy: heavy, Lance: lance, Anti: Boolean(antiActive),
      'Lethal Hits': lethal && !torrent, 'Sustained Hits': !torrent, 'Indirect Fire': indirect,
      'Ignores Cover': Boolean(c.cover || c.stealth || indirect), Precision: Boolean(selectedCharacter),
      Blast: starts >= 5, Cleave: starts >= 5 && !c.split, Psychic: Boolean(c.ignoreHit || c.ignoreSkill),
      'Close-Quarters': Boolean(c.engaged && c.engagingTarget), Pistol: Boolean(c.engaged && c.engagingTarget),
      Assault: Boolean(c.advanced), Hazardous: hazard > 0,
    };
    const keywordActivity = Object.fromEntries([...keywords.keys()].map(name =>
      [name, blocked || !weaponCount ? 'unavailable' : keywordActive[name] === false ? 'inactive' : 'active']));
    return {
      groups, selectedCharacter, keywordActivity, cover,
      c, hit, woundRoll, save, armour, inv, wound, skill, effects, warnings, blocked, torrent, lethal, dev,
      hitReroll, woundReroll, sustainedExpr, sustained, attacks, damage, attackPmf, damagePmf,
      weaponCount, models, wounds, hp: groups.length ? groups.reduce((total, g) => total + g.hp, 0) : hp, first, fnp, hazard,
      hazardDamage: c.hazardVehicle ? 3 : 1,
      hitNeeded: torrent ? 0 : d6.find(d => hit(d)) || 7,
      woundNeeded: d6.find(d => woundRoll(d)) || 7,
    };
  }

  // One row per model, in the defender's allocation order.
  function parseDefensiveGroups(text, saveMod, penetration) {
    if (String(text || '').length > 10000) throw Error('Defensive group input is too long.');
    if (!String(text || '').trim()) return [];
    const groups = [];
    let seenCharacter = false, seenHealthyBodyguard = false, seenHealthyCharacter = false;
    for (const [index, value] of String(text).trim().split(/\n/).entries()) {
      const line = value.trim();
      if (!line) continue;
      if (!/^\d+(?:\s*,\s*\d+){6}$/.test(line)) throw Error('Enter seven comma-separated numbers per defensive group.');
      const [count, max, armour, inv, fnp, first, char] = line.split(',').map(Number);
      if (count < 1 || max < 1 || max > 100 || armour < 2 || armour > 7 || inv === 1 || inv > 6 ||
          fnp === 1 || fnp > 6 || first < 1 || first > max || char > 1 ||
          char && (count !== 1 || first < max && seenHealthyCharacter) || !char && (seenCharacter || first < max && seenHealthyBodyguard) ||
          groups.length + count > 100) throw Error('Check defensive group values and allocation order.');
      if (char) { seenCharacter = true; seenHealthyCharacter ||= first === max; }
      else if (first === max || count > 1) seenHealthyBodyguard = true;
      for (let i = 0; i < count; i++) groups.push({
        group: index + 1, hp: i === 0 ? first : max, character: Boolean(char), fnp,
        save: Math.min(Math.max(2, armour - num(saveMod)) + penetration, inv || Infinity),
      });
    }
    return groups;
  }

  function takeDamage(remaining, damage, modelWounds, first, total) {
    if (!remaining) return 0;
    const active = remaining === total ? first : (remaining - 1) % modelWounds + 1;
    return remaining - Math.min(active, damage);
  }
  const kills = (plan, remaining) => plan.models - Math.ceil(remaining / plan.wounds);
  function damageOutcomes(plan) {
    const result = new Map();
    for (const [raw, p] of plan.damagePmf) {
      const count = plan.damage(raw);
      let dist = new Map([[0, 1]]);
      const keep = plan.fnp ? (plan.fnp - 1) / 6 : 1;
      for (let i = 0; i < count; i++) {
        const next = new Map();
        for (const [v, prob] of dist) {
          add(next, v + 1, prob * keep);
          add(next, v, prob * (1 - keep));
        }
        dist = next;
      }
      for (const [v, prob] of dist) add(result, v, p * prob);
    }
    return result;
  }
  function calculate(plan, starting = new Map([[plan.hp, 1]])) {
    if (plan.groups.length) return { method: 'Mixed defenses require simulation', tooComplex: true };
    const [, normalHit, criticalHit] = plan.torrent ? [0, 1, 0] : outcomes(plan.hit, plan.hitReroll);
    const [, normalWound, criticalWound] = outcomes(plan.woundRoll, plan.woundReroll);
    const failed = d6.filter(d => d < plan.save).length / 6;
    const woundsPerHit = normalWound + criticalWound;
    const saveWounds = normalWound + (plan.dev ? 0 : criticalWound);
    const damageDist = damageOutcomes(plan);
    const attackCount = [...plan.attackPmf].reduce((total, [n, p]) => total + plan.attacks(n) * p, 0) * plan.weaponCount;
    const automatic = plan.lethal ? criticalHit : 0;
    const hits = normalHit + criticalHit * (1 + mean(plan.sustained));
    const rolled = hits - automatic;
    const wounds = rolled * woundsPerHit + automatic;
    const criticalWounds = rolled * criticalWound;
    const failedSaves = (rolled * saveWounds + automatic) * failed;
    const inflicted = failedSaves + (plan.dev ? criticalWounds : 0);
    const stats = {
      attacks: attackCount, hits: attackCount * hits, criticalHits: attackCount * criticalHit,
      wounds: attackCount * wounds, criticalWounds: attackCount * criticalWounds,
      failedSaves: attackCount * failedSaves, rawDamage: attackCount * inflicted * mean(damageDist),
      expectedHazard: plan.hazard * plan.hazardDamage / 3,
    };
    const damageHit = saveWounds * failed + (plan.dev ? criticalWound : 0);
    const apply = (state, chance) => {
      const next = new Map();
      for (const [hp, p] of state) {
        add(next, hp, p * (1 - chance));
        for (const [n, q] of damageDist) add(next, takeDamage(hp, n, plan.wounds, plan.first, plan.hp), p * q * chance);
      }
      return next;
    };
    const mix = (out, state, scale) => { for (const [hp, p] of state) add(out, hp, p * scale); };
    const attack = state => {
      const next = new Map();
      mix(next, state, 1 - normalHit - criticalHit);
      if (normalHit) mix(next, apply(state, damageHit), normalHit);
      if (criticalHit) {
        let result = apply(state, plan.lethal ? failed : damageHit);
        for (const [extra, p] of plan.sustained) {
          let branch = result;
          for (let j = 0; j < extra; j++) branch = apply(branch, damageHit);
          mix(next, branch, p * criticalHit);
        }
      }
      return next;
    };
    const attackMax = Math.max(...Array.from(plan.attackPmf.keys(), plan.attacks));
    const work = plan.weaponCount * attackMax * Math.min(plan.hp + 1, 1 + plan.weaponCount * attackMax * 10) *
      damageDist.size * (2 + Math.max(...plan.sustained.keys()));
    if (work > 6_000_000) return { ...stats, method: 'Exact expected rolls only', tooComplex: true };
    let state = starting;
    for (let j = 0; j < plan.weaponCount && attackMax; j++) {
      let branch = state;
      const next = new Map();
      const attackCounts = new Map();
      for (const [n, p] of plan.attackPmf) add(attackCounts, plan.attacks(n), p);
      for (let n = 0; n <= attackMax; n++) {
        if (attackCounts.has(n)) mix(next, branch, attackCounts.get(n));
        if (n < attackMax) branch = attack(branch);
      }
      state = next;
    }
    return summarize(plan, state, stats, 'Exact probability');
  }
  function summarize(plan, state, stats, method) {
    const damage = new Map(), casualties = new Map();
    for (const [hp, p] of state) {
      add(damage, plan.hp - hp, p);
      add(casualties, kills(plan, hp), p);
    }
    return {
      ...stats, state, damage, casualties, method, remaining: mean(state),
      appliedDamage: mean(damage), destroyed: state.get(0) || 0, expectedKills: mean(casualties),
    };
  }
  function secureDie(sides = 6) {
    if (!globalThis.crypto?.getRandomValues) return Math.floor(Math.random() * sides) + 1;
    const buffer = new Uint32Array(1);
    const limit = 2 ** 32 - (2 ** 32 % sides);
    do { globalThis.crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
    return buffer[0] % sides + 1;
  }
  function seededDie(seed) {
    let state = Number(seed) >>> 0;
    return (sides = 6) => {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      return Math.floor(state / 2 ** 32 * sides) + 1;
    };
  }

  function live(plan, die = secureDie, initial = plan.hp, log = true) {
    const history = [];
    let stage = -1, dice = [], hits = 0, automatic = 0, mortal = 0, failedSaves = 0;
    const modelHp = plan.groups.length ? (Array.isArray(initial) ? [...initial] : plan.groups.map(g => g.hp)) : null;
    const sumHp = values => values.reduce((sum, hp) => sum + hp, 0);
    const initialHp = modelHp ? sumHp(modelHp) : initial;
    let result = { hp: initialHp, kills: modelHp ? modelHp.filter(hp => !hp).length : kills(plan, initialHp), damage: 0, hazard: 0 };
    if (modelHp) result.modelHp = modelHp;
    const actions = ['Roll attacks', 'Roll hits', 'Roll wounds', 'Roll saving throws', 'Roll Feel No Pain', 'Resolve damage and casualties'];
    function note(label, values) { if (log) history.push({ label, values: [...values] }); }
    function rolls(count, classifier, reroll) {
      return Array.from({ length: count }, () => {
        const face = die(6), outcome = classifier(face);
        return { face, outcome, eligible: eligible(face, reroll, outcome), rerolled: false };
      });
    }
    function reroll(indices) {
      const active = stage === 1 ? plan.hit : stage === 2 ? plan.woundRoll : null;
      if (!active) return;
      const changes = [];
      for (const i of new Set(indices)) {
        const row = dice[i];
        if (!row?.eligible || row.rerolled) continue;
        const next = die(6);
        changes.push(row.face + ' → ' + next);
        Object.assign(row, { face: next, outcome: active(next), rerolled: true, eligible: false });
      }
      if (changes.length) note(actions[stage] + ' · rerolls', changes);
    }
    let attacks = 0, woundCount = 0, pending = [];
    function next() {
      if (stage >= actions.length - 1) return;
      stage++;
      if (stage === 0) {
        for (let i = 0; i < plan.weaponCount && !plan.blocked; i++) {
          const roll = rollExpression(plan.c.attacks, die);
          const amount = plan.attacks(roll.value);
          attacks += amount;
          note('Weapon ' + (i + 1) + ' attack count', [...roll.dice, '= ' + amount]);
        }
        dice = [];
      } else if (stage === 1) {
        dice = plan.torrent ? [] : rolls(attacks, plan.hit, plan.hitReroll);
        note(plan.torrent ? 'Torrent automatic hits' : 'Hits', plan.torrent ? [attacks] : dice.map(d => d.face));
      } else if (stage === 2) {
        hits = plan.torrent ? attacks : dice.filter(d => d.outcome).length;
        for (const hit of dice.filter(d => d.outcome === 2)) {
          if (plan.lethal) automatic++;
          const extra = rollExpression(plan.sustainedExpr, die);
          hits += extra.value;
          if (extra.value) note('Sustained extra hits', [...extra.dice, '= ' + extra.value]);
        }
        if (automatic) note('Lethal automatic wounds', [automatic]);
        dice = rolls(hits - automatic, plan.woundRoll, plan.woundReroll);
        note('Wounds', dice.map(d => d.face));
      } else if (stage === 3) {
        mortal = plan.dev ? dice.filter(d => d.outcome === 2).length : 0;
        woundCount = automatic + dice.filter(d => d.outcome).length;
        if (mortal) note('Devastating wounds bypass saves', [mortal]);
        dice = rolls(woundCount - mortal, d => Number(d >= plan.save), '');
        if (modelHp) {
          dice.sort((a,b) => a.face - b.face);
          for (const d of dice) d.outcome = undefined;
        }
        note('Saves', dice.map(d => d.face));
      } else if (stage === 4) {
        const saveDice = dice;
        failedSaves = modelHp ? 0 : saveDice.filter(d => !d.outcome).length;
        let hp = initialHp;
        pending = modelHp ? [...saveDice, ...Array(mortal).fill(null)] :
          [...Array(failedSaves).fill({}), ...Array(mortal).fill(null)];
        const fnpDice = [];
        for (const saveDie of pending) {
          if (!hp) break;
          const preferred = modelHp && plan.selectedCharacter ? plan.groups.findIndex((g, i) =>
            g.group === plan.selectedCharacter && g.character && modelHp[i] > 0) : -1;
          const target = modelHp ? (preferred >= 0 ? preferred : modelHp.findIndex(w => w > 0)) : -1;
          const group = plan.groups[target];
          if (group && saveDie) {
            saveDie.outcome = Number(saveDie.face >= group.save);
            note('Save against group ' + group.group + ' (' + group.save + '+)', [saveDie.face, saveDie.outcome ? 'passed' : 'failed']);
            if (saveDie.outcome) continue;
            failedSaves++;
          }
          const rolled = rollExpression(plan.c.damage, die);
          const amount = plan.damage(rolled.value);
          const threshold = group?.fnp ?? plan.fnp;
          const prevention = threshold ? rolls(amount, d => Number(d >= threshold), '') : [];
          fnpDice.push(...prevention);
          const loss = amount - prevention.filter(d => d.outcome).length;
          if (modelHp) {
            const applied = Math.min(modelHp[target], loss);
            modelHp[target] -= applied;
            hp -= applied;
          } else hp = takeDamage(hp, loss, plan.wounds, plan.first, plan.hp);
          note((saveDie ? 'Normal damage' : 'Devastating damage') + (group ? ' · group ' + group.group : ''),
            [...rolled.dice, '= ' + amount, 'FNP', ...prevention.map(d => d.face)]);
        }
        dice = fnpDice;
        result = { ...result, hp, kills: modelHp ? modelHp.filter(w => !w).length : kills(plan, hp), damage: initialHp - hp };
      } else {
        dice = rolls(plan.hazard, d => Number(d > 2), '');
        result.hazard = dice.filter(d => !d.outcome).length * plan.hazardDamage;
        if (dice.length) note('Hazardous rolls', dice.map(d => d.face));
        note('Damage / destroyed models / self mortal wounds', [result.damage, result.kills, result.hazard]);
      }
    }
    return {
      get stage() { return stage; }, get action() { return actions[stage + 1]; }, get dice() { return dice; },
      get result() { return result; }, get history() { return history; },
      get totals() { return { attacks, hits, wounds: woundCount, failedSaves }; },
      next, reroll,
      finish() {
        while (stage < actions.length - 1) {
          if (stage === 1 || stage === 2) reroll(dice.flatMap((d, i) => d.eligible && !d.outcome ? [i] : []));
          next();
        }
        return result;
      },
    };
  }
  function simulate(plans, samples, seed) {
    if (!Number.isInteger(samples) || samples < 100 || samples > 50000) throw Error('Choose 100–50,000 samples.');
    const initial = plans[0], state = new Map(), die = seededDie(seed);
    const cost = plans.reduce((a, p) => a + p.weaponCount * Math.max(...Array.from(p.attackPmf.keys(), p.attacks)), 0);
    if (samples * cost > 8_000_000) throw Error('Use fewer samples for this attack pool.');
    const casualties = new Map();
    for (let i = 0; i < samples; i++) {
      let remaining = initial.hp, rolled;
      for (const plan of plans) {
        rolled = live(plan, die, remaining, false).finish();
        remaining = rolled.modelHp || rolled.hp;
      }
      add(state, rolled.hp, 1 / samples);
      add(casualties, rolled.kills, 1 / samples);
    }
    const result = summarize(initial, state, {}, 'Monte Carlo · ' + samples + ' samples · seed ' + seed);
    return { ...result, casualties, expectedKills: mean(casualties) };
  }
  const api = { revision: '11e-combat-1', source, definitions, example, keyword, weaponPhase, woundThreshold, pmf, compile, calculate, live, simulate, seededDie };
  if (typeof module === 'object') module.exports = api;
  else window.ForgeRosterCombat = api;
})();
