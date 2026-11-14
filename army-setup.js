'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const check = window.ForgeRosterLegality;
  let owner;

  function options(select, placeholder, rows, current) {
    select.replaceChildren(new Option(placeholder, ''));
    for (const [value, label] of rows) select.add(new Option(label, value));
    select.value = String(current ?? '');
  }

  function unitLabel(units, index) {
    const unit = units[index];
    const sameName = units.filter(item => item.name === unit.name);
    return unit.name + (sameName.length > 1 ? ' #' + (sameName.indexOf(unit) + 1) : '');
  }

  function ensureUnitIds(roster) {
    const ids = new Set();
    for (const unit of roster.units || []) {
      if (!unit.id || ids.has(unit.id)) unit.id = crypto.randomUUID();
      ids.add(unit.id);
    }
    return roster;
  }

  function edit(mutator) {
    const roster = ensureUnitIds(owner.read());
    mutator(roster);
    owner.save(roster);
  }

  function labelRow(parent, text, onRemove) {
    const row = document.createElement('div');
    row.className = 'fr-row';
    const label = document.createElement('span');
    label.textContent = text;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Remove';
    button.setAttribute('aria-label', 'Remove ' + text);
    button.onclick = onRemove;
    row.append(label, button);
    parent.append(row);
  }

  function configure(read, save) {
    owner = { read, save };
    $('frSetupChoices').innerHTML = `
      <label for="frDetach">Detachment</label>
      <select id="frDetach"></select>
      <button type="button" id="frAddDetach">Add detachment</button>
      <div id="frDetachList"></div>
      <p id="frDp" class="fr-compact"></p>
      <label for="frDisposition">Force disposition</label>
      <select id="frDisposition"></select>
      <label for="frWarlord">Warlord</label>
      <select id="frWarlord"></select>
      <label for="frEnhance">Enhancement or upgrade</label>
      <select id="frEnhance"></select>
      <label for="frEnhRecipient">Bearer</label>
      <select id="frEnhRecipient"></select>
      <button type="button" id="frAddEnh">Assign enhancement</button>
      <div id="frEnhList"></div>
    `;
  }

  function compatible(targets, bodyguard) {
    return targets.some(target => typeof target === 'string'
      ? check.same(target, bodyguard.unit.name)
      : Array.isArray(target?.keywords) && target.keywords.length
        && target.keywords.every(keyword => check.has(bodyguard.profile, keyword)));
  }

  function render(roster, faction, result, sheets) {
    const units = roster.units || [];
    const detachments = check.detachments(roster);
    const records = units.map(unit => ({ unit, ...check.profileFor(faction, unit, sheets, detachments) }));
    const selected = (faction?.detachments || []).filter(detachment => detachments.some(name => check.same(name, detachment.name)));
    const detachSelect = $('frDetach'), addDetach = $('frAddDetach');
    const requiresDetachment = faction?.rosterRules?.requiresDetachment !== false;
    options(detachSelect, requiresDetachment ? 'Choose detachment' : 'Faction skips detachments', (faction?.detachments || [])
      .filter(item => !selected.includes(item)).map(item => [item.name, item.name + ' · ' + (item.dp ?? '?') + ' DP']));
    detachSelect.disabled = !requiresDetachment;
    addDetach.disabled = true;
    detachSelect.onchange = () => { addDetach.disabled = !detachSelect.value; };
    addDetach.onclick = () => {
      const name = detachSelect.value;
      if (!name) return;
      edit(current => {
        current.detachments = [...check.detachments(current), name];
        current.detachment = current.detachments[0];
      });
    };
    const dList = $('frDetachList');
    dList.replaceChildren();
    for (const [index, name] of detachments.entries()) labelRow(dList, name, () => edit(current => {
      current.detachments = check.detachments(current).filter((_, position) => position !== index);
      current.detachment = current.detachments[0] || '';
      if (current.disposition && !current.detachments.some(value => {
        const detachment = (faction?.detachments || []).find(item => check.same(item.name, value));
        return (detachment?.dispositions || []).includes(current.disposition);
      })) current.disposition = '';
    }));
    $('frDp').textContent = result.dp + ' / ' + (result.dpLimit ?? '—') + ' detachment points';
    options($('frDisposition'), 'Choose disposition', result.dispositions.map(name => [name, name]), roster.disposition);
    $('frDisposition').disabled = result.dispositions.length === 0;
    $('frDisposition').onchange = event => edit(current => { current.disposition = event.target.value; });

    const warlordOptions = records.flatMap(({ unit, profile }, index) => {
      const eligibility = check.warlordEligibility(faction, unit, profile);
      if (eligibility === false) return [];
      return [[index, unitLabel(units, index) + (eligibility === null ? ' (eligibility unverified)' : '')]];
    });
    const warlord = $('frWarlord');
    const warlordIndex = units.findIndex(unit => unit.id && unit.id === roster.warlord);
    options(warlord, 'Choose Warlord', warlordOptions, warlordIndex >= 0 ? warlordIndex : '');
    warlord.disabled = !warlordOptions.length;
    warlord.onchange = () => edit(current => {
      current.warlord = warlord.value ? current.units[Number(warlord.value)]?.id || '' : '';
    });

    const enhancements = selected.flatMap(detachment => (detachment.enhancements || [])
      .map(enhancement => ({ detachment: detachment.name, enhancement })));
    const enhSelect = $('frEnhance'), recipient = $('frEnhRecipient'), addEnh = $('frAddEnh');
    options(enhSelect, 'Choose enhancement', enhancements.map(({ detachment, enhancement }, index) =>
      [index, enhancement.name + ' · ' + (enhancement.points ?? '?') + ' pts · ' + detachment]));
    const drawRecipients = () => {
      const item = enhSelect.value && enhancements[Number(enhSelect.value)]?.enhancement;
      const eligible = item ? records.flatMap(({ profile, unit }, index) => {
        if (check.has(profile, 'Epic Hero')) return [];
        if (Array.isArray(item.eligibleUnits) && !item.eligibleUnits.some(name => check.same(name, unit.name))) return [];
        if (profile.keywords && (item.requiredKeywords || []).some(keyword => !check.has(profile, keyword))) return [];
        if (!item.upgrade && !check.has(item, 'Upgrade') && profile.keywords && !check.has(profile, 'Character')) return [];
        return [[index, unitLabel(units, index) + (profile.keywords ? '' : ' (eligibility unverified)')]];
      }) : [];
      options(recipient, 'Choose bearer', eligible);
      recipient.disabled = !eligible.length;
      addEnh.disabled = true;
    };
    enhSelect.onchange = drawRecipients;
    recipient.onchange = () => { addEnh.disabled = !recipient.value; };
    addEnh.onclick = () => {
      if (!enhSelect.value || !recipient.value) return;
      const { detachment, enhancement } = enhancements[Number(enhSelect.value)];
      edit(current => {
        current.enhancements ||= [];
        current.enhancements.push({
          name: enhancement.name,
          detachment,
          unitId: current.units[Number(recipient.value)]?.id,
        });
      });
    };
    drawRecipients();
    const eList = $('frEnhList');
    eList.replaceChildren();
    for (const [index, item] of (roster.enhancements || []).entries()) {
      const bearerIndex = units.findIndex(unit => unit.id && unit.id === item?.unitId);
      const label = typeof item === 'string' ? item : item?.name || 'Enhancement';
      labelRow(eList, label + (bearerIndex < 0 ? ' (unassigned)' : ' · ' + unitLabel(units, bearerIndex)),
        () => edit(current => { current.enhancements.splice(index, 1); }));
    }
  }

  function attachmentControl(roster, faction, sheets, index) {
    const units = roster.units;
    const detachments = check.detachments(roster);
    const records = units.map(unit => ({ unit, ...check.profileFor(faction, unit, sheets, detachments) }));
    const { unit, profile } = records[index];
    const roles = check.attachmentRoles(profile);
    const { role, targets } = check.eligibility(profile, unit.attachmentRole);
    if (!unit.attachedTo && role !== 'leader' && role !== 'support') return null;
    const choices = records.flatMap((bodyguard, bodyguardIndex) => {
      if (index === bodyguardIndex || bodyguard.unit.attachedTo) return [];
      if (bodyguard.unit.id && bodyguard.unit.id === unit.attachedTo) return [[bodyguardIndex, unitLabel(units, bodyguardIndex)]];
      const targetMatch = compatible(targets, bodyguard);
      if (!targetMatch && targets.length && targets.every(target => typeof target === 'string'
        && (faction?.units || []).some(entry => check.same(entry.name, target)))) return [];
      return [[bodyguardIndex, unitLabel(units, bodyguardIndex) + (targetMatch ? '' : ' (eligibility unverified)')]];
    });
    const wrapper = document.createElement('label');
    wrapper.className = 'fr-compact';
    wrapper.textContent = role === 'support' ? 'Support bodyguard' : 'Leader bodyguard';
    const select = document.createElement('select');
    const selectedIndex = units.findIndex(target => target.id && target.id === unit.attachedTo);
    options(select, 'No bodyguard', choices, selectedIndex >= 0 ? selectedIndex : '');
    select.onchange = () => edit(current => {
      current.units[index].attachedTo = select.value ? current.units[Number(select.value)]?.id || '' : '';
    });
    wrapper.append(select);
    if (roles.length < 2) return wrapper;

    const group = document.createElement('div');
    const roleLabel = document.createElement('label');
    roleLabel.className = 'fr-compact';
    roleLabel.textContent = 'Attachment role';
    const roleSelect = document.createElement('select');
    for (const entry of roles) {
      const roleName = entry.role;
      roleSelect.add(new Option(roleName[0].toUpperCase() + roleName.slice(1), roleName));
    }
    roleSelect.value = role;
    roleSelect.onchange = () => edit(current => {
      current.units[index].attachmentRole = roleSelect.value;
    });
    roleLabel.append(roleSelect);
    group.append(roleLabel, wrapper);
    return group;
  }

  window.ForgeRosterArmySetup = { configure, render, ensureUnitIds, attachmentControl };
})();
