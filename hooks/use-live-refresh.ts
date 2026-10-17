"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** How often order screens re-read their server data while the tab is visible. */
export const LIVE_REFRESH_MS = 30_000

/**
 * Keeps a server-rendered screen current without a full reload.
 *
 * Order statuses only change on the server — a shop confirms, readies or
 * completes an order — so the shopper used to have to reload to notice. This
 * re-runs the current server component on an interval, and immediately when
 * the tab becomes visible again. Background tabs stop polling because
 * `document.visibilityState` is checked before each refresh.
 */
export function useLiveRefresh(intervalMs: number = LIVE_REFRESH_MS) {
  const router = useRouter()

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh()
    }
    const timer = window.setInterval(refresh, intervalMs)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [intervalMs, router])
}
