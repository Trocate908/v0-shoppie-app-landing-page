"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

// ── Types ────────────────────────────────────────────────────────────────────

interface OneSignalNotifications {
  permission: boolean
  permissionNative: NotificationPermission
  requestPermission(): Promise<void>
  addEventListener(event: "permissionChange", cb: (granted: boolean) => void): void
  removeEventListener(event: "permissionChange", cb: (granted: boolean) => void): void
}

interface OneSignalSDK {
  init(opts: {
    appId: string
    notifyButton?: { enable: boolean }
    allowLocalhostAsSecureOrigin?: boolean
    serviceWorkerPath?: string
  }): Promise<void>
  login(externalId: string): Promise<void>
  logout(): Promise<void>
  Notifications: OneSignalNotifications
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(sdk: OneSignalSDK) => void>
    OneSignal?: OneSignalSDK
  }
}

// ── Constants ────────────────────────────────────────────────────────────────

const PROMPT_DISMISSED_KEY = "shoppie:os-prompt-dismissed-v1"
const PROMPT_COOLDOWN_MS   = 3 * 24 * 60 * 60 * 1000 // 3 days

export type PushStatus = "idle" | "asking" | "granted" | "denied" | "unsupported" | "not_configured"

// ── Shared Supabase client ───────────────────────────────────────────────────

let _client: ReturnType<typeof createBrowserClient> | null = null
function getClient() {
  if (!_client) _client = createBrowserClient()
  return _client
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useOneSignal() {
  const [status, setStatus] = useState<PushStatus>("idle")
  const sdkRef  = useRef<OneSignalSDK | null>(null)
  const { toast } = useToast()

  // The SDK is already initialised by the inline <script> in <head>.
  // We just need to hook into the deferred queue to grab the SDK reference.

  useEffect(() => {
    if (typeof window === "undefined") return

    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("unsupported")
      return
    }

    // Push into the deferred queue — SDK calls us once init() is complete.
    window.OneSignalDeferred = window.OneSignalDeferred ?? []
    window.OneSignalDeferred.push(async (sdk) => {
      sdkRef.current = sdk

      // Sync initial permission status
      const native = sdk.Notifications.permissionNative
      if (native === "granted") setStatus("granted")
      else if (native === "denied") setStatus("denied")
      else setStatus("idle")

      // Subscribe to future permission changes
      const onChange = (granted: boolean) => {
        setStatus(granted ? "granted" : "denied")
      }
      sdk.Notifications.addEventListener("permissionChange", onChange)
    })
  }, [])

  // ── 2. Link the Supabase user to OneSignal external_id ─────────────────

  useEffect(() => {
    const supabase = getClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const sdk = sdkRef.current
      if (!sdk) return
      if (event === "SIGNED_IN" && session?.user?.id) {
        try { await sdk.login(session.user.id) } catch {}
      }
      if (event === "SIGNED_OUT") {
        try { await sdk.logout() } catch {}
      }
    })
    return () => { subscription.unsubscribe() }
  }, [])

  // ── 3. Expose enable() for our custom prompt ────────────────────────────

  const enable = useCallback(async (): Promise<boolean> => {
    const sdk = sdkRef.current
    if (!sdk) return false

    setStatus("asking")
    try {
      await sdk.Notifications.requestPermission()
      const granted = sdk.Notifications.permission
      setStatus(granted ? "granted" : "denied")

      // Link user after permission granted
      if (granted) {
        const { data: { user } } = await getClient().auth.getUser()
        if (user?.id) {
          try { await sdk.login(user.id) } catch {}
        }
        toast({ title: "Notifications enabled", description: "You'll be notified of new messages instantly." })
      }
      return granted
    } catch (err) {
      console.error("[onesignal] requestPermission error:", err)
      setStatus("idle")
      return false
    }
  }, [toast])

  // ── 4. Soft-prompt helpers ──────────────────────────────────────────────

  const dismissSoftPrompt = useCallback(() => {
    try { localStorage.setItem(PROMPT_DISMISSED_KEY, String(Date.now())) } catch {}
  }, [])

  const shouldShowSoftPrompt = useCallback((): boolean => {
    if (typeof window === "undefined") return false
    if (!("Notification" in window)) return false
    if (Notification.permission !== "default") return false
    if (!appId) return false
    try {
      const last = Number(localStorage.getItem(PROMPT_DISMISSED_KEY) ?? 0)
      return !last || Date.now() - last > PROMPT_COOLDOWN_MS
    } catch {
      return true
    }
  }, [appId])

  return { status, enable, dismissSoftPrompt, shouldShowSoftPrompt }
}
