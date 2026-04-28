// ShoppieApp Service Worker
const CACHE_VERSION = "v1"
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
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
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

// ── Push Notifications (native Web Push, Facebook-style) ────────────────────
//
// Payload shape sent by lib/push/server.ts:
//   { title, body, link, image, data, tag }
//
// requireInteraction keeps the notification visible until tapped (same as
// FB web push). renotify + vibrate ensures the device buzzes even when a
// notification with the same tag is replaced.
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
  const body = data.body || "You have a new update"
  const link = data.link || "/"
  const image = data.image || undefined
  const tag = data.tag || ("shoppie-" + Date.now())

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body,
        icon: "/logo.png",
        badge: "/logo.png",
        image,
        tag,
        requireInteraction: true,
        renotify: true,
        silent: false,
        vibrate: [200, 100, 200, 100, 200],
        timestamp: Date.now(),
        data: { link, ...data },
        actions: [
          { action: "open", title: "Open" },
          { action: "dismiss", title: "Dismiss" },
        ],
      }),
      // Tell any open tabs so they can update unread badges in real time
      // and (optionally) play an in-app sound when focused.
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clients) => {
          clients.forEach((c) => c.postMessage({ type: "shoppie-push", payload: data }))
        }),
    ])
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  if (event.action === "dismiss") return
  const target = (event.notification.data && event.notification.data.link) || "/"
  const targetUrl = new URL(target, self.location.origin).href

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Prefer focusing an existing tab on our origin and navigating it.
        for (const c of clientList) {
          try {
            const u = new URL(c.url)
            if (u.origin === self.location.origin && "focus" in c) {
              c.navigate(targetUrl).catch(() => {})
              return c.focus()
            }
          } catch {
            // ignore
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
      })
  )
})
