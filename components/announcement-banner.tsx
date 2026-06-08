"use client"

import { useEffect, useState } from "react"
import { X, Megaphone } from "lucide-react"

interface Announcement {
  id: string
  title: string
  message: string
  target_audience: string
  created_at: string
}

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    const stored = localStorage.getItem("dismissed_announcements")
    const dismissedIds: string[] = stored ? JSON.parse(stored) : []
    const dismissedSet = new Set(dismissedIds)
    setDismissed(dismissedSet)

    fetch("/api/announcements")
      .then(r => r.json())
      .then(d => {
        const fresh = (d.announcements ?? []).filter((a: Announcement) => !dismissedSet.has(a.id))
        setAnnouncements(fresh)
      })
      .catch(() => {})
  }, [])

  function dismiss(id: string) {
    setAnnouncements(prev => prev.filter(a => a.id !== id))
    setDismissed(prev => {
      const next = new Set(prev)
      next.add(id)
      localStorage.setItem("dismissed_announcements", JSON.stringify([...next]))
      return next
    })
  }

  if (announcements.length === 0) return null

  return (
    <div className="w-full z-40 space-y-0.5">
      {announcements.map(a => (
        <div key={a.id} className="w-full bg-violet-600 text-white px-4 py-2.5 flex items-center gap-3">
          <Megaphone className="h-4 w-4 shrink-0 opacity-80" />
          <div className="flex-1 min-w-0 text-sm">
            <span className="font-semibold mr-2">{a.title}:</span>
            <span className="opacity-90">{a.message}</span>
          </div>
          <button
            onClick={() => dismiss(a.id)}
            className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors"
            aria-label="Dismiss announcement"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
