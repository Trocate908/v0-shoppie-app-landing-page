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
    if (typeof window === "undefined" || !("Notification" in window)) return
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
