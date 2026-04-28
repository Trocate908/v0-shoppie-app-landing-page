"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { onForegroundMessage, requestFcmToken } from "@/lib/firebase/client"
import { getDeviceId } from "@/lib/device-id"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

type Status = "idle" | "asking" | "granted" | "denied" | "unsupported"

const SOFT_PROMPT_KEY = "shoppie:notif-soft-prompt"
const REGISTER_TS_KEY = "shoppie:notif-registered-at"

/**
 * Synthesise a short, pleasant two-tone "ding" using the Web Audio API.
 * No binary asset required and it works without any user gesture as long
 * as the page has been interacted with at least once (which is true for
 * any user that has just been chatting / sending messages).
 */
function playNotificationSound() {
  if (typeof window === "undefined") return
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + duration + 0.05)
    }
    // Two-tone "ding" — high then higher.
    playTone(880, 0, 0.18)
    playTone(1320, 0.14, 0.22)
    // Auto-close the context shortly after.
    setTimeout(() => ctx.close().catch(() => {}), 600)
  } catch {
    /* ignored — sound is best-effort */
  }
}

/**
 * useFcm wires the browser's FCM lifecycle:
 *  - reports current permission state
 *  - exposes an `enable()` action to request permission + register the token
 *  - automatically (re)registers the token on app load if permission is already granted
 *  - shows a toast when foreground messages arrive
 */
export function useFcm() {
  const [status, setStatus] = useState<Status>("idle")
  const [token, setToken] = useState<string | null>(null)
  const registeredRef = useRef(false)
  const { toast } = useToast()

  const registerToken = useCallback(async (silent = false) => {
    const t = await requestFcmToken()
    if (!t) {
      if (!silent) setStatus(typeof Notification !== "undefined" && Notification.permission === "denied" ? "denied" : "idle")
      return null
    }

    const supabase = createBrowserClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    let userType: "vendor" | "shopper" | "anonymous" = "anonymous"
    if (user) {
      const { data: vendor } = await supabase
        .from("vendors")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()
      userType = vendor ? "vendor" : "shopper"
    }

    try {
      await fetch("/api/notifications/register-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: t,
          deviceId: getDeviceId(),
          userType,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        }),
      })
      try {
        localStorage.setItem(REGISTER_TS_KEY, String(Date.now()))
      } catch {}
      setToken(t)
      setStatus("granted")
    } catch (err) {
      console.error("[FCM] failed to persist token:", err)
    }

    return t
  }, [])

  // Detect support + auto-register if permission is already granted.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("unsupported")
      return
    }
    const perm = Notification.permission
    if (perm === "granted") {
      // Re-register at most once per 24h to refresh the token.
      const lastRaw = (() => {
        try { return localStorage.getItem(REGISTER_TS_KEY) } catch { return null }
      })()
      const last = lastRaw ? Number(lastRaw) : 0
      const stale = !last || Date.now() - last > 24 * 60 * 60 * 1000
      if (stale && !registeredRef.current) {
        registeredRef.current = true
        registerToken(true)
      } else {
        setStatus("granted")
      }
    } else if (perm === "denied") {
      setStatus("denied")
    }
  }, [registerToken])

  // Re-register whenever the Supabase auth user changes — this guarantees
  // the FCM token is associated with the currently signed-in user, so
  // notifications go to the right account when they swap shopper/vendor
  // identities or sign out and back in.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("Notification" in window)) return
    const supabase = createBrowserClient()
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return
      if (Notification.permission !== "granted") return
      // Force a fresh registration so push_tokens.user_id reflects reality.
      try {
        localStorage.removeItem(REGISTER_TS_KEY)
      } catch {}
      registerToken(true)
    })
    return () => {
      sub.subscription.unsubscribe()
    }
  }, [registerToken])

  // Listen for foreground messages so the user gets feedback while the app is open.
  useEffect(() => {
    let unsub: (() => void) | undefined
    onForegroundMessage(async (payload) => {
      const title = payload.title ?? "ShoppieApp"
      const body = payload.body ?? "You have a new update"
      const link = payload.link ?? "/"
      const image = payload.image

      // Always play a short beep so the user notices, just like Facebook.
      playNotificationSound()

      // If the tab is not the active/visible tab, show a real system
      // notification (Chrome will play the OS notification sound + vibrate).
      const isHidden = typeof document !== "undefined" && document.visibilityState !== "visible"
      if (isHidden && "serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration("/firebase-cloud-messaging-push-scope")
          if (reg) {
            await reg.showNotification(title, {
              body,
              icon: "/logo.png",
              badge: "/logo.png",
              image,
              tag: `shoppie-fg-${Date.now()}`,
              requireInteraction: true,
              renotify: true,
              vibrate: [200, 100, 200, 100, 200],
              data: { link },
            } as NotificationOptions)
            return
          }
        } catch (err) {
          console.error("[FCM] foreground showNotification failed", err)
        }
      }

      // Tab is focused — show an in-app toast.
      toast({ title, description: body })
    }).then((fn) => {
      unsub = fn
    })
    return () => {
      if (unsub) unsub()
    }
  }, [toast])

  const enable = useCallback(async () => {
    setStatus("asking")
    const t = await registerToken(false)
    if (!t) return false
    return true
  }, [registerToken])

  const dismissSoftPrompt = useCallback(() => {
    try {
      localStorage.setItem(SOFT_PROMPT_KEY, String(Date.now()))
    } catch {}
  }, [])

  const shouldShowSoftPrompt = useCallback(() => {
    if (typeof window === "undefined") return false
    if (!("Notification" in window)) return false
    if (Notification.permission !== "default") return false
    try {
      const last = Number(localStorage.getItem(SOFT_PROMPT_KEY) ?? 0)
      // Re-show after 7 days
      return !last || Date.now() - last > 7 * 24 * 60 * 60 * 1000
    } catch {
      return true
    }
  }, [])

  return { status, token, enable, dismissSoftPrompt, shouldShowSoftPrompt }
}
