"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

interface PwaContextValue {
  isInstallable: boolean
  isInstalled: boolean
  isOnline: boolean
  promptInstall: () => Promise<void>
  pushSupported: boolean
  pushSubscribed: boolean
  subscribeToPush: () => Promise<void>
  unsubscribeFromPush: () => Promise<void>
}

const PwaContext = createContext<PwaContextValue>({
  isInstallable: false,
  isInstalled: false,
  isOnline: true,
  promptInstall: async () => {},
  pushSupported: false,
  pushSubscribed: false,
  subscribeToPush: async () => {},
  unsubscribeFromPush: async () => {},
})

export function usePwa() {
  return useContext(PwaContext)
}

/** Convert a URL-safe base64 VAPID public key to Uint8Array for PushManager. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/** Stable device identifier stored in localStorage. */
function getDeviceId(): string {
  const key = "shoppie_device_id"
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushSubscribed, setPushSubscribed] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    // Online / offline
    setIsOnline(navigator.onLine)
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)

    // Detect if already installed (standalone mode)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
    }

    // Install prompt
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setIsInstallable(true)
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall)

    // After install
    const onAppInstalled = () => {
      setIsInstalled(true)
      setIsInstallable(false)
      setDeferredPrompt(null)
    }
    window.addEventListener("appinstalled", onAppInstalled)

    // Register service worker only in production-like environments
    if ("serviceWorker" in navigator) {
      fetch("/sw.js", { method: "HEAD" })
        .then((res) => {
          const ct = res.headers.get("content-type") ?? ""
          if (!res.ok || !ct.includes("javascript")) return
          return navigator.serviceWorker
            .register("/sw.js", { scope: "/" })
            .then((reg) => {
              // Check if already subscribed
              return reg.pushManager.getSubscription().then((sub) => {
                if (sub) setPushSubscribed(true)
              })
            })
        })
        .catch(() => {})
    }

    // Push notification support — requires VAPID public key + service worker
    if ("PushManager" in window && "Notification" in window) {
      setPushSupported(!!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
    }

    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
      window.removeEventListener("beforeinstallprompt", onBeforeInstall)
      window.removeEventListener("appinstalled", onAppInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setIsInstalled(true)
      setIsInstallable(false)
    }
    setDeferredPrompt(null)
  }, [deferredPrompt])

  /**
   * Subscribe this device to VAPID Web Push and persist the subscription to
   * the server via POST /api/push/subscribe.
   */
  const subscribeToPush = useCallback(async () => {
    if (!pushSupported) return

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidPublicKey) {
      console.warn("[PWA] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set — push unavailable.")
      return
    }

    const permission = await Notification.requestPermission()
    if (permission !== "granted") return

    try {
      const registration = await navigator.serviceWorker.ready
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })

      const deviceId = getDeviceId()

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription, deviceId, userType: "buyer" }),
      })

      setPushSubscribed(true)
    } catch (err) {
      console.error("[PWA] Push subscription failed:", err)
    }
  }, [pushSupported])

  /**
   * Unsubscribe from push on this device and disable the token server-side.
   */
  const unsubscribeFromPush = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
      }

      const deviceId = getDeviceId()
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      })

      setPushSubscribed(false)
    } catch (err) {
      console.error("[PWA] Push unsubscription failed:", err)
    }
  }, [])

  return (
    <PwaContext.Provider
      value={{
        isInstallable,
        isInstalled,
        isOnline,
        promptInstall,
        pushSupported,
        pushSubscribed,
        subscribeToPush,
        unsubscribeFromPush,
      }}
    >
      {children}
    </PwaContext.Provider>
  )
}
