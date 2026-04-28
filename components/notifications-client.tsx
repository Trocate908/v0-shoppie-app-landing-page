"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ArrowLeft, Bell, BellOff, CheckCheck, Flame, MessageCircle, Package, Sparkles, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFcm } from "@/hooks/use-fcm"
import { getDeviceId } from "@/lib/device-id"
import { cn } from "@/lib/utils"

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

const typeIcon: Record<string, { icon: React.ComponentType<{ className?: string }>; tint: string }> = {
  message:        { icon: MessageCircle, tint: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  trending:       { icon: Flame,         tint: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  product_loved:  { icon: Sparkles,      tint: "bg-pink-500/10 text-pink-600 dark:text-pink-400" },
  start_posting:  { icon: Store,         tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  new_product:    { icon: Package,       tint: "bg-primary/10 text-primary" },
  custom:         { icon: Bell,          tint: "bg-muted text-foreground" },
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60_000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function NotificationsClient() {
  const router = useRouter()
  const { status, enable } = useFcm()
  const [items, setItems] = useState<Notification[] | null>(null)
  const [enabling, setEnabling] = useState(false)

  const load = useCallback(async () => {
    const deviceId = getDeviceId()
    const url = deviceId
      ? `/api/notifications/list?deviceId=${encodeURIComponent(deviceId)}`
      : "/api/notifications/list"
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) {
      setItems([])
      return
    }
    const json = (await res.json()) as { notifications: Notification[] }
    setItems(json.notifications ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const markAllRead = async () => {
    await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true, deviceId: getDeviceId() }),
    })
    load()
  }

  const onItemClick = async (n: Notification) => {
    if (!n.read) {
      await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id, deviceId: getDeviceId() }),
      })
    }
    if (n.link) router.push(n.link)
    else load()
  }

  const onEnable = async () => {
    setEnabling(true)
    await enable()
    setEnabling(false)
  }

  const hasItems = items && items.length > 0
  const unread = items?.filter((n) => !n.read).length ?? 0

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              aria-label="Back"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg font-semibold text-foreground">Notifications</h1>
          </div>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <Button size="sm" variant="ghost" onClick={markAllRead} className="gap-2">
                <CheckCheck className="h-4 w-4" />
                Mark all read
              </Button>
            )}
            <Link
              href="/notifications/debug"
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline px-2"
            >
              Debug
            </Link>
          </div>
        </div>
      </header>

      {/* Permission banner */}
      {status !== "granted" && status !== "unsupported" && (
        <div className="mx-4 mt-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {status === "denied" ? "Notifications are blocked" : "Get notified about what matters"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {status === "denied"
                  ? "Re-enable notifications in your browser settings to hear about new messages and trending products."
                  : "Turn on push notifications for new messages, trending products and shop updates."}
              </p>
              {status !== "denied" && (
                <Button size="sm" className="mt-3" onClick={onEnable} disabled={enabling}>
                  {enabling ? "Enabling..." : "Turn on notifications"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <main className="flex-1 px-4 pt-4">
        {items === null ? (
          <ul className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <li
                key={i}
                className="h-20 animate-pulse rounded-2xl border border-border bg-muted/40"
              />
            ))}
          </ul>
        ) : !hasItems ? (
          <div className="mt-12 flex flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <BellOff className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">No notifications yet</p>
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
              We&apos;ll let you know when there&apos;s something new — trending products,
              messages from shoppers, or activity on your shop.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => {
              const meta = typeIcon[n.type] ?? typeIcon.custom
              const Icon = meta.icon
              return (
                <li key={n.id}>
                  <button
                    onClick={() => onItemClick(n)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors",
                      n.read
                        ? "border-border bg-card hover:bg-muted/50"
                        : "border-primary/30 bg-primary/5 hover:bg-primary/10",
                    )}
                  >
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", meta.tint)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{n.title}</p>
                        {!n.read && <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{n.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground/80">{formatRelative(n.created_at)}</p>
                    </div>
                    {n.image_url && (
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border">
                        <Image src={n.image_url} alt="" fill sizes="56px" className="object-cover" />
                      </div>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
