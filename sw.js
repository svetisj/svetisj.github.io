'use strict';
// Build updates this identifier so a changed inventory triggers a worker update.
const BUILD_VERSION = 'a7862297cb0ca1eb61735076e7e7647667b759907f64c6b3adb08e04c78e6e6b';
const PREFIX = 'saints-library-';
let inventoryPromise;
let downloadPromise;
const absolute = path => new URL(path, self.registration.scope).href;

async function inventory() {
  if (!inventoryPromise) inventoryPromise = (async () => {
    const cache = await caches.open(PREFIX + BUILD_VERSION);
    const cached = await cache.match(absolute('offline-assets.json'));
    const response = cached || await fetch(absolute('offline-assets.json'), { cache: 'no-store' });
    if (!response.ok) throw new Error('Offline inventory unavailable');
    const data = await response.json();
    if (data.version !== BUILD_VERSION) throw new Error('Release inventory does not match this worker');
    return data;
  })();
  return inventoryPromise;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch(absolute('offline-assets.json'), { cache: 'no-store' });
    if (!response.ok) throw new Error('Offline inventory unavailable');
    const data = await response.clone().json();
    // A deployment can briefly expose files from two releases. Keep the old
    // working worker until its replacement and inventory agree.
    if (data.version !== BUILD_VERSION) throw new Error('Release inventory does not match this worker');
    inventoryPromise = Promise.resolve(data);
    const cache = await caches.open(PREFIX + data.version);
    await cache.put(absolute('offline-assets.json'), response);
    const shell = data.assets.filter(path => !path.startsWith('assets/images/') && !path.startsWith('assets/portraits/') && !path.startsWith('osoba/') && !/^(?:sv|bl|sb)-[^/]+\/index\.html$/.test(path));
    await cache.addAll(shell.map(path => new Request(absolute(path), { cache: 'reload' })));
    // Content-addressed images already saved by an older version can be reused.
    await Promise.all(data.assets.filter(path => path.startsWith('assets/images/')).map(async path => {
      const existing = await caches.match(absolute(path));
      if (existing) await cache.put(absolute(path), existing);
    }));
    // Activation replaces the cache and refreshes open pages once on upgrade.
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const data = await inventory();
    const current = PREFIX + data.version;
    const obsolete = (await caches.keys()).filter(key => key.startsWith(PREFIX) && key !== current);
    await Promise.all(obsolete.map(key => caches.delete(key)));
    await self.clients.claim();
    // This also upgrades pages running the previous app, which cannot know
    // about new controllerchange handlers. First installations do not reload.
    if (obsolete.length) {
      const windows = await self.clients.matchAll({ type: 'window' });
      // Do not hold activation open until navigation finishes: those requests
      // must be able to reach the newly activated worker.
      for (const client of windows) client.navigate(client.url).catch(() => {});
    }
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const data = await inventory();
    const cache = await caches.open(PREFIX + data.version);
    if (event.request.mode === 'navigate') {
      const relative = url.pathname.slice(new URL(self.registration.scope).pathname.length);
      const target = relative === '' || relative === 'index.html' ? 'index.html' : relative.endsWith('/') ? relative + 'index.html' : relative;
      if (data.assets.includes(target)) {
        const page = await cache.match(absolute(target));
        if (page) return page;
        try {
          const response = await fetch(event.request, { cache: 'reload' });
          if (response.ok) await cache.put(absolute(target), response.clone());
          return response;
        } catch {
          const match = target.match(/^(?:osoba\/)?([^/]+)\/index\.html$/);
          if (match) return Response.redirect(absolute('index.html') + '#' + match[1], 302);
          throw new Error('Page unavailable offline');
        }
      }
      return fetch(event.request);
    }
    const existing = await cache.match(event.request);
    if (existing) return existing;
    const response = await fetch(event.request, { cache: 'reload' });
    if (response.ok && data.assets.some(path => absolute(path) === event.request.url)) await cache.put(event.request, response.clone());
    return response;
  })());
});

async function report(source, message) {
  if (source?.postMessage) source.postMessage(message);
}

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') { event.waitUntil(self.skipWaiting()); return; }
  if (!['GET_STATUS', 'DOWNLOAD_ALL'].includes(event.data?.type)) return;
  event.waitUntil((async () => {
    try {
      const data = await inventory();
      const cache = await caches.open(PREFIX + data.version);
      const urls = data.assets.map(absolute);
      if (event.data.type === 'GET_STATUS') {
        const found = await Promise.all(urls.map(url => cache.match(url)));
        const done = found.filter(Boolean).length;
        await report(event.source, { type: 'OFFLINE_STATUS', complete: done === urls.length, done, total: urls.length });
        return;
      }
      if (!downloadPromise) downloadPromise = (async () => {
        let cursor = 0, done = 0;
        await Promise.all(Array.from({ length: 4 }, async () => {
          while (cursor < urls.length) {
            const url = urls[cursor++];
            if (!await cache.match(url)) {
              const response = await fetch(url, { cache: 'reload' });
              if (!response.ok) throw new Error('Offline asset unavailable');
              await cache.put(url, response);
            }
            done++;
            await report(event.source, { type: 'OFFLINE_PROGRESS', done, total: urls.length });
          }
        }));
      })().finally(() => { downloadPromise = null; });
      await downloadPromise;
      await report(event.source, { type: 'OFFLINE_READY', done: urls.length, total: urls.length });
    } catch {
      await report(event.source, { type: 'OFFLINE_ERROR' });
    }
  })());
});
