/* Minimal service worker to satisfy PWA install criteria.
 * No offline caching yet (pass-through fetch). */

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return
  event.respondWith(fetch(event.request))
})

