'use strict';

(() => {
  // Muster Armies 25.03–25.04: see docs/VALIDATION.md.
  const sizes = {
    1000: { dp: 2, enhancements: 2, copies: 2 },
    2000: { dp: 3, enhancements: 4, copies: 3 },
  };
  const list = value => Array.isArray(value) ? value : [];
  const key = value => String(value ?? '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
  const same = (left, right) => key(left) === key(right);
  const namesContain = (names, name) => list(names).some(entry => same(entry, name));
  const has = (profile, keyword) => namesContain(profile?.keywords, keyword);
  const find = (entries, name) => list(entries).find(item => same(item.name, name));
  const costNumber = value => (typeof value === 'number' || typeof value === 'string' && /^\d+$/.test(value))
    && Number.isSafeInteger(Number(value)) && Number(value) >= 0
    ? Number(value) : undefined;

  function withRules(faction, entries) {
    if (!faction) return faction;
    const relevant = list(entries).filter(item => !item.faction || same(item.faction, faction.name) || same(item.faction, faction.slug));
    return {
      ...faction,
      detachments: list(faction.detachments).map(detachment => {
        const restrictions = relevant.find(item => item.kind === 'detachment'
          && same(item.detachment || item.name, detachment.name));
        const fields = ['requiredUnits', 'forbiddenUnits', 'requiredDetachments', 'forbiddenDetachments', 'validationComplete'];
        return {
          ...detachment,
          ...Object.fromEntries(fields.filter(field => field === 'validationComplete' ? restrictions?.[field] === true : Array.isArray(restrictions?.[field]))
            .map(field => [field, restrictions[field]])),
          enhancements: list(detachment.enhancements).map(enhancement => {
            const rule = relevant.find(item => item.kind === 'enhancement'
              && same(item.detachment, detachment.name) && same(item.name, enhancement.name));
            const fields = ['requiredKeywords', 'eligibleUnits', 'upgrade', 'validationComplete'];
            return { ...enhancement, ...Object.fromEntries(fields.filter(field => rule?.[field] !== undefined)
              .map(field => [field, rule[field]])) };
          }),
        };
      }),
    };
  }

  function detachments(roster) {
    return Array.isArray(roster.detachments) ? roster.detachments : roster.detachment ? [roster.detachment] : [];
  }

  function attachmentRoles(unit) {
    const attachment = unit?.attachment;
    const entries = list(unit?.joins);
    if (entries.length) return entries.map(entry => ({
      role: key(entry.role),
      targets: list(entry.targets),
    }));
    const role = key(attachment?.role || unit?.role);
    return role ? [{ role, targets: list(attachment?.targets ?? attachment?.bodyguards ?? unit?.leads) }] : [];
  }

  function eligibility(unit, preferredRole) {
    const entries = attachmentRoles(unit);
    return (preferredRole ? entries.find(entry => entry.role === preferredRole) : entries[0]) || { role: '', targets: [] };
  }

  function profileFor(faction, unit, sheets, choices) {
    const catalogue = find(faction?.units, unit.name);
    const sheet = list(sheets).find(entry => same(entry.unit || entry.name, unit.name)
      && (!entry.faction || same(entry.faction, faction?.name) || same(entry.faction, faction?.slug))
      && (!entry.detachment || namesContain(choices, entry.detachment)));
    return { catalogue, sheet, profile: { ...catalogue, ...sheet } };
  }

  function pricingOptions(unit, ordinal) {
    const tiers = list(unit?.pricing);
    const tier = tiers.find(entry => {
      if (!entry.range) return true;
      const range = /^([\[(])(\d+)\s*,\s*(\d*|inf(?:inity)?|∞)([\])])$/i.exec(entry.range);
      if (!range) return false;
      const [, start, min, max, end] = range;
      const upper = /^\d+$/.test(max) ? Number(max) : Infinity;
      return (start === '[' ? ordinal >= Number(min) : ordinal > Number(min))
        && (end === ']' ? ordinal <= upper : ordinal < upper);
    });
    return list(tier?.costs).filter(item => !item.addon).map(item => ({
      ...item,
      points: costNumber(item.points),
      label: item.desc || item.models + ' models',
    })).filter(item => item.points !== undefined);
  }

  function priceFor(unit, ordinal, models, optionId) {
    if (!Number.isInteger(Number(models)) || Number(models) < 1) return undefined;
    const options = pricingOptions(unit, ordinal);
    const matching = options.filter(item => (optionId === undefined || optionId === '' || item.optionId === optionId)
      && (Number(item.models) === Number(models)
      || (item.minModels !== undefined && item.maxModels !== undefined
        && Number(models) >= Number(item.minModels) && Number(models) <= Number(item.maxModels))));
    return matching.length === 1 ? matching[0].points : undefined;
  }

  function enhancementSelections(roster, faction) {
    const selected = detachments(roster);
    return list(roster.enhancements).map(value => {
      const selection = typeof value === 'string' ? { name: value } : value ?? {};
      const matches = list(faction?.detachments)
        .filter(entry => selection.detachment ? same(entry.name, selection.detachment) : namesContain(selected, entry.name))
        .map(detachment => ({ detachment, enhancement: find(detachment.enhancements, selection.name) }))
        .filter(entry => entry.enhancement);
      return { ...selection, ...(matches.length === 1 ? matches[0] : {}) };
    });
  }

  function warlordEligibility(faction, unit, profile) {
    if (profile.cannotBeWarlord) return false;
    const rules = faction?.rosterRules;
    if (Array.isArray(rules?.warlordUnitNames)) return namesContain(rules.warlordUnitNames, unit.name);
    if (!Array.isArray(profile.keywords)) return null;
    return list(rules?.warlordKeywords).concat('Character').some(keyword => has(profile, keyword));
  }

  function validate(roster, faction, { sheets = [], pointOverride } = {}) {
    const errors = [], incomplete = [], notices = [];
    const size = sizes[Number(roster.limit)];
    const selected = detachments(roster);
    const selectedKeys = new Set(selected.map(key));
    const chosen = selected.map(name => find(faction?.detachments, name));
    const units = list(roster.units);
    const unitRecords = units.map(unit => ({ unit, ...profileFor(faction, unit, sheets, selected) }));
    const unitsById = new Map(unitRecords.filter(record => record.unit.id).map(record => [record.unit.id, record]));
    const unitNames = units.map(unit => unit.name);
    let dp = 0;
    let total = 0;
    const unitTotals = [];
    if (!size) incomplete.push('Set Incursion (1,000 points) or Strike Force (2,000 points) to check battle-size limits.');
    if (!faction?.units?.length) incomplete.push('Verified faction points are unavailable.');
    if (!selected.length && faction?.rosterRules?.requiresDetachment !== false) errors.push('Choose a detachment.');
    if (selectedKeys.size !== selected.length) errors.push('Use each detachment at most once.');
    for (const [index, detachment] of chosen.entries()) {
      if (!detachment) {
        (faction?.detachments?.length ? errors : incomplete).push(selected[index] + ': detachment unavailable in this faction catalogue.');
        continue;
      }
      if (!detachment.validationComplete) incomplete.push(detachment.name + ': detachment restrictions are not fully verified.');
      const value = costNumber(detachment.dp);
      if (value === undefined) incomplete.push(detachment.name + ': detachment point cost unavailable.');
      else dp += value;
      for (const [field, actual, required, description] of [
        ['requiredUnits', unitNames, true, 'requires unit'],
        ['forbiddenUnits', unitNames, false, 'prohibits unit'],
        ['requiredDetachments', selected, true, 'requires detachment'],
        ['forbiddenDetachments', selected, false, 'cannot be combined with detachment'],
      ]) {
        for (const name of list(detachment[field])) {
          if (namesContain(actual, name) !== required) errors.push(detachment.name + ' ' + description + ' ' + name + '.');
        }
      }
    }
    const dpLimit = Number(roster.limit) === 1000 && selected.length === 1 && dp === 3 ? 3 : size?.dp;
    if (dpLimit !== undefined && dp > dpLimit) errors.push('Detachments cost ' + dp + ' DP and the battle-size allowance is ' + dpLimit + ' DP.');

    const dispositions = [...new Set([...list(faction?.rosterRules?.dispositions), ...chosen.flatMap(entry => list(entry?.dispositions))])];
    if (roster.disposition && dispositions.length && !namesContain(dispositions, roster.disposition)) {
      errors.push(roster.disposition + ': unavailable from the selected detachments.');
    }
    if (!units.length) errors.push('Add at least one unit.');
    const counts = new Map();
    const roleCounts = new Map();
    for (const { unit, catalogue, sheet, profile } of unitRecords) {
      const { name } = unit;
      const unitKey = key(name);
      const ordinal = (counts.get(unitKey) || 0) + 1;
      counts.set(unitKey, ordinal);
      if (!catalogue) incomplete.push(name + ': faction eligibility and current points could not be verified.');
      if (unit.faction && !same(unit.faction, roster.faction) && !same(unit.faction, faction?.slug) && !catalogue) {
        incomplete.push(name + ': allied unit permission requires verification.');
      }
      if (profile.legends) notices.push(name + ': Legends entry. Confirm it is allowed by your event.');
      const knownKeywords = Array.isArray(profile.keywords);
      const coreLimit = has(profile, 'Epic Hero') ? 1 : size?.copies
        && size.copies * (has(profile, 'Battleline') || has(profile, 'Dedicated Transport') ? 2 : 1);
      const overrideLimit = Number.isInteger(profile.maxCopies) ? profile.maxCopies : Infinity;
      const copyLimit = Math.min(coreLimit ?? Infinity, overrideLimit);
      if (ordinal > copyLimit) {
        const message = name + ': copy ' + ordinal + ' exceeds the ' + copyLimit + '-unit limit.';
        if (knownKeywords || ordinal > overrideLimit || size && ordinal > size.copies * 2) errors.push(message);
        else incomplete.push(name + ': copy limit needs its datasheet keywords.');
      }
      if (!sheet || !Array.isArray(sheet.allowedWargear)) incomplete.push(name + ': complete equipment rules are unavailable.');
      if (Array.isArray(sheet?.modelCounts) && !sheet.modelCounts.map(Number).includes(Number(unit.models))) {
        errors.push(name + ': model count is outside the datasheet options.');
      }
      if (Number.isInteger(sheet?.minModels) && Number(unit.models) < sheet.minModels) {
        errors.push(name + ': choose at least ' + sheet.minModels + ' models.');
      }
      if (Number.isInteger(sheet?.maxModels) && Number(unit.models) > sheet.maxModels) {
        errors.push(name + ': choose at most ' + sheet.maxModels + ' models.');
      }
      const base = priceFor(catalogue, ordinal, unit.models, unit.optionId);
      const overridden = costNumber(pointOverride?.(roster.faction, name, unit.models)?.points);
      const savedPoints = costNumber(unit.points);
      if (base === undefined) incomplete.push(name + ': no official points match the selected model count and copy number.');
      if (overridden !== undefined && overridden !== base) incomplete.push(name + ': total uses a local points override.');
      if (savedPoints === undefined && base === undefined && overridden === undefined) errors.push(name + ': enter a valid point cost.');
      let unitTotal = overridden ?? base ?? savedPoints ?? 0;
      const gearCounts = new Map();
      for (const option of list(unit.wargear)) {
        const item = typeof option === 'string' ? option : option?.item;
        const quantity = typeof option === 'string' ? 1 : Number(option?.quantity);
        if (!item || !Number.isInteger(quantity) || quantity < 1) {
          errors.push(name + ': malformed equipment selection.');
          continue;
        }
        gearCounts.set(key(item), (gearCounts.get(key(item)) || 0) + quantity);
        const points = costNumber(list(catalogue?.wargear).find(entry => same(entry.item, item))?.points);
        if (points !== undefined) unitTotal += points * quantity;
        if (Array.isArray(sheet?.allowedWargear) && !namesContain(sheet.allowedWargear, item)) {
          errors.push(name + ': ' + item + ' is outside the installed datasheet’s equipment options.');
        }
      }
      for (const constraint of list(sheet?.wargearLimits)) {
        const count = gearCounts.get(key(constraint.item)) || 0;
        const max = Number.isInteger(constraint.maxPerUnit) ? constraint.maxPerUnit : Infinity;
        const perModels = Number.isInteger(constraint.perModels) && constraint.perModels > 0
          ? Math.floor(Number(unit.models) / constraint.perModels) : Infinity;
        if (count > Math.min(max, perModels)) errors.push(name + ': too many copies of ' + constraint.item + '.');
      }
      for (const requirement of list(sheet?.requiredSelections)) {
        const minimum = requirement.minimum ?? 1;
        if (Number.isSafeInteger(minimum) && minimum > 0 && (gearCounts.get(key(requirement.item)) || 0) < minimum) {
          errors.push(name + ': select at least ' + minimum + ' × ' + requirement.item + ' in equipment.');
        }
      }
      for (const group of list(sheet?.exclusiveWargearGroups)) {
        if (list(group).filter(item => gearCounts.get(key(item))).length > 1) {
          errors.push(name + ': choose only one of ' + group.join(', ') + '.');
        }
      }
      unitTotals.push(unitTotal);
      total += unitTotal;
      const { role, targets } = eligibility(profile, unit.attachmentRole);
      if (role === 'support' && !unit.attachedTo) errors.push(name + ': Support units require a bodyguard.');
      if (!unit.attachedTo) continue;
      const bodyguard = unitsById.get(unit.attachedTo);
      if (!bodyguard || bodyguard.unit === unit || bodyguard.unit.attachedTo) {
        errors.push(name + ': select a separate bodyguard from this roster.');
        continue;
      }
      if (role !== 'leader' && role !== 'support') {
        const issues = unit.attachmentRole && attachmentRoles(profile).length ? errors : incomplete;
        issues.push(name + ': Leader or Support role is unavailable for the attachment.');
        continue;
      }
      const slot = unit.attachedTo + ':' + role;
      roleCounts.set(slot, (roleCounts.get(slot) || 0) + 1);
      if (roleCounts.get(slot) > 1) errors.push(bodyguard.unit.name + ': only one ' + role + ' can attach to this bodyguard.');
      const matchingName = namesContain(targets, bodyguard.unit.name);
      const matchingKeywords = targets.some(target => {
        const keywords = Array.isArray(target?.keywords) ? target.keywords : null;
        return keywords?.length && keywords.every(keyword => has(bodyguard.profile, keyword));
      });
      if (!matchingName && !matchingKeywords) {
        // Some MFM rows describe open keyword groups instead of listing named datasheets.
        const uncertain = !targets.length || targets.some(target => typeof target !== 'string' || !find(faction?.units, target));
        (uncertain ? incomplete : errors).push(name + ': ' + bodyguard.unit.name + ' could not be matched to an eligible bodyguard.');
      }
    }

    if (units.length && !roster.warlord) errors.push('Choose a Warlord.');
    if (roster.warlord) {
      const warlord = unitsById.get(roster.warlord);
      const eligibility = warlord && warlordEligibility(faction, warlord.unit, warlord.profile);
      if (!warlord || eligibility === false) {
        errors.push('Choose an eligible faction unit as your Warlord.');
      } else if (eligibility === null) {
        incomplete.push(warlord.unit.name + ': Warlord eligibility needs datasheet keywords.');
      }
      const mandatory = unitRecords.filter(record => record.profile.mustBeWarlord && !record.profile.cannotBeWarlord);
      if (mandatory.length && !mandatory.some(record => record.unit.id === roster.warlord)) {
        errors.push('Choose a Warlord from the mandatory Warlord units.');
      }
    }

    const enhancementCounts = new Map();
    const used = new Set();
    for (const selection of enhancementSelections(roster, faction)) {
      const { name, detachment, enhancement, unitId } = selection;
      if (!enhancement || !selectedKeys.has(key(detachment?.name))) {
        (faction?.detachments?.length ? errors : incomplete).push((name || 'Enhancement') + ': unavailable from the selected detachments.');
        continue;
      }
      if (!enhancement.validationComplete) incomplete.push(name + ': enhancement restrictions are not fully verified.');
      const upgrade = enhancement.upgrade === true || has(enhancement, 'Upgrade');
      const count = (enhancementCounts.get(key(name)) || 0) + 1;
      enhancementCounts.set(key(name), count);
      if (count > (upgrade ? 3 : 1)) errors.push(name + ': too many copies of this enhancement.');
      const points = costNumber(enhancement.points);
      if (points === undefined) incomplete.push(name + ': point cost unavailable.');
      else total += points;
      const recipient = unitsById.get(unitId);
      if (!recipient) {
        errors.push(name + ': choose an eligible bearer from the roster.');
        continue;
      }
      const group = recipient.unit.attachedTo || unitId;
      if (used.has(group)) errors.push(name + ': a separate unit or attachment group is required.');
      used.add(group);
      const { profile } = recipient;
      if (has(profile, 'Epic Hero') || (!upgrade && Array.isArray(profile.keywords) && !has(profile, 'Character'))) {
        errors.push(name + ': ' + recipient.unit.name + ' is ineligible for this enhancement.');
      } else if (!Array.isArray(profile.keywords)) {
        incomplete.push(name + ': bearer eligibility needs datasheet keywords.');
      }
      if (Array.isArray(enhancement.eligibleUnits) && !namesContain(enhancement.eligibleUnits, recipient.unit.name)) {
        errors.push(name + ': only eligible datasheets can bear this enhancement.');
      }
      if (Array.isArray(profile.keywords) && list(enhancement.requiredKeywords).some(keyword => !has(profile, keyword))) {
        errors.push(name + ': bearer lacks a required keyword.');
      }
    }
    if (size && enhancementCounts.size > size.enhancements) errors.push('Too many distinct enhancements for this battle size.');
    if (costNumber(roster.limit) === undefined || Number(roster.limit) <= 0) errors.push('Enter a positive points limit.');
    else if (total > Number(roster.limit)) errors.push('Roster is ' + (total - Number(roster.limit)) + ' points over the limit.');
    return { total, unitTotals, dp, dpLimit, dispositions, errors: [...new Set(errors)], incomplete: [...new Set(incomplete)], notices: [...new Set(notices)] };
  }

  const api = { sizes, same, has, withRules, detachments, attachmentRoles, eligibility, profileFor, pricingOptions, priceFor, enhancementSelections, warlordEligibility, validate };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else window.ForgeRosterLegality = api;
})();
