/* Search and maintain the versioned ForgeRoster rules packs. */
(() => {
  'use strict';
  const STORAGE = 'fr-rule-packs-v1';
  const TYPES = ['core', 'faction', 'detachment', 'errata'];
  const $ = id => document.getElementById(id);
  const style = document.createElement('style');
  style.textContent = `
    #frRuleLibrary {max-width:1150px;margin:12px auto;padding:0 12px}
    #frRuleLibrary .panel {background:#151e30;border:1px solid #34435e;border-radius:14px;padding:16px;min-width:0}
    #frRuleLibrary .tools {display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    #frRuleLibrary input[type=search] {flex:1;min-width:0}
    #frRuleLibrary .entry {padding:13px 0;border-bottom:1px solid #35435b;overflow-wrap:anywhere}
    #frRuleLibrary .entry p {white-space:pre-wrap;line-height:1.5}
    #frRuleLibrary .tag {display:inline-block;background:#293b58;border-radius:6px;padding:3px 7px;margin:2px;font-size:12px}
    #frRuleLibrary .muted {color:#aebbd0;font-size:13px}
    #frRuleLibrary button {min-height:44px}
    #frRuleLibrary summary {cursor:pointer;padding:8px 0;font-weight:650}
    #frRuleLibrary select,#frRuleLibrary input {max-width:100%}
    #frRuleLibrary a {color:#a9c8ff}
  `;
  document.head.append(style);

  const root = document.createElement('section');
  root.id = 'frRuleLibrary';
  root.innerHTML = `<div class="panel">
    <h2>Rules &amp; Keywords Library</h2>
    <p class="muted">Search published reference summaries and rules packs installed on this device.</p>
    <div class="tools">
      <input id="frRuleSearch" type="search" placeholder="Search rules or units" aria-label="Search rules">
      <select id="frRuleScope" aria-label="Filter rules by pack type">
        <option value="">All packs</option><option value="core">Core</option><option value="faction">Faction</option>
        <option value="detachment">Detachment</option><option value="errata">Errata</option>
      </select>
    </div>
    <details><summary>Manage rules packs</summary><div class="tools">
      <label for="frPackImport">Import rules pack JSON</label><input id="frPackImport" type="file" accept=".json,application/json">
      <button id="frPackTemplate">Download template</button><button id="frPackExport">Export installed packs</button>
    </div></details>
    <div id="frPackInfo" class="muted"></div><div id="frRuleResults"></div>
  </div>`;
  document.querySelector('header')?.after(root);

  let installed = [];
  let bundled = [];
  let loadError = '';
  const normalize = value => String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
  const validString = (value, limit) => typeof value === 'string' && value.length <= limit;
  const validName = (value, limit) => validString(value, limit) && Boolean(value.trim());
  const validateNames = (entry, fields, maxLength) => {
    for (const field of fields) {
      const values = entry[field];
      if (values !== undefined && (!Array.isArray(values) || values.length > 200 || values.some(value => !validName(value, maxLength)))) {
        throw Error(`Invalid ${field} for ${entry.id}`);
      }
    }
  };
  function validatePack(pack) {
    if (!pack || typeof pack !== 'object' || pack.schemaVersion !== 1) throw Error('Expected rules pack schema version 1');
    if (typeof pack.id !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,80}$/i.test(pack.id)) throw Error('Invalid pack ID');
    if (!TYPES.includes(pack.type) || !validName(pack.version, 80) || !validName(pack.title, 150)) throw Error('Invalid pack type, version or title');
    if (pack.edition !== undefined && String(pack.edition) !== '11') throw Error('Pack must target edition 11');
    if (!Array.isArray(pack.entries) || pack.entries.length > 10000 || JSON.stringify(pack).length > 3e6) throw Error('Pack exceeds the 10,000-entry or 3 MB limit');
    const ids = new Set();
    for (const entry of pack.entries) {
      if (!entry || !validName(entry.id, 120) || ids.has(entry.id)) throw Error('Invalid or duplicate entry ID');
      ids.add(entry.id);
      if (!validName(entry.name, 200) || !validString(entry.text, 15000)) throw Error(`Invalid name or text for ${entry.id}`);
      validateNames(entry, ['abilities', 'weapons', 'allowedWargear', 'leaderTargets', 'eligibleUnits', 'requiredKeywords',
        'forbiddenUnits', 'requiredUnits', 'forbiddenDetachments', 'requiredDetachments', 'keywords', 'references'], 200);
      if (entry.modelCounts !== undefined && (!Array.isArray(entry.modelCounts) || entry.modelCounts.length > 200 ||
          entry.modelCounts.some(count => !['string', 'number'].includes(typeof count) || !Number.isInteger(Number(count)) || Number(count) < 1))) {
        throw Error(`Invalid model counts for ${entry.id}`);
      }
      if (entry.stats !== undefined && (!entry.stats || typeof entry.stats !== 'object' || Array.isArray(entry.stats) ||
          Object.values(entry.stats).some(value => !['string', 'number'].includes(typeof value)))) throw Error(`Invalid stats for ${entry.id}`);
      for (const field of ['minModels','maxModels']) {
        if (entry[field] !== undefined && (!Number.isSafeInteger(entry[field]) || entry[field] < 1 || entry[field] > 500)) throw Error(`Invalid ${field} for ${entry.id}`);
      }
      if (entry.minModels > entry.maxModels) throw Error(`Invalid model range for ${entry.id}`);
      if (entry.requiredSelections !== undefined && (!Array.isArray(entry.requiredSelections) ||
        entry.requiredSelections.length > 200 || entry.requiredSelections.some(rule => !validName(rule?.item,200) ||
          (rule.minimum !== undefined && (!Number.isSafeInteger(rule.minimum) || rule.minimum < 1 || rule.minimum > 500))))) {
        throw Error(`Invalid required equipment for ${entry.id}`);
      }
      if (entry.maxCopies !== undefined && (!Number.isInteger(entry.maxCopies) || entry.maxCopies < 1 || entry.maxCopies > 100)) throw Error(`Invalid maxCopies for ${entry.id}`);
    }
    return pack;
  }
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE) || '[]');
    if (Array.isArray(stored)) {
      installed = stored.flatMap(pack => {
        try { return [validatePack(pack)]; } catch { return []; }
      });
    }
  } catch { /* A bad stored pack must not block the bundled reference. */ }

  function element(tag, content, className) {
    const item = document.createElement(tag);
    if (content !== undefined) item.textContent = content;
    if (className) item.className = className;
    return item;
  }

  function download(filename, data) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
    const link = element('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function activePacks() {
    return [...installed, ...bundled.filter(pack => !installed.some(local => local.id === pack.id))];
  }

  function saveInstalled(next) {
    localStorage.setItem(STORAGE, JSON.stringify(next));
    installed = next;
    changed();
  }

  function changed() {
    render();
    document.dispatchEvent(new Event('fr-rule-packs-changed'));
  }

  const example = {
    schemaVersion: 1, id: 'example-core', title: 'My Core Rules', type: 'core', version: '1.0.0', edition: '11',
    entries: [{id: 'example-keyword', name: 'EXAMPLE KEYWORD', kind: 'keyword', text: 'Add your original reference summary.', references: ['My source, page 1']}]
  };
  $('frPackTemplate').onclick = () => download('forgeroster-rules-template.json', example);
  $('frPackExport').onclick = () => download('forgeroster-installed-rules.json', {schemaVersion: 1, packs: installed});
  $('frPackImport').onchange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      const incoming = Array.isArray(json.packs) ? json.packs : [json];
      if (!incoming.length || incoming.length > 50) throw Error('Invalid pack count');
      incoming.forEach(validatePack);
      const next = [...installed];
      for (const pack of incoming) {
        const existing = next.find(item => item.id === pack.id) || bundled.find(item => item.id === pack.id);
        if (existing && !confirm(`Use ${pack.title} (${pack.version}) in place of ${existing.version}?`)) continue;
        const index = next.findIndex(item => item.id === pack.id);
        if (index >= 0) next[index] = pack;
        else next.push(pack);
      }
      saveInstalled(next);
    } catch (error) {
      alert(`Could not import rules pack: ${error.message}`);
    } finally {
      event.target.value = '';
    }
  };

  function renderPackInfo(info, pack) {
    const isLocal = installed.includes(pack);
    const details = element('details');
    details.append(element('summary', `${pack.title} · ${pack.version} · ${isLocal ? 'Installed on this device' : 'Included'} · ${pack.entries.length} entries`));
    if (validName(pack.coverage, 500)) details.append(element('p', pack.coverage));
    if (Array.isArray(pack.sources)) {
      const sources = element('ul');
      for (const source of pack.sources) {
        if (!source || !validName(source.label, 200) || !validString(source.url, 600) || !/^https:\/\//i.test(source.url)) continue;
        const listItem = element('li');
        const link = element('a', source.label);
        link.href = source.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        listItem.append(link);
        sources.append(listItem);
      }
      if (sources.childElementCount) details.append(sources);
    }
    if (isLocal) {
      const remove = element('button', 'Remove installed pack');
      remove.onclick = () => {
        if (!confirm(`Remove ${pack.title} from this device?`)) return;
        try { saveInstalled(installed.filter(item => item.id !== pack.id)); }
        catch (error) { alert(`Could not remove rules pack: ${error.message}`); }
      };
      details.append(remove);
    }
    info.append(details);
  }

  function render() {
    const info = $('frPackInfo');
    const results = $('frRuleResults');
    info.replaceChildren();
    results.replaceChildren();
    const packs = activePacks();
    const infoList = element('details');
    infoList.append(element('summary', `${packs.length} rules packs · Sources and coverage`));
    for (const pack of packs) renderPackInfo(infoList, pack);
    info.append(infoList);
    if (loadError) info.append(element('p', loadError, 'warning'));

    const query = normalize($('frRuleSearch').value.trim());
    const scope = $('frRuleScope').value;
    if (!query && !scope) {
      results.append(element('p', 'Enter a rule, unit or keyword to search, or choose a pack type to browse.', 'muted'));
      return;
    }
    let found = 0;
    for (const pack of packs) {
      if (scope && pack.type !== scope) continue;
      for (const entry of pack.entries) {
        const searchable = [entry.name, entry.text, entry.kind, entry.faction, entry.unit, entry.detachment,
          ...(entry.keywords || []), ...(entry.references || [])].join(' ');
        if (query && !normalize(searchable).includes(query)) continue;
        if (found++ >= 150) continue;
        const details = element('details', undefined, 'entry');
        details.append(element('summary', entry.name));
        details.append(element('div', [entry.kind || 'rule', entry.detachment || entry.unit, pack.title, ...(entry.references || [])].filter(Boolean).join(' · '), 'muted'));
        if (entry.text) details.append(element('p', entry.text));
        if (entry.stats) details.append(element('p', Object.entries(entry.stats).map(([key, value]) => `${key}: ${value}`).join(' · ')));
        for (const keyword of entry.keywords || []) details.append(element('span', keyword, 'tag'));
        results.append(details);
      }
    }
    if (found > 150) results.append(element('p', 'Showing the first 150 matches. Refine your search.'));
    if (!found) results.append(element('p', 'No matching rules.', 'muted'));
  }

  $('frRuleSearch').oninput = render;
  $('frRuleScope').onchange = render;
  window.ForgeRosterRules = {
    getPacks: () => structuredClone(activePacks()),
    find: term => activePacks().flatMap(pack => pack.entries.filter(entry => normalize(entry.name) === normalize(term))
      .map(entry => ({pack: pack.id, version: pack.version, entry: structuredClone(entry)})))
  };
  render();
  fetch('./data/rules/bundled.json')
    .then(response => {
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      if (data.schemaVersion !== 1 || !Array.isArray(data.packs)) throw Error('Unsupported bundled rules collection');
      bundled = data.packs.map(validatePack);
      changed();
    })
    .catch(() => {
      loadError = 'Included reference summaries could not be loaded.';
      render();
    });
})();
