const CACHE_VERSION = 'guitar-tabs-pwa-v1';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './apple-touch-icon.png',
  './pwa-192.png',
  './pwa-512.png',
  './pwa-maskable-192.png',
  './pwa-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(CORE_ASSETS.map((path) => toScopedUrl(path)))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => !cacheName.startsWith(CACHE_VERSION))
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (isCacheableAssetRequest(request)) {
    event.respondWith(handleRuntimeAssetRequest(request));
  }
});

async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(APP_SHELL_CACHE);
    cache.put(toScopedUrl('./'), networkResponse.clone());
    return networkResponse;
  } catch {
    const cachedShell = await caches.match(toScopedUrl('./'));
    if (cachedShell) {
      return cachedShell;
    }

    throw new Error('Offline and no cached app shell is available.');
  }
}

async function handleRuntimeAssetRequest(request) {
  const cachedResponse = await caches.match(request);
  const fetchPromise = fetch(request)
    .then(async (networkResponse) => {
      if (networkResponse.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, networkResponse.clone());
      }

      return networkResponse;
    })
    .catch(() => cachedResponse);

  return cachedResponse || fetchPromise;
}

function isCacheableAssetRequest(request) {
  return ['script', 'style', 'image', 'font'].includes(request.destination) || request.url.endsWith('.webmanifest');
}

function toScopedUrl(path) {
  return new URL(path, self.registration.scope).toString();
}
