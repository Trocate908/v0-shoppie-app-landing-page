// ShoppieApp Service Worker — v2
// Bump CACHE_VERSION when you need to force all clients to update.
const CACHE_VERSION = "v2"
const STATIC_CACHE = `shoppie-static-${CACHE_VERSION}`
const DYNAMIC_CACHE = `shoppie-dynamic-${CACHE_VERSION}`
const IMAGE_CACHE = `shoppie-images-${CACHE_VERSION}`

const STATIC_ASSETS = [
  "/",
  "/offline",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
]

const CACHE_LIMITS = {
  [DYNAMIC_CACHE]: 60,
  [IMAGE_CACHE]: 100,
}

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  // skipWaiting activates the new SW immediately without waiting for all
  // existing tabs to close. This is critical for push: if the old SW is
  // still active, NEW push handlers from this file won't fire.
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        cache.addAll(STATIC_ASSETS).catch(() => {
          // Don't block installation if an asset is temporarily unavailable.
        })
      )
      .then(() => self.skipWaiting())
  )
})

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  const allowed = [STATIC_CACHE, DYNAMIC_CACHE, IMAGE_CACHE]
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !allowed.includes(k)).map((k) => caches.delete(k)))
      )
      // clients.claim() makes this SW control all open tabs immediately so
      // that push messages sent right after activation are handled by this SW.
      .then(() => self.clients.claim())
  )
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET, browser-extension, and Supabase API requests
  if (
    request.method !== "GET" ||
    url.protocol === "chrome-extension:" ||
    url.hostname.includes("supabase.co")
  ) {
    return
  }

  // Never cache the SW itself or API routes
  if (url.pathname === "/sw.js" || url.pathname.startsWith("/api/")) {
    return
  }

  // Image caching — cache first, then network
  if (
    request.destination === "image" ||
    url.hostname === "res.cloudinary.com" ||
    url.hostname.includes("pexels.com")
  ) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE))
    return
  }

  // Static assets — cache first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json"
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // HTML navigation — network first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithOfflineFallback(request))
    return
  }

  // Everything else — network first with dynamic cache
  event.respondWith(networkFirst(request, DYNAMIC_CACHE))
})

// ── Strategies ────────────────────────────────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
      trimCache(cacheName, CACHE_LIMITS[cacheName] || 50)
    }
    return response
  } catch {
    return new Response("Offline", { status: 503 })
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
      trimCache(cacheName, CACHE_LIMITS[cacheName] || 50)
    }
    return response
  } catch {
    const cached = await caches.match(request)
    return cached || new Response("Offline", { status: 503 })
  }
}

async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    const offlinePage = await caches.match("/offline")
    return offlinePage || new Response("<h1>You are offline</h1>", { headers: { "Content-Type": "text/html" } })
  }
}

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length > maxItems) {
    await cache.delete(keys[0])
  }
}

// ── Push Notifications ──────────────────────────────────────────────────────
//
// This handler fires even when the browser tab is CLOSED. The browser's
// background push service (Google/Mozilla/Apple) wakes this service worker
// when a push arrives from the server, and this code runs silently in the
// background to display the OS notification.
//
// Payload shape sent by lib/push/server.ts:
//   { title, body, link, image, data, tag }
//
self.addEventListener("push", (event) => {
  let data = {}
  if (event.data) {
    try {
      data = event.data.json()
    } catch {
      data = { title: "ShoppieApp", body: event.data.text() }
    }
  }

  const title = data.title || "ShoppieApp"
  const body  = data.body  || "You have a new update"
  const link  = data.link  || "/"
  const image = data.image || undefined
  const tag   = data.tag   || ("shoppie-" + Date.now())

  const options = {
    body,
    icon: "/logo.png",
    badge: "/logo.png",
    image,
    tag,
    // requireInteraction keeps the notification on-screen until the user
    // taps it — exactly like Facebook / Instagram / WhatsApp behaviour.
    requireInteraction: true,
    renotify: true,
    silent: false,
    vibrate: [200, 100, 200, 100, 200],
    timestamp: Date.now(),
    data: { link, ...data },
    actions: [
      { action: "open",    title: "Open"    },
      { action: "dismiss", title: "Dismiss" },
    ],
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Tell any open tabs so they can update unread badges in real-time
      // and play an in-app sound when the user is focused on the app.
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clients) => {
          clients.forEach((c) => c.postMessage({ type: "shoppie-push", payload: data }))
        }),
    ])
  )
})

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  if (event.action === "dismiss") return

  const link = (event.notification.data && event.notification.data.link) || "/"
  const targetUrl = new URL(link, self.location.origin).href

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Try to reuse an existing tab on the same origin.
        for (const client of clientList) {
          try {
            const clientUrl = new URL(client.url)
            if (clientUrl.origin === self.location.origin) {
              // navigate() may not exist on all WindowClient implementations.
              if (typeof client.navigate === "function") {
                client.navigate(targetUrl).catch(() => {})
              }
              if (typeof client.focus === "function") {
                return client.focus()
              }
            }
          } catch {
            // Ignore invalid client URLs.
          }
        }
        // No existing tab — open a new one.
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }
      })
  )
})

// ── Push subscription change ──────────────────────────────────────────────────
// Fired by the browser when it rotates the push subscription endpoint.
// We post a message to open tabs so they can re-register the new subscription.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        clients.forEach((c) =>
          c.postMessage({ type: "shoppie-subscription-changed" })
        )
      })
  )
})
