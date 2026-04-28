"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { subscribeToPush, isPushSupported, getCurrentSubscription } from "@/lib/push/client"
import { getDeviceId } from "@/lib/device-id"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

type Status = "idle" | "asking" | "granted" | "denied" | "unsupported"

const SOFT_PROMPT_KEY = "shoppie:notif-soft-prompt"
const REGISTER_TS_KEY = "shoppie:notif-registered-at"

/**
 * usePush wires the browser's native Web Push lifecycle:
 *  - reports current permission state
 *  - exposes an `enable()` action to request permission + subscribe + persist
 *  - automatically (re)registers the subscription on app load if permission is already granted
 *  - listens for SW messages so the app can react when a push arrives while open
 *
 * Note: hook name is preserved (`useFcm`) for backwards compatibility with
 * existing imports. The implementation, however, is 100% native Web Push —
 * no Firebase Cloud Messaging or Firebase Web SDK involved anymore.
 */
function playNotificationSound() {
  if (typeof window === "undefined") return
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
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
    playTone(880, 0, 0.18)
    playTone(1320, 0.14, 0.22)
    setTimeout(() => ctx.close().catch(() => {}), 600)
  } catch {
    /* best-effort */
  }
}

export function useFcm() {
  const [status, setStatus] = useState<Status>("idle")
  const [token, setToken] = useState<string | null>(null)
  const registeredRef = useRef(false)
  const { toast } = useToast()

  const persist = useCallback(async (subscriptionJson: string) => {
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
          token: subscriptionJson,
          deviceId: getDeviceId(),
          userType,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        }),
      })
      try {
        localStorage.setItem(REGISTER_TS_KEY, String(Date.now()))
      } catch {}
    } catch (err) {
      console.error("[push] failed to persist subscription:", err)
    }
  }, [])

  const registerToken = useCallback(
    async (silent = false) => {
      const result = await subscribeToPush()
      if (!result.subscription) {
        if (!silent) {
          if (result.reason === "denied") setStatus("denied")
          else if (result.reason === "unsupported") setStatus("unsupported")
          else setStatus("idle")
        }
        if (result.reason && !silent) {
          console.warn("[push] could not subscribe:", result.reason)
        }
        return null
      }
      await persist(result.subscription)
      setToken(result.subscription)
      setStatus("granted")
      return result.subscription
    },
    [persist],
  )

  // Detect support + auto-register if permission is already granted.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!isPushSupported()) {
      setStatus("unsupported")
      return
    }
    const perm = Notification.permission
    if (perm === "granted") {
      // Re-register at most once per 24h to refresh the subscription.
      const lastRaw = (() => {
        try {
          return localStorage.getItem(REGISTER_TS_KEY)
        } catch {
          return null
        }
      })()
      const last = lastRaw ? Number(lastRaw) : 0
      const stale = !last || Date.now() - last > 24 * 60 * 60 * 1000
      if (stale && !registeredRef.current) {
        registeredRef.current = true
        registerToken(true)
      } else {
        // Surface the existing subscription if any.
        getCurrentSubscription().then((s) => s && setToken(s))
        setStatus("granted")
      }
    } else if (perm === "denied") {
      setStatus("denied")
    }
  }, [registerToken])

  // Re-register whenever the Supabase auth user changes — guarantees the
  // subscription is associated with the currently-signed-in user.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!isPushSupported()) return
    const supabase = createBrowserClient()
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return
      if (Notification.permission !== "granted") return
      try {
        localStorage.removeItem(REGISTER_TS_KEY)
      } catch {}
      registerToken(true)
    })
    return () => {
      sub.subscription.unsubscribe()
    }
  }, [registerToken])

  // Listen for SW push messages so we can show a soft toast when the tab
  // is open & focused (the SW always shows the system notification too).
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return
    const onMessage = (e: MessageEvent) => {
      const data = e.data
      if (!data || data.type !== "shoppie-push") return
      const payload = data.payload ?? {}
      const title = payload.title ?? "ShoppieApp"
      const body = payload.body ?? "You have a new update"
      const focused = document.visibilityState === "visible" && document.hasFocus()
      if (focused) {
        playNotificationSound()
        toast({ title, description: body })
      }
    }
    navigator.serviceWorker.addEventListener("message", onMessage)
    return () => navigator.serviceWorker.removeEventListener("message", onMessage)
  }, [toast])

  const enable = useCallback(async () => {
    setStatus("asking")
    const t = await registerToken(false)
    return !!t
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
