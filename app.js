'use strict';

const navigation = document.createElement('nav');
navigation.id = 'frNavigation';
navigation.setAttribute('aria-label', 'ForgeRoster');
const views = [
  ['builder', 'Army builder'],
  ['combat', 'Combat calculator'],
  ['rules', 'Rules & datasheets'],
  ['sources', 'Data sources'],
  ['report', 'Report a bug'],
  ['support', 'Help & account'],
];

function showForgeRosterView(view) {
  document.body.dataset.frView = view;
  for (const button of navigation.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  }
  const hash = view === 'builder' ? '' : '#' + view;
  if (location.hash !== hash) history.replaceState(null, '', location.pathname + location.search + hash);
  document.dispatchEvent(new CustomEvent('fr-view-changed', { detail: view }));
}

for (const [view, label] of views) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.dataset.view = view;
  button.onclick = () => showForgeRosterView(view);
  navigation.append(button);
}

document.querySelector('header').after(navigation);
function openInitialView() {
  const view = location.hash.slice(1);
  showForgeRosterView(view === 'admin' || views.some(([key]) => key === view) ? view : 'builder');
}
window.addEventListener('hashchange', openInitialView);
document.addEventListener('DOMContentLoaded', openInitialView, { once: true });

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(error => {
      console.warn('ForgeRoster offline setup failed:', error);
    });
  });
}

const connection = document.createElement('p');
connection.id = 'frConnection';
connection.setAttribute('role', 'status');
connection.textContent = 'Offline · edits stay on this device until sync is available.';
navigation.after(connection);
function showConnection() { connection.hidden = navigator.onLine; }
window.addEventListener('online', showConnection);
window.addEventListener('offline', showConnection);
showConnection();
