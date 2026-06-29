self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        // Delete all caches including API cache to be completely safe
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => {
      self.registration.unregister();
    })
  );
});

self.addEventListener('fetch', (e) => {
  // Do absolutely nothing, let requests pass through directly to network
});
