const CACHE_NAME = 'zi-trace-static-v1';
const API_CACHE_NAME = 'zi-trace-api-v1';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/idioms.html',
  '/style.css',
  '/idioms.js',
  '/idioms_data.js',
  '/images/title/gu.png',
  '/images/title/wen.png',
  '/images/title/zi.png',
  '/images/title/cheng.png',
  '/images/title/yu.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== API_CACHE_NAME)
            .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  // Skip proxy API and extension schemes
  if (url.pathname.startsWith('/api/') || url.protocol === 'chrome-extension:') return;

  event.respondWith(
    caches.match(event.request).then(response => {
      // Stale-while-revalidate strategy for static assets
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse.ok) {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
          });
        }
        return networkResponse;
      }).catch(err => {
        console.log('Fetch failed, serving from cache only:', err);
      });

      return response || fetchPromise;
    })
  );
});
