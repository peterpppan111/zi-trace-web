const CACHE_NAME = 'zi-trace-static-v2';
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
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => cache.add(url).catch(err => console.warn('Cache fail:', url)))
      );
    })
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
  if (url.pathname.startsWith('/api/') || url.protocol === 'chrome-extension:') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(err => {
        console.log('Network fetch failed:', err);
        throw err;
      });

      if (cachedResponse) {
        return cachedResponse;
      }

      return fetchPromise.catch(err => {
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html').then(idx => idx || new Response('Offline', {status: 503}));
        }
        return new Response('', { status: 408 });
      });
    })
  );
});
