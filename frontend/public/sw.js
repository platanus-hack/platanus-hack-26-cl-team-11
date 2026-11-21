const CACHE = 'montu-app-v1';
const SHELL = '/__shell';
const RESTARTING = [502, 503, 504];
const NOT_THE_APP = ['/api/', '/a/', '/design/'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

async function saved(cache, request) {
  return (await cache.match(request)) ?? (request.mode === 'navigate' ? cache.match(SHELL) : undefined);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      if (request.mode === 'navigate') await cache.put(SHELL, response.clone());
      return response;
    }
    return (RESTARTING.includes(response.status) && (await saved(cache, request))) || response;
  } catch (failure) {
    const fallback = await saved(cache, request);
    if (fallback) return fallback;
    throw failure;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || NOT_THE_APP.some((prefix) => url.pathname.startsWith(prefix))) return;
  event.respondWith(networkFirst(request));
});
