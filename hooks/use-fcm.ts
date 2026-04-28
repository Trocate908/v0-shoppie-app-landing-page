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

  // Listen for foreground messages so the user gets feedback while the app is open.
  useEffect(() => {
    let unsub: (() => void) | undefined
    onForegroundMessage((payload) => {
      const title = payload.title ?? "ShoppieApp"
      const body = payload.body ?? "You have a new update"
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
