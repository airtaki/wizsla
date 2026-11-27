// The web app's service worker (HTTPS only). It keeps the app's own files,
// never the API's answers: the lights' state is always asked fresh.
//
// - /app/assets/*: content-hashed, so cached for good (newest 60 kept).
// - pages: from the network; the cached app only when the Pi is unreachable,
//   so the app can say so instead of Safari's error page.
// - other app files (icons, manifest): cached, refreshed in the background.

const ASSETS = 'wizsla-assets-v1';
const SHELL = 'wizsla-shell-v1';
const KEEP_ASSETS = 60;
const APP = '/app/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.add(APP))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== ASSETS && name !== SHELL)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(APP)
  ) {
    return; // The API and everything else go straight to the network.
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  } else if (url.pathname.startsWith(`${APP}assets/`)) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(APP, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(APP);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    const keys = await cache.keys(); // oldest first
    await Promise.all(
      keys.slice(0, -KEEP_ASSETS).map((key) => cache.delete(key)),
    );
  }
  return response;
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(request);
  const fresh = fetch(request).then(async (response) => {
    if (response.ok) await cache.put(request, response.clone());
    return response;
  });
  if (cached) {
    event.waitUntil(fresh.catch(() => {}));
    return cached;
  }
  return fresh;
}
