"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Lock } from "lucide-react"
import NotificationDebugClient from "@/components/notification-debug-client"
import { isDevModeEnabled, subscribeToDevMode } from "@/lib/dev-mode"

export default function NotificationDebugGate() {
  const [ready, setReady] = useState(false)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setEnabled(isDevModeEnabled())
    setReady(true)
    return subscribeToDevMode(setEnabled)
  }, [])

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!enabled) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex items-center gap-2 px-4 py-3">
            <Link
              href="/"
              aria-label="Back"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg font-semibold text-foreground">Diagnostics</h1>
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-semibold text-foreground">Developer options are off</p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
            Enable Developer Options in Settings to access notification diagnostics.
          </p>
          <Link
            href="/?tab=settings"
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            Open Settings
          </Link>
        </main>
      </div>
    )
  }

  return <NotificationDebugClient />
}
