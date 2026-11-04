// ============================================================
// Mobile-app (PWA) mode is turned OFF in this version.
// This file only removes a service worker that an earlier test
// version may have installed in a browser, and clears its cache.
// Safe to delete once nobody uses the old version any more.
// ============================================================

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
        await self.registration.unregister();
        const clients = await self.clients.matchAll({ type: "window" });
        clients.forEach(client => client.navigate(client.url));
    })());
});
