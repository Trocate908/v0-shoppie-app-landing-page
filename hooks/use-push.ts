"use client"

import { useCallback, useEffect, useState } from "react"
import { subscribeToPush, isPushSupported } from "@/lib/push/client"
import { getDeviceId } from "@/lib/device-id"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

const PROMPT_DISMISSED_KEY = "shoppie:push-prompt-dismissed-v2"
const PROMPT_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000

export type PushStatus = "idle" | "asking" | "granted" | "denied" | "unsupported"

let _client: ReturnType<typeof createBrowserClient> | null = null
function getClient() {
  if (!_client) _client = createBrowserClient()
  return _client
}

async function registerToken(token: string, userId?: string | null) {
  const deviceId = getDeviceId()
  try {
    await fetch("/api/notifications/register-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        deviceId,
        userType: userId ? "shopper" : "anonymous",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      }),
    })
  } catch {
    // best-effort
  }
}

export function usePush() {
  const [status, setStatus] = useState<PushStatus>("idle")
  const { toast } = useToast()

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!isPushSupported()) {
      setStatus("unsupported")
      return
    }
    const perm = Notification.permission
    if (perm === "granted") setStatus("granted")
    else if (perm === "denied") setStatus("denied")
    else setStatus("idle")

    // Auto-register when already granted (e.g. on page reload)
    if (perm === "granted") {
      subscribeToPush().then(async ({ subscription }) => {
        if (!subscription) return
        const {
          data: { user },
        } = await getClient().auth.getUser()
        await registerToken(subscription, user?.id)
      })
    }
  }, [])

  // Keep token synced to auth state changes (login / token refresh)
  useEffect(() => {
    const supabase = getClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (
        (event === "SIGNED_IN" ||
          event === "INITIAL_SESSION" ||
          event === "TOKEN_REFRESHED") &&
        session?.user?.id
      ) {
        if (Notification.permission !== "granted") return
        const { subscription: pushSub } = await subscribeToPush()
        if (pushSub) await registerToken(pushSub, session.user.id)
      }
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const enable = useCallback(async (): Promise<boolean> => {
    setStatus("asking")
    const { subscription, reason } = await subscribeToPush()
    if (!subscription) {
      const denied = reason === "denied" || Notification.permission === "denied"
      setStatus(denied ? "denied" : "idle")
      return false
    }
    setStatus("granted")
    const {
      data: { user },
    } = await getClient().auth.getUser()
    await registerToken(subscription, user?.id)
    toast({
      title: "Notifications enabled",
      description: "You'll get notified of new messages instantly.",
    })
    return true
  }, [toast])

  const dismissSoftPrompt = useCallback(() => {
    try {
      localStorage.setItem(PROMPT_DISMISSED_KEY, String(Date.now()))
    } catch {}
  }, [])

  const shouldShowSoftPrompt = useCallback((): boolean => {
    if (typeof window === "undefined") return false
    if (!isPushSupported()) return false
    if (Notification.permission !== "default") return false
    try {
      const last = Number(localStorage.getItem(PROMPT_DISMISSED_KEY) ?? 0)
      return !last || Date.now() - last > PROMPT_COOLDOWN_MS
    } catch {
      return true
    }
  }, [])

  return { status, enable, dismissSoftPrompt, shouldShowSoftPrompt }
}
