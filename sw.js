'use strict';
// Build updates this identifier so a changed inventory triggers a worker update.
const BUILD_VERSION = 'c8727847471fe69cc5b28564595accc56589959cea5adf079c8e0db7f64170aa';
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
    return response.json();
  })();
  return inventoryPromise;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch(absolute('offline-assets.json'), { cache: 'no-store' });
    if (!response.ok) throw new Error('Offline inventory unavailable');
    const data = await response.clone().json();
    inventoryPromise = Promise.resolve(data);
    const cache = await caches.open(PREFIX + data.version);
    await cache.put(absolute('offline-assets.json'), response);
    const shell = data.assets.filter(path => !path.startsWith('assets/images/') && !path.startsWith('assets/portraits/') && !path.startsWith('osoba/'));
    await cache.addAll(shell.map(absolute));
    // Content-addressed images already saved by an older version can be reused.
    await Promise.all(data.assets.filter(path => path.startsWith('assets/images/')).map(async path => {
      const existing = await caches.match(absolute(path));
      if (existing) await cache.put(absolute(path), existing);
    }));
    // Activate updates without interrupting the current reading session.
    // The next navigation/reload receives the newly cached version.
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const data = await inventory();
    const current = PREFIX + data.version;
    await Promise.all((await caches.keys()).filter(key => key.startsWith(PREFIX) && key !== current).map(key => caches.delete(key)));
    await self.clients.claim();
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
          const response = await fetch(event.request);
          if (response.ok) await cache.put(absolute(target), response.clone());
          return response;
        } catch {
          const match = target.match(/^osoba\/([^/]+)\/index\.html$/);
          if (match) return Response.redirect(absolute('index.html') + '#' + match[1], 302);
          throw new Error('Page unavailable offline');
        }
      }
      return fetch(event.request);
    }
    const existing = await cache.match(event.request);
    if (existing) return existing;
    const response = await fetch(event.request);
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
