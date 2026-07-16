// IMFine — self-destructing service worker.
// The old caching service worker caused stale/blank screens. This replacement
// deletes all caches and removes itself from any device that still has it.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(c => c.navigate(c.url));
  })());
});
// No fetch handler: requests go straight to the network, never a stale cache.
