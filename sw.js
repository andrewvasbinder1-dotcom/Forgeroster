'use strict';

const cacheName = 'forgeroster-shell-v1';
const root = new URL(self.registration.scope);
const shell = [
  './', './index.html', './app.css', './app.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './factions.js', './setup.js?v=3',
  './roster-storage.js', './validation.js', './army-setup.js', './rules-builder.js', './rules-library.js?v=2', './rule-links.js?v=1',
  './source-manager.js?v=1', './auth-config.js', './cloud.js?v=1', './auth.js?v=2',
  './data/mfm.json', './data/rules/bundled.json',
];
const shellPaths = new Set(shell.map(path => new URL(path, root).pathname));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(shell)));
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
