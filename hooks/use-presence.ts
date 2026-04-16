"use client"

import { useCallback, useEffect, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"

/**
 * Global presence tracking powered by Supabase Realtime.
 *
 * - Each signed-in user joins a shared presence channel keyed by their auth user-id.
 * - Any component can call `usePresence(currentUserId)` to get `isOnline(id)` and
 *   `getLastSeen(id)` helpers that re-render when presence changes.
 * - Last-seen timestamps are persisted to localStorage so they survive reloads.
 */

// ─── Module-level singleton state ─────────────────────────────────────────────

const LAST_SEEN_KEY = "shoppie_presence_last_seen_v1"

let sharedClient: ReturnType<typeof createBrowserClient> | null = null
function getClient() {
  if (!sharedClient) sharedClient = createBrowserClient()
  return sharedClient
}

let onlineSet: Set<string> = new Set()
let lastSeenMap: Map<string, number> = new Map()
const listeners = new Set<() => void>()

let initializedForUser: string | null = null
let persistTimer: ReturnType<typeof setInterval> | null = null

function loadPersistedLastSeen() {
  if (typeof window === "undefined") return
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, number>
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number") lastSeenMap.set(k, v)
    }
  } catch {
    // ignore parse errors
  }
}

function persistLastSeen() {
  if (typeof window === "undefined") return
  try {
    const obj: Record<string, number> = {}
    lastSeenMap.forEach((v, k) => {
      obj[k] = v
    })
    localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(obj))
  } catch {
    // ignore quota / serialization errors
  }
}

function notifyListeners() {
  listeners.forEach((l) => l())
}

function initPresenceForUser(userId: string) {
  if (initializedForUser === userId) return
  initializedForUser = userId

  loadPersistedLastSeen()

  const supabase = getClient()
  const channel = supabase.channel("global_presence", {
    config: { presence: { key: userId } },
  })

  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<string, unknown[]>
      const next = new Set<string>(Object.keys(state))

      // Anyone who just left — stamp a last_seen
      for (const id of onlineSet) {
        if (!next.has(id)) {
          lastSeenMap.set(id, Date.now())
        }
      }

      onlineSet = next
      notifyListeners()
    })
    .on("presence", { event: "leave" }, ({ key }: { key: string }) => {
      lastSeenMap.set(key, Date.now())
      onlineSet.delete(key)
      notifyListeners()
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ online_at: new Date().toISOString() })
      }
    })

  // Persist last-seen map every 15s so it survives reloads
  if (persistTimer) clearInterval(persistTimer)
  persistTimer = setInterval(persistLastSeen, 15_000)

  // Flush on unload
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", persistLastSeen)
  }
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function usePresence(currentUserId: string | null) {
  // Bump a local counter whenever shared state changes, forcing a re-render
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!currentUserId) return
    initPresenceForUser(currentUserId)
    const l = () => setTick((t) => t + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [currentUserId])

  const isOnline = useCallback((userId: string | null | undefined): boolean => {
    if (!userId) return false
    return onlineSet.has(userId)
  }, [])

  const getLastSeen = useCallback((userId: string | null | undefined): number | null => {
    if (!userId) return null
    return lastSeenMap.get(userId) ?? null
  }, [])

  return { isOnline, getLastSeen }
}

// ─── Formatter ────────────────────────────────────────────────────────────────

export function formatLastSeen(timestamp: number | null | undefined): string | null {
  if (!timestamp) return null
  const diff = Date.now() - timestamp
  if (diff < 0) return null

  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "last seen just now"
  if (minutes < 60) return `last seen ${minutes} min ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `last seen ${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days === 1) return "last seen yesterday"
  if (days < 7) return `last seen ${days}d ago`

  const d = new Date(timestamp)
  return `last seen ${d.toLocaleDateString()}`
}
