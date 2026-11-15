'use strict';

const cacheName = 'forgeroster-shell-v14';
const root = new URL(self.registration.scope);
const shell = [
  './', './index.html', './app.css?v=20261114.14', './app.js?v=20261114.14', './manifest.webmanifest?v=20261114.14',
  './icons/icon-192.png', './icons/icon-512.png', './factions.js?v=20261114.14', './setup.js?v=20261114.14',
  './roster-storage.js?v=20261114.14', './validation.js?v=20261114.14', './army-setup.js?v=20261114.14', './weapon-bearers.js?v=20261114.14', './rules-builder.js?v=20261114.14', './rules-library.js?v=20261114.14', './rule-links.js?v=20261114.14',
  './source-manager.js?v=20261114.14', './auth-config.js?v=20261114.14', './cloud.js?v=20261114.14', './auth.js?v=20261114.14',
  './combat.css?v=20261114.14', './combat-engine.js?v=20261114.14', './combat.js?v=20261114.14',
  './production.css?v=20261114.14', './operations.js?v=20261114.14', './brand/crest.svg', './icons/apple-touch.png', './icons/maskable-512.png',
  './data/mfm.json', './data/rules/bundled.json',
];
const shellUrls = new Set(shell.map(path => new URL(path, root).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(shell.map(path => new Request(new URL(path, root), { cache: 'reload' })))));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('forgeroster-shell-') && key !== cacheName) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== root.origin) return;
  // Navigations may contain a release query or authentication redirect parameters.
  // Assets use their exact URL so a stale cache cannot supply another release's script.
  const key = request.mode === 'navigate' ? new URL(url.pathname, root).href : url.href;
  if (!shellUrls.has(key)) return;

  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    let response;
    try {
      response = await fetch(request);
    } catch {
      return await cache.match(key) || Response.error();
    }
    if (!response.ok) return await cache.match(key) || response;
    // Preserve the installed revision if an older worker sees newer HTML online.
    if (request.mode !== 'navigate') {
      try { await cache.put(key, response.clone()); } catch { /* Quota errors must not break online loading. */ }
    }
    return response;
  })());
});
