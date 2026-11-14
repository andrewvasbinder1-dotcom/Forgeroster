'use strict';

const navigation = document.createElement('nav');
navigation.id = 'frNavigation';
navigation.setAttribute('aria-label', 'ForgeRoster');
const views = [
  ['builder', 'Army builder'],
  ['combat', 'Combat calculator'],
  ['rules', 'Rules & datasheets'],
  ['sources', 'Data sources'],
];

function showForgeRosterView(view) {
  document.body.dataset.frView = view;
  for (const button of navigation.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  }
  if (view === 'combat' && location.hash !== '#combat') history.replaceState(null, '', '#combat');
  if (view !== 'combat' && location.hash === '#combat') history.replaceState(null, '', location.pathname + location.search);
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
  showForgeRosterView(location.hash === '#combat' ? 'combat' : 'builder');
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
