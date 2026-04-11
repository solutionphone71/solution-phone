// Service Worker — Solution Phone — Mode hors-ligne
var CACHE_NAME = 'sp-cache-v3';
var URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/client.html'
];

// Installation : mettre en cache les fichiers essentiels
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] Cache ouvert');
      return cache.addAll(URLS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activation : nettoyer les anciens caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
          .map(function(n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

// Fetch : Network First pour les pages, skip pour les API
self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);

  // Ne pas intercepter les appels API
  if (url.pathname.startsWith('/api/') || url.hostname !== self.location.hostname) {
    return;
  }

  // Pages HTML et assets : Network First, fallback cache
  e.respondWith(
    fetch(e.request).then(function(response) {
      var responseClone = response.clone();
      caches.open(CACHE_NAME).then(function(cache) {
        cache.put(e.request, responseClone);
      });
      return response;
    }).catch(function() {
      return caches.match(e.request).then(function(cached) {
        return cached || new Response('Hors ligne', {status: 503});
      });
    })
  );
});
