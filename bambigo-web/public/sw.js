const CACHE_NAME = 'bambigo-pwa-v2'
self.addEventListener('install', () => {
  self.skipWaiting()
})
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})
async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(req)
  if (cached) return cached
  const res = await fetch(req)
  if (res && res.ok) await cache.put(req, res.clone())
  return res
}
async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME)
  try {
    const res = await fetch(req)
    if (res && res.ok) await cache.put(req, res.clone())
    return res
  } catch (e) {
    const cached = await cache.match(req)
    if (cached) return cached
    throw e
  }
}
self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (url.origin === location.origin && url.pathname.startsWith('/api/nodes')) {
    event.respondWith(networkFirst(req))
    return
  }
  if (url.hostname.endsWith('maplibre.org') || url.hostname === 'tile.openstreetmap.org') {
    event.respondWith(cacheFirst(req))
    return
  }
})

self.addEventListener('push', () => {
  // event is unused for now
})
