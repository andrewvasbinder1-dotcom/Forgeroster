'use strict';

const cacheName = 'forgeroster-shell-v10';
const root = new URL(self.registration.scope);
const shell = [
  './', './index.html', './app.css?v=20261114.10', './app.js?v=20261114.10', './manifest.webmanifest?v=20261114.10',
  './icons/icon-192.png', './icons/icon-512.png', './factions.js?v=20261114.10', './setup.js?v=20261114.10',
  './roster-storage.js?v=20261114.10', './validation.js?v=20261114.10', './army-setup.js?v=20261114.10', './weapon-bearers.js?v=20261114.10', './rules-builder.js?v=20261114.10', './rules-library.js?v=20261114.10', './rule-links.js?v=20261114.10',
  './source-manager.js?v=20261114.10', './auth-config.js?v=20261114.10', './cloud.js?v=20261114.10', './auth.js?v=20261114.10',
  './combat.css?v=20261114.10', './combat-engine.js?v=20261114.10', './combat.js?v=20261114.10',
  './production.css?v=20261114.10', './operations.js?v=20261114.10', './brand/crest.svg', './icons/apple-touch.png', './icons/maskable-512.png',
  './data/mfm.json', './data/rules/bundled.json',
];
const shellPaths = new Set(shell.map(path => new URL(path, root).pathname));

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
  if (!shellPaths.has(url.pathname)) return;

  // Normalize shell URLs so version query strings and sign-in redirects work offline.
  const key = new URL(url.pathname, root);
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    try {
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(key, response.clone());
        return response;
      }
      return await cache.match(key, { ignoreSearch: true }) || response;
    } catch {
      return await cache.match(key, { ignoreSearch: true }) || Response.error();
    }
  })());
});
