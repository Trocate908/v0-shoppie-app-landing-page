"use client"

import { useEffect, useState } from "react"
import { Bell, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useOneSignal } from "@/hooks/use-onesignal"

/**
 * A dismissable banner that asks for notification permission.
 * Shows 2s after mount. Re-shows every 3 days until granted or permanently denied.
 */
export function NotificationPrompt() {
  const { status, enable, dismissSoftPrompt, shouldShowSoftPrompt } = useOneSignal()
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (status === "granted" || status === "denied" || status === "unsupported" || status === "not_configured") return
    if (!shouldShowSoftPrompt()) return
    const t = setTimeout(() => setVisible(true), 2000)
    return () => clearTimeout(t)
  }, [status, shouldShowSoftPrompt])

  if (!visible) return null
  if (status === "granted" || status === "denied" || status === "unsupported" || status === "not_configured") return null

  const onEnable = async () => {
    setBusy(true)
    const ok = await enable()
    setBusy(false)
    setVisible(false)
    if (ok) dismissSoftPrompt()
  }

  const onLater = () => {
    dismissSoftPrompt()
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-label="Enable notifications"
      className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-xl animate-in slide-in-from-bottom-4 duration-300"
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
            Get notified instantly when someone messages you — even when the app is closed.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" onClick={onEnable} disabled={busy}>
              {busy ? "Enabling…" : "Allow notifications"}
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
