'use strict';

const navigation = document.createElement('nav');
navigation.id = 'frNavigation';
navigation.setAttribute('aria-label', 'ForgeRoster');
const views = [
  ['builder', 'Army builder'],
  ['rules', 'Rules & datasheets'],
  ['sources', 'Data sources'],
];

function showForgeRosterView(view) {
  document.body.dataset.frView = view;
  for (const button of navigation.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  }
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
showForgeRosterView('builder');

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(error => {
      console.warn('ForgeRoster offline setup failed:', error);
    });
  });
}
