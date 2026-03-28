// Service Worker — Solution Phone
// v3 — support modules JS séparés (js/core.js, js/reparations.js, etc.)
const CACHE_NAME = 'solution-phone-v3';

const STATIC_FILES = [
  '/',
  '/index.html',
  '/js/images.js',
  '/js/core.js',
  '/js/reparations.js',
  '/js/qualirepar.js',
  '/manifest.json'
];

// Installation : mettre en cache les fichiers statiques
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_FILES);
    })
  );
  self.skipWaiting(); // Activer immédiatement
});

// Activation : supprimer les anciens caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) {
            console.log('[SW] Suppression ancien cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim(); // Prendre le contrôle immédiatement
});

// Fetch : network-first pour les JS, cache-first pour le reste
self.addEventListener('fetch', function(event) {
  var url = event.request.url;
  
  // Toujours aller chercher en réseau pour Supabase, AgoraPlus, Anthropic
  if (url.includes('supabase.co') || 
      url.includes('agoraplus') || 
      url.includes('anthropic.com') ||
      url.includes('ecologic-france.com') ||
      url.includes('ecosystem.eco') ||
      url.includes('vosfactures.fr')) {
    return; // Laisser passer sans intercepter
  }

  // Network-first pour les fichiers JS (toujours la version la plus récente)
  if (url.includes('/js/') || url.endsWith('.js')) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
          return response;
        })
        .catch(function() {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Cache-first pour index.html et autres ressources statiques
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      var networkFetch = fetch(event.request).then(function(response) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return response;
      });
      return cached || networkFetch;
    })
  );
});
