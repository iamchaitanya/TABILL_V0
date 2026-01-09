const CACHE_NAME = 'tabill-v1';
// We only cache the basics manually. The browser handles the rest.
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Important for instant updates
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('fetch', (event) => {
  // Simple network-first strategy to avoid "White Screen" issues
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
