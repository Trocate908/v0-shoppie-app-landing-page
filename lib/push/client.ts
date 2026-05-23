"use client"

/**
 * Native Web Push client helpers.
 *
 * The browser:
 *   1. Asks the user for notification permission.
 *   2. Registers our service worker (/sw.js) at scope "/".
 *   3. Subscribes via PushManager with our VAPID public key.
 *   4. Sends the resulting PushSubscription JSON to our backend.
 *
 * All four steps are awaited in a single function: subscribeToPush().
 */

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  )
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null
  // Try to find an existing registration.
  let reg = await navigator.serviceWorker.getRegistration("/")
  if (!reg) {
    try {
      reg = await navigator.serviceWorker.register("/OneSignalSDKWorker.js", { scope: "/" })
    } catch (err) {
      console.error("[push] failed to register service worker:", err)
      return null
    }
  }
  // Wait for the active worker.
  await navigator.serviceWorker.ready
  return reg
}

async function getVapidPublicKey(): Promise<string | null> {
  // Prefer the build-time constant (no extra HTTP).
  const fromEnv = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (fromEnv) return fromEnv
  // Fall back to a tiny server endpoint.
  try {
    const res = await fetch("/api/push/vapid-public", { cache: "no-store" })
    if (!res.ok) return null
    const json = await res.json()
    return typeof json.publicKey === "string" && json.publicKey.length > 0 ? json.publicKey : null
  } catch {
    return null
  }
}

/**
 * Request permission, register the SW, and create a push subscription.
 * Returns a JSON-stringified PushSubscription suitable for storing in
 * push_tokens.token and replaying server-side via web-push.
 */
export async function subscribeToPush(): Promise<{
  subscription: string | null
  reason?: string
}> {
  if (!isPushSupported()) return { subscription: null, reason: "unsupported" }

  if (Notification.permission === "denied") {
    return { subscription: null, reason: "denied" }
  }

  if (Notification.permission !== "granted") {
    const perm = await Notification.requestPermission()
    if (perm !== "granted") return { subscription: null, reason: perm }
  }

  const reg = await ensureServiceWorker()
  if (!reg) return { subscription: null, reason: "sw-register-failed" }

  const publicKey = await getVapidPublicKey()
  if (!publicKey) return { subscription: null, reason: "no-vapid-public-key" }

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
    } catch (err) {
      console.error("[push] pushManager.subscribe failed:", err)
      return { subscription: null, reason: `subscribe-failed: ${(err as Error).message}` }
    }
  }

  return { subscription: JSON.stringify(sub) }
}

/** Read the current push subscription, if any. */
export async function getCurrentSubscription(): Promise<string | null> {
  if (!isPushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration("/")
  if (!reg) return null
  const sub = await reg.pushManager.getSubscription()
  return sub ? JSON.stringify(sub) : null
}

/** Drop the local push subscription (does NOT remove the row from DB). */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false
  const reg = await navigator.serviceWorker.getRegistration("/")
  if (!reg) return false
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return true
  return await sub.unsubscribe()
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i)
  return out
}
