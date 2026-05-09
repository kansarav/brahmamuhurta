// Brahma Muhurta service worker
// Caches the shell of the site for offline use. Audio files are cached
// opportunistically as the user plays them, not pre-fetched.

const CACHE_VERSION = 'bm-v1';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const AUDIO_CACHE = `${CACHE_VERSION}-audio`;

// Pages and assets to cache on install
const SHELL_FILES = [
  '/',
  '/teachings/',
  '/teachings/sankalpa',
  '/teachings/pranayama',
  '/icon.svg',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      // Add shell files but don't fail install if any are missing
      return Promise.all(
        SHELL_FILES.map((url) =>
          cache.add(url).catch(() => console.warn('SW: skipped caching', url))
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clean up old cache versions
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Audio files: network-first, cache-fallback. Stash in audio cache for offline replay.
  if (url.pathname.startsWith('/audio/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(AUDIO_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // HTML: network-first so updates land quickly when online; cache fallback.
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Everything else (icons, manifest, fonts): cache-first.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
