// ShoppieApp Service Worker — single source of truth.
// IMPORTANT: This file is the ONLY service worker registered at scope "/".
// We do NOT register a separate /sw.js any more, because Android Chrome
// rejects two competing workers at the same scope and silently unsubscribes
// the device after a few "missed" pushes.
//
// Order matters: importScripts MUST be called first so OneSignal can take
// over the push and notificationclick events before any of our own handlers
// run.
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js")

// ── PWA caching (was previously in /sw.js) ───────────────────────────────────
const CACHE_VERSION = "v3"
const STATIC_CACHE  = `shoppie-static-${CACHE_VERSION}`
const DYNAMIC_CACHE = `shoppie-dynamic-${CACHE_VERSION}`
const IMAGE_CACHE   = `shoppie-images-${CACHE_VERSION}`

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

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  )
})

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

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Don't intercept anything OneSignal needs.
  if (url.hostname.includes("onesignal.com") || url.pathname.includes("OneSignalSDK")) {
    return
  }

  if (
    request.method !== "GET" ||
    url.protocol === "chrome-extension:" ||
    url.hostname.includes("supabase.co")
  ) {
    return
  }

  if (url.pathname === "/sw.js" || url.pathname.startsWith("/api/")) {
    return
  }

  if (
    request.destination === "image" ||
    url.hostname === "res.cloudinary.com" ||
    url.hostname.includes("pexels.com")
  ) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE))
    return
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json"
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithOfflineFallback(request))
    return
  }

  event.respondWith(networkFirst(request, DYNAMIC_CACHE))
})

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
    return (
      offlinePage ||
      new Response("<h1>You are offline</h1>", { headers: { "Content-Type": "text/html" } })
    )
  }
}

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length > maxItems) {
    await cache.delete(keys[0])
  }
}
