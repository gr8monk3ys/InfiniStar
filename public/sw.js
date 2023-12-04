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

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data = {}
      try {
        data = event.data ? event.data.json() : {}
      } catch {
        const text = event.data ? event.data.text() : ""
        data = { body: text }
      }

      const title = data.title || "InfiniStar"
      const body = data.body || "New activity"
      const url = data.url || "/"
      const tag = data.tag || undefined
      const icon = data.icon || "/icon-192.png"

      const isTest = tag === "test" || data.force === true

      // If the app is already open in any window/tab, let the in-app notification
      // system handle it to avoid duplicates. (Test pushes bypass this.)
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      if (clientsList.length > 0 && !isTest) return

      await self.registration.showNotification(title, {
        body,
        icon,
        tag,
        data: { url },
      })
    })()
  )
})

self.addEventListener("notificationclick", (event) => {
  const url = (event.notification && event.notification.data && event.notification.data.url) || "/"

  event.notification.close()

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true })

      for (const client of clientsList) {
        try {
          if ("focus" in client) {
            await client.focus()
          }

          if ("navigate" in client) {
            await client.navigate(url)
          }

          return
        } catch {
          // Fall back to opening a new window.
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(url)
      }
    })()
  )
})
