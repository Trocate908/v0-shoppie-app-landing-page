"use client"

import { useEffect, useRef, useCallback } from "react"

export type NotificationPayload = {
  title: string
  body: string
  icon?: string
  tag?: string
  onClick?: () => void
}

/**
 * Requests notification permission on mount and exposes a `notify` helper.
 * Browser notifications are only shown when the document is hidden (user is
 * in a different tab or app).
 */
export function useNotifications() {
  const permissionRef = useRef<NotificationPermission>("default")
  const callbacksRef = useRef<Map<string, (() => void) | undefined>>(new Map())

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return
    permissionRef.current = Notification.permission
    if (Notification.permission === "default") {
      Notification.requestPermission().then((p) => {
        permissionRef.current = p
      })
    }
  }, [])

  const notify = useCallback(({ title, body, icon, tag, onClick }: NotificationPayload) => {
    if (typeof window === "undefined") return

    // ── AppInventor / Kodular WebView bridge ────────────────────────────────
    // When the app is running inside a native WebView wrapper (Kodular, MIT
    // AppInventor, etc.) we forward the notification to the host via
    // `setWebViewString`. The native side listens for changes on this string
    // and uses it to build a proper OS-level push notification.
    //
    // Format: "title|body" so the Android side can split on "|" and render:
    //   - Title line:  "New message from John"
    //   - Body line:   "Hello there!"
    try {
      const bridge = (
        window as unknown as {
          AppInventor?: { setWebViewString?: (value: string) => void }
        }
      ).AppInventor
      if (bridge?.setWebViewString) {
        bridge.setWebViewString(`${title}|${body}`)
      }
    } catch {
      // Ignore — WebView bridge is optional.
    }

    // Browser Notification API (desktop / mobile PWA)
    if (!("Notification" in window)) return
    if (permissionRef.current !== "granted") return
    // Only show when tab is hidden
    if (!document.hidden) return

    const n = new Notification(title, {
      body,
      icon: icon ?? "/logo.png",
      tag,
      badge: "/logo.png",
    })

    if (onClick) {
      if (tag) callbacksRef.current.set(tag, onClick)
      n.onclick = () => {
        window.focus()
        onClick()
        n.close()
      }
    }
  }, [])

  return { notify }
}
