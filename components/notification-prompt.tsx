"use client"

import { useEffect, useState } from "react"
import { Bell, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFcm } from "@/hooks/use-fcm"

/**
 * A soft, dismissable banner that asks for notification permission.
 * Shows once the user has been around for a few seconds, and stays hidden
 * for 7 days after dismiss / grant / deny.
 */
export function NotificationPrompt() {
  const { status, enable, dismissSoftPrompt, shouldShowSoftPrompt } = useFcm()
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (status === "granted" || status === "denied" || status === "unsupported") return
    if (!shouldShowSoftPrompt()) return
    const t = setTimeout(() => setVisible(true), 4000)
    return () => clearTimeout(t)
  }, [status, shouldShowSoftPrompt])

  if (!visible) return null
  if (status === "granted" || status === "denied" || status === "unsupported") return null

  const onEnable = async () => {
    setBusy(true)
    await enable()
    setBusy(false)
    setVisible(false)
    dismissSoftPrompt()
  }

  const onLater = () => {
    dismissSoftPrompt()
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-label="Enable notifications"
      className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-lg"
    >
      <button
        onClick={onLater}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Stay in the loop</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Get notified about trending products, new messages, and when shoppers love your items.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" onClick={onEnable} disabled={busy}>
              {busy ? "Enabling..." : "Turn on notifications"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onLater}>
              Not now
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
