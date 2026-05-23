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
  subscribeToPush: () => Promise<void>
}

const PwaContext = createContext<PwaContextValue>({
  isInstallable: false,
  isInstalled: false,
  isOnline: true,
  promptInstall: async () => {},
  pushSupported: false,
  subscribeToPush: async () => {},
})

export function usePwa() {
  return useContext(PwaContext)
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [pushSupported, setPushSupported] = useState(false)

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

    // NOTE: We deliberately do NOT register /sw.js here any more. The
    // OneSignal SDK registers /OneSignalSDKWorker.js at scope "/" and that
    // worker now contains BOTH the OneSignal push-handler imports AND our
    // PWA caching logic (see public/OneSignalSDKWorker.js). Having two
    // service workers fighting for scope "/" was the cause of intermittent
    // / lost notifications on Android Chrome.

    // Push notification support
    if ("PushManager" in window && "Notification" in window) {
      setPushSupported(true)
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
   * Placeholder for push notification subscription.
   * Wire up a real VAPID backend to complete this.
   */
  const subscribeToPush = useCallback(async () => {
    if (!pushSupported) return
    const permission = await Notification.requestPermission()
    if (permission !== "granted") return

    const registration = await navigator.serviceWorker.ready
    // TODO: Replace with your VAPID public key
    // const subscription = await registration.pushManager.subscribe({
    //   userVisibleOnly: true,
    //   applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    // })
    // await fetch("/api/push/subscribe", { method: "POST", body: JSON.stringify(subscription) })
    console.log("[PWA] Push permission granted. Wire up VAPID key to complete subscription.")
  }, [pushSupported])

  return (
    <PwaContext.Provider value={{ isInstallable, isInstalled, isOnline, promptInstall, pushSupported, subscribeToPush }}>
      {children}
    </PwaContext.Provider>
  )
}
