const CACHE_NAME = 'ziffar-cache-v1'; // Consider incrementing cache name on major updates (e.g., v2)
const urlsToCache = [
  '/',
  '/index.html', // Assuming you rename the main HTML file to index.html
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap',
  // Try to cache the actual font file if possible, get URL from browser dev tools Network tab
  // Example: 'https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5nw.woff2'
];

// Install event: Cache essential assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Use addAll for atomic caching
        return cache.addAll(urlsToCache).catch(error => {
          console.error('Failed to cache initial assets:', error);
          // Fallback for essential files if addAll fails
          return Promise.all([
             cache.add('/'),
             cache.add('/index.html')
          ]).catch(essentialError => {
              console.error('Failed to cache essential assets:', essentialError);
          });
        });
      })
  );
});

// Fetch event: Serve cached assets if available, otherwise fetch from network
self.addEventListener('fetch', event => {
  // Skip caching for non-GET requests or chrome-extension URLs
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request because it's a stream and can only be consumed once.
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          response => {
            // Check if we received a valid response
            // Allow caching basic and CORS responses. Be cautious with opaque responses.
            if (!response || response.status !== 200 || (response.type !== 'basic' && response.type !== 'cors')) {
              return response;
            }

            // Clone the response because it's also a stream.
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                 cache.put(event.request, responseToCache);
              });

            return response;
          }
        ).catch(error => {
            console.error("Fetch failed; returning offline page instead.", error);
            // Optional: Return a basic offline fallback page if fetch fails
            // return caches.match('/offline.html');
        });
      })
    );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME]; // Keep only the current cache version
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
    })
  );
});
