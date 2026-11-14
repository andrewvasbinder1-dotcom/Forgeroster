'use strict';

(() => {
  const categories = ['Army Builder', 'Datasheets', 'Points', 'Wargear', 'Combat Calculator', 'Account and Sync', 'UI and Display', 'Performance', 'Other'];
  const severity = ['Low', 'Medium', 'High', 'Critical'];
  const states = ['New', 'Investigating', 'Confirmed', 'In Progress', 'Fixed', 'Closed', 'Duplicate'];
  const element = (tag, text) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    return node;
  };
  const select = values => values.map(value => '<option>' + value + '</option>').join('');
  const root = element('section');
  root.id = 'frOperations';
  root.hidden = true;
  root.innerHTML = `
    <section id="frSupport" hidden><h2>Help & account</h2>
      <p>Build an army, review its checks, then export a backup before changing devices. Cloud rosters require a signed-in account.</p>
      <button id="frSupportReport">Report a bug</button> <button id="frSupportAccount">Open account controls</button>
      <p id="frAccountHelp"></p><p><a href="https://github.com/andrewvasbinder1-dotcom/Forgeroster#maintenance">Project documentation</a></p>
    </section>
    <section id="frReport" hidden><h2>Report a bug</h2>
      <p>Sign in to submit. Reports and attachments are visible to authorized administrators. Leave out passwords, tokens, and private roster details.</p>
      <form id="frBugForm">
        <div class="ops-grid">
          <label>Title<input name="title" maxlength="160" required></label>
          <label>Category<select name="category">${select(categories)}</select></label>
          <label>Severity<select name="severity">${select(severity)}</select></label>
          <label>Contact email (optional)<input name="contact" type="email" maxlength="254"></label>
        </div>
        <label>Description<textarea name="description" maxlength="4000" required></textarea></label>
        <label>Steps to reproduce<textarea name="steps" maxlength="4000"></textarea></label>
        <div class="ops-grid">
          <label>Expected behavior<textarea name="expected" maxlength="2000"></textarea></label>
          <label>Actual behavior<textarea name="actual" maxlength="2000"></textarea></label>
        </div>
        <label>Screenshot (optional)<input type="file" id="frBugScreenshot" accept="image/png,image/jpeg,image/webp"></label>
        <label><input type="checkbox" name="diagnosticConsent"> Include browser, OS, device type, version, page and connection status</label>
        <button type="submit">Submit report</button><p id="frBugStatus" role="status"></p>
      </form>
    </section>
    <section id="frAdmin" hidden><h2>Administration</h2><p id="frAdminStatus" role="status"></p>
      <div id="frAdminPanel" hidden>
        <div id="frAdminStats" class="ops-stats"></div>
        <p>Authentication activity is measured by last sign-in. Error monitoring and backup verification are unavailable.</p>
        <div class="ops-grid"><label>Search reports<input type="search" id="frAdminSearch"></label>
        <label>Category<select id="frAdminCategory"><option value="">All</option>${select(categories)}</select></label>
        <label>Severity<select id="frAdminSeverity"><option value="">All</option>${select(severity)}</select></label>
        <label>Status<select id="frAdminFilter"><option value="">All</option>${select(states)}</select></label></div>
        <button id="frAdminReload">Refresh reports</button><div id="frAdminReports"></div>
        <h3>Rules and points</h3><p><a href="./data/verification.json">Download points verification report</a></p>
      </div>
    </section>`;
  document.querySelector('main').before(root);
  const $ = id => document.getElementById(id);
  let session = null, reports = [], refreshID = 0;
  let version = { version: '2026.11.14', commit: null };
  fetch('./release.json', { cache: 'no-store' }).then(response => response.ok ? response.json() : null)
    .then(data => { if (data?.commit) version = data; }).catch(() => {});
  function show(view) {
    root.hidden = !['support', 'report', 'admin'].includes(view);
    for (const name of ['Support', 'Report', 'Admin']) $('fr' + name).hidden = name.toLowerCase() !== view;
    if (view === 'admin') loadAdmin();
  }
  function setSession(next) {
    session = next;
    reports = [];
    $('frAdminPanel').hidden = true;
    $('frAdminReports').replaceChildren();
    $('frAdminStats').replaceChildren();
    $('frBugStatus').textContent = '';
    $('frBugForm').reset();
    if (document.body.dataset.frView === 'admin') loadAdmin();
    $('frAccountHelp').textContent = next ? 'Signed in. Use the header to sign out.' : 'Sign in to sync your saved armies or report an issue.';
  }
  document.addEventListener('fr-user-signed-in', event => setSession(event.detail));
  document.addEventListener('fr-user-signed-out', () => setSession(null));
  document.addEventListener('fr-view-changed', event => show(event.detail));
  $('frSupportReport').onclick = () => showForgeRosterView('report');
  $('frSupportAccount').onclick = () => {
    if (!session) $('frAuthOpen')?.click();
    else $('frAccountHelp').textContent = 'You are signed in. Your rosters are in Army Builder under My Armies.';
  };

  async function screenshot(file) {
    if (!file) return null;
    if (file.size > 5 * 1024 * 1024 || !['image/png','image/jpeg','image/webp'].includes(file.type)) throw Error('Choose a PNG, JPEG, or WebP under 5 MB.');
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = element('canvas');
      const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      let url = canvas.toDataURL('image/png');
      while (url.length > 699074 && canvas.width > 1 && canvas.height > 1) {
        canvas.width = Math.max(1, Math.floor(canvas.width * .7));
        canvas.height = Math.max(1, Math.floor(canvas.height * .7));
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        url = canvas.toDataURL('image/png');
      }
      if (!url.startsWith('data:image/png;base64,') || url.length > 699074) throw Error('Screenshot is too large after resizing.');
      return url.slice(22);
    } finally { bitmap.close(); }
  }
  function diagnostics() {
    const ua = navigator.userAgent;
    const browser = ua.match(/(?:EdgiOS|EdgA|Edg|FxiOS|Firefox|CriOS|Chrome|Version)\/[\d.]+/)?.[0] || 'Unknown';
    const os = /Android/.test(ua) ? 'Android' : /iPad|iPhone/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' :
      /Mac OS X/.test(ua) && navigator.maxTouchPoints > 1 ? 'iPadOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown';
    return { ...version, browser, os, device: /Mobile|Android|iPad/.test(ua) || os === 'iPadOS' ? 'Mobile' : 'Desktop',
      page: 'report', online: navigator.onLine, submittedAt: new Date().toISOString() };
  }
  $('frBugForm').onsubmit = async event => {
    event.preventDefault();
    const actor = session, output = $('frBugStatus'), form = event.currentTarget;
    if (!actor) { output.textContent = 'Sign in before submitting a report.'; return; }
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    output.textContent = 'Submitting report…';
    try {
      const values = new FormData(form);
      const fields = Object.fromEntries(['title','category','severity','description','steps','expected','actual','contact']
        .map(key => [key, String(values.get(key) || '').trim()]));
      const image = await screenshot($('frBugScreenshot').files[0]);
      if (actor !== session) return;
      const { data, error } = await actor.client.rpc('fr_submit_bug', { ...fields,
        diagnostics: values.has('diagnosticConsent') ? diagnostics() : {}, screenshot_base64: image });
      if (actor !== session) return;
      if (error) throw Error(error.code === 'PGRST202' ? 'Report storage is awaiting the hosted migration.' : error.message);
      output.textContent = 'Report received · ' + data;
      form.reset();
    } catch (error) { if (actor === session) output.textContent = error.message; }
    finally { button.disabled = false; }
  };

  async function loadAdmin() {
    const actor = session, token = ++refreshID, status = $('frAdminStatus');
    $('frAdminPanel').hidden = true;
    if (!actor) { status.textContent = 'Sign in with an administrator account.'; return; }
    status.textContent = 'Checking administrator access…';
    try {
      const access = await actor.client.rpc('fr_admin_access');
      if (actor !== session || token !== refreshID) return;
      if (access.error) throw Error('Administrator service is unavailable. Check the hosted migration.');
      if (!access.data) { status.textContent = 'Administrator access is required.'; return; }
      const [overview, list, rules] = await Promise.all([
        actor.client.rpc('fr_admin_overview'),
        actor.client.from('bug_reports').select('id,title,category,severity,description,steps,expected,actual,contact,diagnostics,status,internal_note,issue_url,created_at')
          .order('created_at', { ascending: false }).limit(100),
        fetch('./data/verification.json').then(response => response.ok ? response.json() : null).catch(() => null),
      ]);
      if (actor !== session || token !== refreshID) return;
      if (overview.error || list.error) throw Error('Could not load administrator data.');
      reports = list.data || [];
      const stats = $('frAdminStats');
      stats.replaceChildren();
      const metrics = [['Registered users','registered'],['Signed in within 30 days','signedInLast30Days'],['Saved rosters','rosters'],
        ['Reports','reports'],['Open','open'],['Critical open','criticalOpen'],
        ['Email pending','emailPending'],['Email accepted','emailSent'],['Email failed','emailFailed']];
      for (const [label, key] of metrics) stats.append(element('p', label + ' · ' + (overview.data?.[key] ?? 'Unavailable')));
      stats.append(element('p', 'Deployment · ' + (version.commit?.slice(0, 7) || 'Unavailable')),
        element('p', 'Rules snapshot · ' + (rules?.revision || 'Unavailable')));
      $('frAdminPanel').hidden = false;
      status.textContent = 'Showing up to 100 most recent reports.';
      renderReports();
    } catch (error) { if (actor === session && token === refreshID) status.textContent = error.message; }
  }
  function renderReports() {
    const list = $('frAdminReports');
    list.replaceChildren();
    const query = $('frAdminSearch').value.toLowerCase();
    const filters = [['category','frAdminCategory'],['severity','frAdminSeverity'],['status','frAdminFilter']];
    for (const report of reports.filter(item => filters.every(([key,id]) => !$(id).value || item[key] === $(id).value) &&
      [item.id,item.title,item.description].some(value => value.toLowerCase().includes(query)))) {
      const card = element('details');
      card.append(element('summary', report.severity + ' · ' + report.status + ' · ' + report.title),
        element('p', report.id + ' · ' + report.category + ' · ' + report.created_at));
      for (const [label,key] of [['Description','description'],['Reproduction','steps'],['Expected','expected'],['Actual','actual'],['Contact','contact']]) {
        if (report[key]) card.append(element('h4',label),element('p',report[key]));
      }
      card.append(element('pre',JSON.stringify(report.diagnostics,null,2)));
      const image = element('button','Load private screenshot');
      image.onclick = async () => {
        const actor = session;
        const result = await actor.client.from('bug_reports').select('screenshot').eq('id',report.id).maybeSingle();
        if (actor !== session) return;
        const value = result.data?.screenshot;
        if (!value || !/^\\x[0-9a-f]+$/i.test(value)) { image.textContent = 'No screenshot available'; return; }
        const img = element('img'); img.alt = 'Private screenshot attached to this report';
        img.src = 'data:image/png;base64,' + btoa(value.slice(2).match(/../g).map(hex => String.fromCharCode(parseInt(hex,16))).join(''));
        image.replaceWith(img);
      };
      const form = element('form');
      form.innerHTML = '<label>Status<select name="status">' + select(states) + '</select></label><label>Internal note<textarea name="note" maxlength="4000"></textarea></label><label>GitHub issue or fixing commit URL<input name="link" type="url" maxlength="500"></label><button>Save report changes</button><p role="status"></p>';
      form.elements.status.value = report.status;
      form.elements.note.value = report.internal_note;
      form.elements.link.value = report.issue_url;
      form.onsubmit = async event => {
        event.preventDefault();
        const actor = session;
        const output = form.querySelector('[role=status]');
        const { error } = await actor.client.rpc('fr_update_bug',{ report: report.id,
          next_status: form.elements.status.value, note: form.elements.note.value, link: form.elements.link.value });
        if (actor !== session) return;
        if (error) output.textContent = error.message;
        else await loadAdmin();
      };
      card.append(image,form);
      list.append(card);
    }
    if (!list.children.length) list.append(element('p','No matching reports.'));
  }
  $('frAdminReload').onclick = loadAdmin;
  for (const id of ['frAdminSearch','frAdminCategory','frAdminSeverity','frAdminFilter']) $(id).oninput = renderReports;
})();
