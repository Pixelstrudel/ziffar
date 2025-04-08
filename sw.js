// Einfacher Service Worker für Offline-Fähigkeit (sw.js)

const CACHE_NAME = 'ziffar-cache-v1';
const urlsToCache = [
  '/',
  '/index.html', // Oder wie auch immer deine Haupt-HTML-Datei heißt
  // Füge hier Pfade zu wichtigen CSS-, JS-Dateien und Icons hinzu
  // Beispiel: '/style.css', '/script.js', '/icons/icon-192x192.png'
  'https://cdn.tailwindcss.com', // Tailwind CDN
   'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap' // Google Fonts
   // Die Font-Dateien selbst werden evtl. separat von der CSS gecached, je nach Browserverhalten
];

// Installation: Cache öffnen und Dateien hinzufügen
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Wichtige Ressourcen cachen. fetch() wird benötigt, um externe Ressourcen (CDN) zu holen.
        const cachePromises = urlsToCache.map(urlToCache => {
            // Für externe URLs muss der Request Mode 'no-cors' sein, wenn keine CORS Header gesetzt sind
            // Aber für CDNs wie unpkg und Google Fonts sind CORS Header normalerweise vorhanden.
             let request = new Request(urlToCache, { mode: 'cors' }); // Standard 'cors' sollte funktionieren
             return fetch(request).then(response => {
                if (!response.ok) {
                    // Bei Fehlern (z.B. 404) nicht versuchen zu cachen und Fehler loggen
                    console.error(`Failed to fetch ${urlToCache} for caching. Status: ${response.status}`);
                    // Wir werfen keinen Fehler, um den SW nicht am Installieren zu hindern,
                    // aber die Ressource wird nicht im Cache sein.
                    return Promise.resolve(); // Weiter mit anderen URLs
                }
                // Nur gültige Antworten cachen
                return cache.put(request, response);
            }).catch(error => {
                console.error(`Fetching ${urlToCache} failed:`, error);
                 // Fehler beim Fetch (z.B. Netzwerkproblem)
                return Promise.resolve(); // Weiter mit anderen URLs
            });
        });
        return Promise.all(cachePromises);
      })
      .then(() => {
          console.log('All specified resources have been cached (or skipped on error).');
          // Wichtig: skipWaiting() sorgt dafür, dass der neue SW sofort aktiv wird
          return self.skipWaiting();
      })
  );
});

// Aktivierung: Alten Cache löschen (optional aber empfohlen)
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
        // Wichtig: clients.claim() sorgt dafür, dass der SW die Kontrolle über offene Seiten übernimmt
        return self.clients.claim();
    })
  );
});

// Fetch: Anfragen abfangen und aus Cache bedienen oder Netzwerk anfragen
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        // Nicht im Cache - Netzwerk anfragen
        return fetch(event.request).then(
          networkResponse => {
            // Prüfen, ob wir eine gültige Antwort erhalten haben
            if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
              return networkResponse;
            }

            // WICHTIG: Antwort klonen. Eine Antwort ist ein Stream und
            // kann nur einmal konsumiert werden. Wir brauchen eine Kopie für den Browser
            // und eine für den Cache.
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                 // Nur GET Requests cachen
                 if (event.request.method === 'GET') {
                    cache.put(event.request, responseToCache);
                 }
              });

            return networkResponse;
          }
        ).catch(error => {
            // Netzwerkfehler - hier könnte man eine Offline-Fallback-Seite anzeigen
            console.log('Fetch failed; returning offline page instead.', error);
            // Optional: return caches.match('/offline.html');
        });
      })
  );
});
