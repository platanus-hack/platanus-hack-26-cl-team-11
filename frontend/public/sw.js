const CACHE = 'montu-app-v1';
const SHELL = '/__shell';
const RESTARTING = [502, 503, 504];
const NOT_THE_APP = ['/api/', '/a/', '/design/', '/skills/'];
const SERVER_PAGES = ['/dec', '/deck', '/prep', '/problema', '/libro'];
const NEVER_CHANGES = '/assets/';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

async function keptFirst(request) {
  const cache = await caches.open(CACHE);
  const kept = await cache.match(request);
  if (kept) return kept;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function shellNow(event) {
  const cache = await caches.open(CACHE);
  const kept = await cache.match(SHELL);
  const fresh = fetch(event.request).then(async (response) => {
    if (response.ok) await cache.put(SHELL, response.clone());
    return response;
  });
  if (!kept) return fresh;
  event.waitUntil(fresh.catch(() => undefined));
  return kept;
}

async function networkFirst(request, cacheKey = request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(cacheKey, response.clone());
      return response;
    }
    return (RESTARTING.includes(response.status) && (await cache.match(cacheKey))) || response;
  } catch (failure) {
    const kept = await cache.match(cacheKey);
    if (kept) return kept;
    throw failure;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || NOT_THE_APP.some((prefix) => url.pathname.startsWith(prefix)) || SERVER_PAGES.includes(url.pathname)) return;
  if (request.mode === 'navigate' && /^\/equipo\/[^/]+\/hilos(?:\/|$)/.test(url.pathname)) {
    event.respondWith(networkFirst(request, SHELL));
  } else if (request.mode === 'navigate') event.respondWith(shellNow(event));
  else if (url.pathname.startsWith(NEVER_CHANGES)) event.respondWith(keptFirst(request));
  else event.respondWith(networkFirst(request));
});
