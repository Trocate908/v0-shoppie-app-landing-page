"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { subscribeToPush, isPushSupported, getCurrentSubscription } from "@/lib/push/client"
import { getDeviceId } from "@/lib/device-id"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

type Status = "idle" | "asking" | "granted" | "denied" | "unsupported"

// v2 keys — bumping the version forces all users who previously dismissed
// the soft prompt (when VAPID keys were missing and push silently failed) to
// see the prompt again and re-subscribe with the now-working configuration.
const SOFT_PROMPT_KEY = "shoppie:notif-soft-prompt-v2"
const REGISTER_TS_KEY = "shoppie:notif-registered-at-v2"

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
      // Re-register at most once per 12h to refresh the subscription.
      const lastRaw = (() => {
        try { return localStorage.getItem(REGISTER_TS_KEY) } catch { return null }
      })()
      const last = lastRaw ? Number(lastRaw) : 0
      const stale = !last || Date.now() - last > 12 * 60 * 60 * 1000
      if (stale && !registeredRef.current) {
        registeredRef.current = true
        registerToken(true)
      } else {
        getCurrentSubscription().then((s) => s && setToken(s))
        setStatus("granted")
      }
    } else if (perm === "denied") {
      setStatus("denied")
    }
  }, [registerToken])

  // Re-register whenever the Supabase auth user changes.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!isPushSupported()) return
    const supabase = createBrowserClient()
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return
      if (Notification.permission !== "granted") return
      try { localStorage.removeItem(REGISTER_TS_KEY) } catch {}
      registerToken(true)
    })
    return () => { sub.subscription.unsubscribe() }
  }, [registerToken])

  // Listen for SW push messages (in-app real-time update when tab is open).
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    const onMessage = (e: MessageEvent) => {
      const data = e.data
      // New push notification arrived
      if (data?.type === "shoppie-push") {
        const payload = data.payload ?? {}
        const title = payload.title ?? "ShoppieApp"
        const body  = payload.body  ?? "You have a new update"
        const focused = document.visibilityState === "visible" && document.hasFocus()
        if (focused) {
          playNotificationSound()
          toast({ title, description: body })
        }
      }
      // Browser rotated the push subscription — re-register silently
      if (data?.type === "shoppie-subscription-changed") {
        try { localStorage.removeItem(REGISTER_TS_KEY) } catch {}
        registerToken(true)
      }
    }

    navigator.serviceWorker.addEventListener("message", onMessage)
    return () => navigator.serviceWorker.removeEventListener("message", onMessage)
  }, [toast, registerToken])

  const enable = useCallback(async () => {
    setStatus("asking")
    const t = await registerToken(false)
    return !!t
  }, [registerToken])

  const dismissSoftPrompt = useCallback(() => {
    try { localStorage.setItem(SOFT_PROMPT_KEY, String(Date.now())) } catch {}
  }, [])

  const shouldShowSoftPrompt = useCallback(() => {
    if (typeof window === "undefined") return false
    if (!("Notification" in window)) return false
    if (Notification.permission !== "default") return false
    try {
      const last = Number(localStorage.getItem(SOFT_PROMPT_KEY) ?? 0)
      // Re-show after 3 days (down from 7 — ensures users see it sooner)
      return !last || Date.now() - last > 3 * 24 * 60 * 60 * 1000
    } catch {
      return true
    }
  }, [])

  return { status, token, enable, dismissSoftPrompt, shouldShowSoftPrompt }
}
