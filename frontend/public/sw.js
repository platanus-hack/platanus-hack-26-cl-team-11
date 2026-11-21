const CACHE = 'montu-app-v2';
const ASSETS = '/assets/';
const NOT_FOUND = 404;
const SHELL = '/__shell';
const RESTARTING = [502, 503, 504];
const NOT_THE_APP = ['/api/', '/a/', '/design/'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  ),
);

const isAsset = (request) => new URL(request.url).pathname.startsWith(ASSETS);
const isPageInsteadOfAsset = (request, response) => isAsset(request) && (response.headers.get('content-type') ?? '').includes('text/html');

async function saved(cache, request) {
  return (await cache.match(request)) ?? (request.mode === 'navigate' ? cache.match(SHELL) : undefined);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    const replaced = isPageInsteadOfAsset(request, response);
    if (response.ok && !replaced) {
      await cache.put(request, response.clone());
      if (request.mode === 'navigate') await cache.put(SHELL, response.clone());
      return response;
    }
    const gone = replaced || (isAsset(request) && response.status === NOT_FOUND);
    const fallback = RESTARTING.includes(response.status) || gone ? await saved(cache, request) : undefined;
    return fallback ?? (replaced ? new Response('', { status: NOT_FOUND }) : response);
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
