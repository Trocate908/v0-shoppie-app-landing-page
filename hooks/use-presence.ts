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
 *
 * The subscription is a module-level singleton, so mounting it from the app
 * shell *and* the messages tab (and every chat header) creates one channel, not
 * three. Subscribers only re-render when the online set actually changes —
 * heartbeat echoes don't churn the conversation list.
 */

// ─── Module-level singleton state ─────────────────────────────────────────────

const LAST_SEEN_KEY = "shoppie_presence_last_seen_v1"
/** Keep the persisted map bounded — it grows one entry per user ever seen. */
const LAST_SEEN_LIMIT = 300

let sharedClient: ReturnType<typeof createBrowserClient> | null = null
function getClient() {
  if (!sharedClient) sharedClient = createBrowserClient()
  return sharedClient
}

type PresenceChannel = ReturnType<ReturnType<typeof createBrowserClient>["channel"]>

let onlineSet: Set<string> = new Set()
let lastSeenMap: Map<string, number> = new Map()
const listeners = new Set<() => void>()

let initializedForUser: string | null = null
let presenceChannel: PresenceChannel | null = null
let persistTimer: ReturnType<typeof setInterval> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null

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
    // Drop the oldest entries before writing so the map can't grow forever.
    if (lastSeenMap.size > LAST_SEEN_LIMIT) {
      const trimmed = [...lastSeenMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, LAST_SEEN_LIMIT)
      lastSeenMap = new Map(trimmed)
    }
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

/**
 * Swap in a new online set, notifying subscribers only when it really changed.
 * Presence `sync` fires on heartbeats too, so an unconditional notify woke the
 * whole conversation list every few seconds.
 */
function applyPresenceState(next: Set<string>) {
  let changed = next.size !== onlineSet.size
  if (!changed) {
    for (const id of next) {
      if (!onlineSet.has(id)) {
        changed = true
        break
      }
    }
  }
  if (!changed) return

  for (const id of onlineSet) {
    if (!next.has(id)) lastSeenMap.set(id, Date.now())
  }
  onlineSet = next
  notifyListeners()
}

function readPresenceState(channel: PresenceChannel) {
  const state = channel.presenceState() as Record<string, unknown[]>
  applyPresenceState(new Set<string>(Object.keys(state)))
}

// Re-track after the tab wakes up or the network comes back: presence entries
// expire while a backgrounded tab is suspended, and the server then shows the
// user as offline even though the page is open again.
function handleWake() {
  if (typeof document !== "undefined" && document.hidden) return
  void presenceChannel?.track({ online_at: new Date().toISOString() }).catch(() => {})
}

function initPresenceForUser(userId: string) {
  if (initializedForUser === userId) return
  initializedForUser = userId

  loadPersistedLastSeen()
  persistLastSeen()

  const supabase = getClient()
  const channel = supabase.channel("global_presence", {
    config: { presence: { key: userId } },
  })
  presenceChannel = channel

  channel
    .on("presence", { event: "sync" }, () => readPresenceState(channel))
    .on("presence", { event: "join" }, () => readPresenceState(channel))
    .on("presence", { event: "leave" }, ({ key }: { key: string }) => {
      lastSeenMap.set(key, Date.now())
      const next = new Set(onlineSet)
      next.delete(key)
      onlineSet = next
      notifyListeners()
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({ online_at: new Date().toISOString() }).catch(() => {})
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        // A single failed join used to leave every peer permanently "offline"
        // for the rest of the session. Reset and retry while anyone is still
        // listening for presence.
        initializedForUser = null
        presenceChannel = null
        supabase.removeChannel(channel)
        if (retryTimer) clearTimeout(retryTimer)
        retryTimer = setTimeout(() => {
          retryTimer = null
          if (listeners.size > 0 && !initializedForUser) initPresenceForUser(userId)
        }, 5000)
      }
    })

  // Persist last-seen so it survives reloads
  if (persistTimer) clearInterval(persistTimer)
  persistTimer = setInterval(persistLastSeen, 15_000)

  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", persistLastSeen)
    window.addEventListener("pagehide", persistLastSeen)
    document.addEventListener("visibilitychange", handleWake)
    window.addEventListener("online", handleWake)
  }
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function usePresence(currentUserId: string | null) {
  // Bump a local counter whenever shared state changes, forcing a re-render
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!currentUserId) return
    // Subscribe first: a membership change that landed between the init and the
    // listener registration would otherwise be missed until the next sync.
    const l = () => setTick((t) => t + 1)
    listeners.add(l)
    initPresenceForUser(currentUserId)
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
