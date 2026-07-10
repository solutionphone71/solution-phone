// Service Worker — Solution Phone — Mode hors-ligne
// v8 (10/07/2026) : les navigations chargent TOUJOURS la version fraîche du réseau
// (cache:'reload' → contourne le cache disque du navigateur qui servait une vieille
// copie de l'app pendant plusieurs minutes/heures après chaque déploiement).
var CACHE_NAME = 'sp-cache-v8';
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

  // Pages HTML et assets : Network First, fallback cache.
  // Pour les NAVIGATIONS (ouverture/rechargement de l'app) : cache:'reload'
  // → on ignore le cache disque du navigateur et on prend la version du serveur.
  var req = e.request;
  if (e.request.mode === 'navigate' || (e.request.destination === 'document')) {
    req = new Request(e.request.url, { cache: 'reload', credentials: 'same-origin' });
  }
  e.respondWith(
    fetch(req).then(function(response) {
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
