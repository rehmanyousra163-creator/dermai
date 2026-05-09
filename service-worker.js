// DERMAI Service Worker - Offline support and caching
const CACHE_NAME = 'dermai-cache-v1.0';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Complete offline fallback HTML
const FALLBACK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>DERMAI - Offline</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body { 
      margin: 0; 
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      color: white;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
    }
    .offline-icon {
      width: 120px;
      height: 120px;
      margin-bottom: 30px;
      background: rgba(233, 69, 96, 0.2);
      border-radius: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 60px;
    }
    h1 { 
      font-size: 28px; 
      margin-bottom: 15px;
      background: linear-gradient(135deg, #e94560, #ff6b81);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    p { 
      font-size: 16px; 
      opacity: 0.8; 
      margin-bottom: 15px;
      max-width: 300px;
    }
    .sub-text {
      font-size: 14px;
      opacity: 0.6;
      margin-bottom: 30px;
    }
    .retry-btn {
      background: linear-gradient(135deg, #e94560, #ff6b81);
      color: white;
      border: none;
      padding: 15px 40px;
      font-size: 16px;
      border-radius: 30px;
      cursor: pointer;
      transition: transform 0.3s, box-shadow 0.3s;
      box-shadow: 0 4px 15px rgba(233, 69, 96, 0.3);
    }
    .retry-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 20px rgba(233, 69, 96, 0.4);
    }
    .retry-btn:active {
      transform: scale(0.95);
    }
  </style>
</head>
<body>
  <div class="offline-icon">
    📡
  </div>
  <h1>DERMAI Scanner</h1>
  <p>You are currently offline</p>
  <p class="sub-text">Some features may be unavailable</p>
  <button class="retry-btn" onclick="window.location.reload()">
    🔄 Retry Connection
  </button>
</body>
</html>`;

// Install Service Worker - Cache essential files
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Installing DERMAI...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[ServiceWorker] Installation complete');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[ServiceWorker] Error during installation:', err);
      })
  );
});

// Activate Service Worker - Clean old caches
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[ServiceWorker] Now ready to handle fetches');
      return self.clients.claim();
    })
  );
});

// Fetch - Network-first for external, cache-first for static
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Don't cache external Hugging Face URLs (let them load fresh)
  if (url.hostname.includes('hf.space') || url.hostname.includes('huggingface')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Return offline page for navigation
          if (event.request.mode === 'navigate') {
            return new Response(FALLBACK_HTML, {
              headers: { 'Content-Type': 'text/html' }
            });
          }
          return new Response('Network error - offline', { status: 503 });
        })
    );
    return;
  }
  
  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          console.log('[ServiceWorker] Cache HIT:', url.pathname);
          return cachedResponse;
        }
        
        console.log('[ServiceWorker] Cache MISS:', url.pathname);
        return fetch(event.request)
          .then(response => {
            // Cache valid responses
            if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            // Return fallback for navigation
            if (event.request.mode === 'navigate') {
              console.log('[ServiceWorker] Returning offline fallback');
              return new Response(FALLBACK_HTML, {
                headers: { 'Content-Type': 'text/html' }
              });
            }
            return new Response('Offline', { status: 503 });
          });
      })
  );
});

// Listen for messages from clients
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[ServiceWorker] Skipping waiting');
    self.skipWaiting();
  }
});