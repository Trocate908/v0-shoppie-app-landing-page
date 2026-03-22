"use client"

import { useState, useEffect } from "react"
import { Download, X, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePwa } from "@/components/pwa-provider"
import { cn } from "@/lib/utils"

export default function InstallBanner() {
  const { isInstallable, isInstalled, promptInstall } = usePwa()
  const [dismissed, setDismissed] = useState(true) // start hidden to avoid flicker
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    // Check if user previously dismissed
    const wasDismissed = sessionStorage.getItem("shoppie_install_dismissed") === "1"
    if (!wasDismissed && isInstallable && !isInstalled) {
      // Slight delay so the page loads first
      const t = setTimeout(() => setDismissed(false), 3000)
      return () => clearTimeout(t)
    }
  }, [isInstallable, isInstalled])

  const handleInstall = async () => {
    setInstalling(true)
    await promptInstall()
    setInstalling(false)
    setDismissed(true)
  }

  const handleDismiss = () => {
    sessionStorage.setItem("shoppie_install_dismissed", "1")
    setDismissed(true)
  }

  if (dismissed || !isInstallable || isInstalled) return null

  return (
    <div
      className={cn(
        "fixed bottom-20 left-3 right-3 z-50 rounded-2xl border border-primary/20 bg-background shadow-2xl shadow-primary/10",
        "animate-in slide-in-from-bottom-4 duration-300"
      )}
      role="banner"
      aria-label="Install ShoppieApp"
    >
      <div className="flex items-center gap-3 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary">
          <Smartphone className="h-6 w-6 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">Install ShoppieApp</p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
            Add to your home screen for a faster, app-like experience
          </p>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-2 border-t border-border px-4 py-3">
        <Button variant="outline" size="sm" onClick={handleDismiss} className="flex-1">
          Not now
        </Button>
        <Button size="sm" onClick={handleInstall} disabled={installing} className="flex-1 gap-2">
          <Download className="h-4 w-4" />
          {installing ? "Installing..." : "Install"}
        </Button>
      </div>
    </div>
  )
}
