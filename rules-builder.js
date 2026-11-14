(()=>{'use strict';
const $=id=>document.getElementById(id);
const legality=window.ForgeRosterLegality, armySetup=window.ForgeRosterArmySetup;
const css=document.createElement('style');css.textContent=`
#frRules{display:none;max-width:1150px;margin:12px auto;padding:12px}body.fr-building #frRules{display:block}body.fr-building main{display:none!important}
#frRules .fr-shell{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,360px);gap:14px}#frRules .fr-panel{background:#151e30;border:1px solid #35445d;border-radius:14px;padding:15px;min-width:0}#frRules h2{margin:4px 0 12px;font-size:21px}#frRules .fr-row{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin:10px 0}#frRules select,#frRules input{width:100%;min-width:0}#frRules .fr-unit{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid #33425c}#frRules .fr-unit strong{display:block}#frRules .fr-unit small{display:block;color:#acbbd3}#frRules .fr-unit button{white-space:nowrap}#frRules .fr-flag{color:#ffca81}#frRules .fr-good{color:#a2e3b0}#frRules .fr-compact{font-size:13px;color:#acbbd3}#frRules .fr-heading{display:flex;justify-content:space-between;gap:8px;align-items:center}#frRules .fr-total{font-size:28px;font-weight:800}#frRules .fr-pill{background:#263a5b;border-radius:8px;padding:7px 10px}#frRules .fr-enh{display:flex;align-items:center;gap:6px}#frRules .fr-enh input{width:auto}#frRules .fr-actions{display:flex;gap:8px;flex-wrap:wrap}#frRules .fr-actions button{flex:1}#frRules .fr-warning{background:#3d2c1d;border-radius:8px;padding:10px;margin:8px 0;color:#ffddae}
@media(max-width:760px){#frRules{padding:8px}#frRules .fr-shell{display:flex;flex-direction:column}#frRules .fr-panel{padding:13px}#frRules .fr-unit button{min-height:44px}#frRules .fr-heading{align-items:flex-start}#frRules .fr-total{font-size:25px}}
`;document.head.append(css);
const root=document.createElement('div');root.id='frRules';root.innerHTML=`<div class="fr-heading"><div><h2 id="frArmyTitle">Army builder</h2><div id="frRosterOverview" class="fr-compact"></div><div id="frMfmVersion" class="fr-compact">Loading imported points…</div></div><div id="frArmyTotal" class="fr-total">0 pts</div></div><div class="fr-shell"><div class="fr-panel"><h2>Add units</h2><input id="frFindUnit" placeholder="Search faction units" aria-label="Search units"><div class="fr-filter-row"><input id="frKeywordFilter" placeholder="Role or keyword" aria-label="Filter by role or keyword"><input id="frCostFilter" type="number" min="0" placeholder="Maximum points" aria-label="Maximum unit points"></div><div id="frUnitsAvailable"></div></div><div class="fr-panel"><h2>Army setup</h2><div id="frLimitLabel" class="fr-compact"></div><div id="frSetupChoices"></div><h2>My roster</h2><div id="frRosterUnits"></div><h2>List checks</h2><div id="frValidation"></div><div class="fr-actions"><button id="frExportRules">Export JSON</button><button id="frExportText">Export text</button><button id="frUndo" disabled>Undo edit</button><label class="fr-import-button">Import JSON<input id="frImportRules" type="file" accept=".json,application/json"></label><button id="frRefreshRules">Update points</button></div></div></div>`;
document.querySelector('main')?.before(root);
let db=null,loadError='';
function read(){return window.frRosterStorage.read()}
let undoRoster = null;
function save(r, keepUndo = true){if(keepUndo) undoRoster = read();if(!r.rulesSnapshot && db?.meta?.version) r.rulesSnapshot = { edition: 11, revision: db.meta.version, effectiveDate: db.meta.lastUpdated };armySetup.ensureUnitIds(r);window.frRosterStorage.write(r);document.dispatchEvent(new Event('fr-roster-saved'));draw()}
function normal(v){return String(v||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'')}
function faction(r){return db?.factions?.find(f=>normal(f.name)===normal(r.faction)||normal(f.slug)===normal(r.faction))}
function opts(u,count){return legality.pricingOptions(u,count)}
function cost(u,count,models,optionId){const r=read();const override=window.ForgeRosterPoints?.lookup(r?.faction,u.name,models);return override?override.points:legality.priceFor(u,count,models,optionId)}
armySetup.configure(read,save);
function node(tag,txt){const n=document.createElement(tag);n.textContent=txt;return n}
function profileTable(rows, columns) {
  const wrapper = node('div', '');
  wrapper.className = 'fr-profile-table';
  const table = document.createElement('table');
  const row = table.createTHead().insertRow();
  for (const [label] of columns) {
    const heading = node('th', label);
    heading.scope = 'col';
    row.append(heading);
  }
  const body = table.createTBody();
  for (const item of rows) {
    const line = body.insertRow();
    for (const [, field] of columns) line.insertCell().textContent = item[field] ?? '—';
  }
  wrapper.append(table);
  return wrapper;
}

function showUnitProfile(unit, faction) {
  const detail = document.createElement('details');
  detail.className = 'fr-unit-profile';
  detail.append(node('summary', 'Unit profile'));
  detail.addEventListener('toggle', () => {
    if (!detail.open || detail.children.length > 1) return;
    if (unit.keywords?.length) detail.append(node('p', unit.keywords.join(' · ')));
    if (unit.stats?.length) {
      detail.append(profileTable(unit.stats, [
        ['Model', 'name'], ['M', 'm'], ['T', 't'], ['Sv', 'sv'], ['W', 'w'],
        ['Ld', 'ld'], ['OC', 'oc'], ['Inv', 'inv'],
      ]));
    }
    if (unit.weapons?.length) {
      const rows = unit.weapons.map(weapon => ({
        ...weapon, traits: Array.isArray(weapon.keywords) ? weapon.keywords.join(', ') : weapon.keywords,
      }));
      detail.append(profileTable(rows, [
        ['Weapon', 'name'], ['Range', 'range'], ['A', 'a'], ['BS/WS', 'skill'],
        ['S', 's'], ['AP', 'ap'], ['D', 'd'], ['Keywords', 'traits'],
      ]));
    }
    if (unit.abilityNames?.length) detail.append(node('p', 'Abilities · ' + unit.abilityNames.join(' · ')));
    if (unit.leads?.length) detail.append(node('p', 'Eligible bodyguards · ' + unit.leads.join(' · ')));
    for (const weapon of unit.weapons || []) {
      const calculate = node('button', 'Calculate ' + weapon.name);
      calculate.onclick = () => window.frOpenCombat({ faction, name: unit.name, weapon: weapon.name });
      detail.append(calculate);
    }
    if (unit.datasheetSource) {
      const url = new URL(unit.datasheetSource);
      if (url.protocol === 'https:') {
        const reference = node('a', 'Datasheet reference');
        reference.href = url.href;
        reference.rel = 'noopener noreferrer';
        reference.target = '_blank';
        detail.append(reference);
      }
    }
  });
  return detail;
}

function drawCatalogue(r, f) {
  const available = $('frUnitsAvailable');
  available.replaceChildren();
  if (!f?.units?.length) {
    available.append(node('p', loadError || 'Faction points catalogue unavailable.'));
    return;
  }

  const query = $('frFindUnit').value.trim().toLowerCase();
  const keyword = normal($('frKeywordFilter').value);
  const maximum = $('frCostFilter').value;
  const matches = f.units.filter(unit => unit.name.toLowerCase().includes(query) &&
    (!keyword || [unit.role, ...(unit.keywords || [])].some(value => normal(value).includes(keyword))) &&
    (maximum === '' || opts(unit, 1).some(option => option.points <= Number(maximum))));
  if (!matches.length) available.append(node('p', 'No matching units.'));
  const unitCounts = new Map();
  for (const entry of r.units || []) unitCounts.set(entry.name, (unitCounts.get(entry.name) || 0) + 1);

  for (const [unitIndex, unit] of matches.entries()) {
    const line = node('div', '');
    line.className = 'fr-unit';
    const title = node('div', '');
    title.append(node('strong', unit.name + (unit.legends ? ' · Legends' : '')));
    if (unit.stats?.length || unit.weapons?.length || unit.abilityNames?.length || unit.leads?.length) {
      title.append(showUnitProfile(unit, r.faction));
    }
    const controls = node('div', '');
    controls.className = 'fr-catalogue-controls';
    const count = (unitCounts.get(unit.name) || 0) + 1;
    const choices = opts(unit, count);
    const sizes = document.createElement('select');
    sizes.setAttribute('aria-label', unit.name + ' unit size');
    for (const [index, choice] of choices.entries()) {
      const points = cost(unit, count, choice.models, choice.optionId) ?? choice.points;
      sizes.add(new Option(`${choice.label} · ${points} pts`, String(index)));
    }
    const add = node('button', 'Add');
    add.type = 'button';
    add.setAttribute('aria-label', 'Add ' + unit.name);
    add.disabled = !choices.length;
    add.onclick = () => {
      const current = read();
      if (!current || current.faction !== r.faction) return;
      const choice = choices[Number(sizes.value)];
      if (!choice) return;
      const copy = current.units.filter(entry => entry.name === unit.name).length + 1;
      current.units.push({
        id: crypto.randomUUID(), name: unit.name, models: choice.models,
        points: cost(unit, copy, choice.models, choice.optionId) ?? choice.points,
        optionId: choice.optionId, wargear: [],
      });
      save(current);
      available.querySelectorAll('button')[unitIndex]?.focus({ preventScroll: true });
    };
    if (choices.length) controls.append(sizes);
    else controls.append(node('small', 'Points unavailable'));
    controls.append(add);
    line.append(title, controls);
    available.append(line);
  }
}

function drawRoster(roster, faction, sheets, result) {
  const list = $('frRosterUnits');
  list.replaceChildren();
  const counts = new Map();
  for (const [index, entry] of roster.units.entries()) {
    const { catalogue, sheet } = legality.profileFor(faction, entry, sheets, legality.detachments(roster));
    const key = normal(entry.name);
    const ordinal = (counts.get(key) || 0) + 1;
    counts.set(key, ordinal);

    const row = node('div', '');
    row.className = 'fr-unit fr-roster-unit';
    const details = node('div', '');
    details.append(node('strong', entry.name));
    details.append(node('small', (entry.models || '?') + ' models · ' + result.unitTotals[index] + ' pts'));

    const choices = opts(catalogue, ordinal);
    if (choices.length) {
      const size = document.createElement('select');
      size.setAttribute('aria-label', 'Model count for ' + entry.name);
      size.add(new Option('Choose model count', ''));
      for (const [choiceIndex, choice] of choices.entries()) {
        size.add(new Option(choice.label, String(choiceIndex)));
      }
      const current = choices.findIndex(choice => entry.optionId
        ? choice.optionId === entry.optionId
        : choice.models === entry.models &&
          choices.filter(option => option.models === entry.models).length === 1);
      size.value = current < 0 ? '' : String(current);
      size.onchange = () => {
        if (!size.value) return;
        const choice = choices[Number(size.value)];
        entry.models = choice.models;
        entry.optionId = choice.optionId;
        entry.points = cost(catalogue, ordinal, choice.models, choice.optionId) ?? choice.points;
        save(roster);
      };
      if (choices.length > 1 || current < 0) details.append(size);
    }

    const attachment = armySetup.attachmentControl(roster, faction, sheets, index);
    if (attachment) details.append(attachment);
    renderEquipment(details, roster, entry, catalogue, sheet);
    if (catalogue?.weapons?.length) {
      const calculate = node('button', 'Combat calculator');
      calculate.setAttribute('aria-label', 'Calculate combat for ' + entry.name);
      calculate.onclick = () => window.frOpenCombat({ faction: roster.faction, name: entry.name, id: entry.id });
      details.append(calculate);
    }

    const remove = node('button', 'Remove');
    remove.setAttribute('aria-label', 'Remove ' + entry.name);
    remove.onclick = () => {
      roster.units.splice(index, 1);
      if (entry.id && roster.warlord === entry.id) roster.warlord = '';
      if (entry.id) {
        for (const unit of roster.units) {
          if (unit.attachedTo === entry.id) delete unit.attachedTo;
        }
        roster.enhancements = (roster.enhancements || []).filter(item => item?.unitId !== entry.id);
      }
      save(roster);
    };
    const duplicate = node('button', 'Duplicate');
    duplicate.setAttribute('aria-label', 'Duplicate ' + entry.name);
    duplicate.onclick = () => {
      const copy = structuredClone(entry);
      copy.id = crypto.randomUUID();
      delete copy.attachedTo;
      roster.units.splice(index + 1, 0, copy);
      save(roster);
    };
    const actions = node('div','');
    actions.className = 'actions';
    actions.append(duplicate, remove);
    row.append(details, actions);
    list.append(row);
  }
}

function renderEquipment(parent, roster, entry, catalogue, sheet) {
  const gear = entry.wargear || [];
  const costed = new Map((catalogue?.wargear || []).map(item => [item.item, item.points]));
  const choices = new Set([...(sheet?.allowedWargear || []), ...costed.keys()]);
  if (choices.size) {
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Equipment for ' + entry.name);
    select.add(new Option('Add equipment option', ''));
    for (const item of choices) {
      const points = costed.get(item);
      select.add(new Option(points ? item + ' · +' + points + ' pts' : item, item));
    }
    select.onchange = () => {
      if (!select.value) return;
      entry.wargear = [...gear, select.value];
      save(roster);
    };
    parent.append(select);
  }
  for (const [index, option] of gear.entries()) {
    const label = typeof option === 'string' ? option : option.item + ' × ' + option.quantity;
    const remove = node('button', 'Remove ' + label);
    remove.onclick = () => {
      entry.wargear = gear.filter((_, position) => position !== index);
      save(roster);
    };
    parent.append(remove);
  }
}

function draw(){const r=read();if(!r?.faction)return;const rules=window.ForgeRosterRules?.getPacks().flatMap(pack=>pack.entries)||[];
const f=legality.withRules(faction(r),rules);
const sheets=rules.filter(entry=>entry.kind==='datasheet');
const result=legality.validate(r,f,{sheets,pointOverride:window.ForgeRosterPoints?.lookup});
$('frArmyTitle').textContent=r.name+' · '+r.faction;$('frLimitLabel').textContent='Army limit: '+r.limit+' pts';$('frArmyTotal').textContent=result.total+' / '+r.limit+' pts';$('frMfmVersion').textContent=db ? 'MFM v' + db.meta.version + ' · ' + db.meta.lastUpdated + (db.meta.transcription ? ' · secondary transcription' : '') + (loadError ? ' · refresh failed' : '') : (loadError || 'Loading points catalogue…');
$('frRosterOverview').textContent = [r.units.length + ' units', ...legality.detachments(r),
  ...(r.rulesSnapshot?.revision && db?.meta?.version !== r.rulesSnapshot.revision ? ['Saved against MFM ' + r.rulesSnapshot.revision] : []),
  result.errors.length ? 'Needs corrections' : result.incomplete.length || !db ? 'Unverified draft' : 'Available checks passed'].join(' · ');
$('frUndo').disabled = !undoRoster;
armySetup.render(r,f,result,sheets);
drawCatalogue(r,f);
drawRoster(r, f, sheets, result);
const validation=$('frValidation');
validation.replaceChildren();
validation.setAttribute('aria-live','polite');
for(const [items,title] of [[result.errors,'Resolve before play'],[result.incomplete,'Needs verification'],[result.notices,'Event notes']]){
  if(!items.length)continue;
  const heading=node('strong',title);
  const list=document.createElement('ul');
  list.className='fr-warning';
  for(const issue of items)list.append(node('li',issue));
  validation.append(heading,list);
}
if(!result.errors.length&&!result.incomplete.length)validation.append(node('p','All available roster checks passed.'));
}
for (const id of ['frFindUnit','frKeywordFilter','frCostFilter']) $(id).oninput=draw;
$('frUndo').onclick = () => {
  if (!undoRoster) return;
  const previous = undoRoster;
  undoRoster = null;
  save(previous,false);
};
$('frExportText').onclick = () => {
  const r = read();
  const lines = [r.name + ' · ' + r.faction, $('frArmyTotal').textContent, $('frRosterOverview').textContent, '',
    ...r.units.map(unit => unit.name + ' · ' + (unit.models || '?') + ' models' +
      ((unit.wargear || []).length ? ' · ' + unit.wargear.map(item => typeof item === 'string' ? item : item.item + ' × ' + item.quantity).join(', ') : ''))];
  const url = URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'forgeroster-army.txt';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
};
$('frExportRules').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(read(),null,2)],{type:'application/json'}));a.href=url;a.download='forgeroster-army.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)};
function parseRoster(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' ||
      typeof data.name !== 'string' || !data.name.trim() || data.name.length > 100 ||
      typeof data.faction !== 'string' || !data.faction.trim() || data.faction.length > 100 ||
      !Number.isSafeInteger(data.limit) || data.limit <= 0 ||
      !Array.isArray(data.units) || data.units.length > 300 ||
      data.units.some(unit => !unit || typeof unit.name !== 'string' || !unit.name.trim() ||
        !Number.isSafeInteger(unit.points) || unit.points < 0 ||
        (unit.models != null && (!Number.isSafeInteger(unit.models) || unit.models < 1)) ||
        (unit.wargear != null && (!Array.isArray(unit.wargear) ||
          unit.wargear.some(item => typeof item !== 'string' &&
            (!item || typeof item.item !== 'string' || !Number.isSafeInteger(item.quantity) ||
              item.quantity < 1))))) ||
      (data.detachments != null && (!Array.isArray(data.detachments) ||
        data.detachments.some(name => typeof name !== 'string'))) ||
      (data.enhancements != null && (!Array.isArray(data.enhancements) ||
        data.enhancements.some(item => typeof item !== 'string' &&
          (!item || typeof item.name !== 'string'))))) {
    throw new Error('Choose a ForgeRoster export with valid army and unit fields.');
  }
  return data;
}

$('frImportRules').onchange = async event => {
  const input = event.target;
  const file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error('Roster files must be under 1 MB.');
    const imported = parseRoster(await file.text());
    if (confirm('Replace the open roster with ' + imported.name + '?')) save(imported);
  } catch (error) {
    alert('Could not import roster. ' + error.message);
  } finally {
    input.value = '';
  }
};

async function load(force = false) {
  try {
    // Prefer the deploy's snapshot. The service worker handles offline fallback.
    const response = await fetch('./data/mfm.json', { cache: force ? 'reload' : 'no-cache' });
    if (!response.ok) throw new Error('Points snapshot unavailable (HTTP ' + response.status + ').');
    const next = await response.json();
    if (next.schemaVersion !== 2 || !Array.isArray(next.factions) ||
        !next.factions.some(entry => entry.units?.length)) {
      throw new Error('A populated points snapshot is unavailable.');
    }
    db = next;
    loadError = '';
  } catch (error) {
    loadError = error.message;
  }
  draw();
}
$('frRefreshRules').onclick=()=>load(true);
document.addEventListener('fr-roster-opened',() => { undoRoster = null; draw(); });
document.addEventListener('fr-points-changed',draw);
document.addEventListener('fr-rule-packs-changed',draw);
draw();load();
})();