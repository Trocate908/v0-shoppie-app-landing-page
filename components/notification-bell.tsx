"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"
import { cn } from "@/lib/utils"
import { getDeviceId } from "@/lib/device-id"

type Notification = {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  image_url: string | null
  read: boolean
  created_at: string
}

interface NotificationBellProps {
  className?: string
  compact?: boolean
}

/**
 * Header button linking to /notifications with an unread badge.
 * Polls every 60s as a baseline, and updates immediately when a
 * real-time push or socket event fires (via "shoppie:notification").
 */
export function NotificationBell({ className, compact = false }: NotificationBellProps) {
  const [unread, setUnread] = useState(0)

  const fetchUnread = useCallback(async () => {
    try {
      const deviceId = getDeviceId()
      const url = deviceId
        ? `/api/notifications/list?deviceId=${encodeURIComponent(deviceId)}`
        : "/api/notifications/list"
      const res = await fetch(url, { cache: "no-store" })
      if (!res.ok) return
      const json = (await res.json()) as { notifications: Notification[]; unread: number }
      setUnread(json.unread ?? 0)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchUnread()

    // Baseline poll every 60s
    const pollId = setInterval(fetchUnread, 60_000)

    // Instant update on tab focus
    const onFocus = () => fetchUnread()
    window.addEventListener("focus", onFocus)

    // Real-time: triggered by Socket.io events + service worker push messages
    const onPush = () => fetchUnread()
    window.addEventListener("shoppie:notification", onPush)

    return () => {
      clearInterval(pollId)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("shoppie:notification", onPush)
    }
  }, [fetchUnread])

  return (
    <Link
      href="/notifications"
      aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground hover:bg-muted transition-colors",
        className,
      )}
    >
      <Bell className="h-4 w-4" />
      {unread > 0 && (
        <span
          aria-hidden
          className={cn(
            "absolute -right-0.5 -top-0.5 flex items-center justify-center rounded-full bg-primary text-primary-foreground",
            compact ? "h-2.5 w-2.5" : "h-4 min-w-4 px-1 text-[10px] font-bold",
          )}
        >
          {compact ? null : unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  )
}
