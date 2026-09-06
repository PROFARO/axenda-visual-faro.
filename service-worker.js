const CACHE_NAME = 'faro-offline-v1';

const APP_SHELL = [
  './axenda.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cache ARASAAC requests as they are used. This lets pictograms
  // already consulted while online remain available offline.
  const isArasaac =
    url.hostname === 'api.arasaac.org' ||
    url.hostname === 'static.arasaac.org';

  if (isArasaac) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;

        return fetch(request).then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        }).catch(() => new Response('', {
          status: 503,
          statusText: 'Offline'
        }));
      })
    );
    return;
  }

  // App shell: cache first, then network.
  if (url.pathname.endsWith('/axenda.html') ||
      url.pathname.endsWith('/manifest.json')) {
    event.respondWith(
      caches.match(request).then(cached => {
        const network = fetch(request).then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        });

        return cached || network.catch(() => caches.match('./axenda.html'));
      })
    );
  }
});
