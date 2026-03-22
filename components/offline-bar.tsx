"use client"

import { WifiOff, Wifi } from "lucide-react"
import { usePwa } from "@/components/pwa-provider"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

export default function OfflineBar() {
  const { isOnline } = usePwa()
  const [visible, setVisible] = useState(false)
  const [showOnline, setShowOnline] = useState(false)

  useEffect(() => {
    if (!isOnline) {
      setShowOnline(false)
      setVisible(true)
    } else if (visible) {
      // Was offline, now back — briefly show "back online" then hide
      setShowOnline(true)
      const t = setTimeout(() => {
        setVisible(false)
        setShowOnline(false)
      }, 3000)
      return () => clearTimeout(t)
    }
  }, [isOnline]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-300",
        showOnline
          ? "bg-green-600 text-white"
          : "bg-foreground text-background"
      )}
      role="status"
      aria-live="polite"
    >
      {showOnline ? (
        <>
          <Wifi className="h-4 w-4" />
          <span>Back online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          <span>You are offline — some content may not be available</span>
        </>
      )}
    </div>
  )
}
