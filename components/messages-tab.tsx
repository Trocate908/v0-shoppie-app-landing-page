"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { MessageCircle, Store, ShoppingBag, Trash2, Search, X, Check, Clock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { usePresence, formatLastSeen } from "@/hooks/use-presence"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { isToday, isYesterday, format, differenceInCalendarDays } from "date-fns"
import ChatWindow from "@/components/chat-window"
import { VerificationBadge } from "@/components/verification-badge"
import { avatarGradient } from "@/lib/avatar"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// Module-level singleton — reuses the same client across renders
let _sharedClient: ReturnType<typeof createBrowserClient> | null = null
function getSharedSupabaseClient() {
  if (!_sharedClient) _sharedClient = createBrowserClient()
  return _sharedClient
}

interface ConversationProduct {
  id: string
  name: string
  image_url: string | null
  price: number
}

interface ConversationVendor {
  id: string
  shop_name: string
  profile_picture_url: string | null
  is_verified: boolean | null
  verification_expires_at: string | null
}

interface Conversation {
  id: string
  product_id: string
  buyer_id: string
  vendor_id: string
  last_message_at: string | null
  created_at: string
  unread_count: number
  is_buyer: boolean
  products: ConversationProduct | null
  vendors: ConversationVendor | null
  last_message: { content: string | null; sender_id: string } | null
}

interface MessagesTabProps {
  initialConversationId?: string | null
  onConversationChange?: (conversationId: string | null) => void
}

type FilterTab = "all" | "unread"

function formatTime(dateStr: string | null): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  if (isToday(d)) return format(d, "HH:mm")
  if (isYesterday(d)) return "Yesterday"
  if (differenceInCalendarDays(new Date(), d) < 7) return format(d, "EEE")
  return format(d, "dd/MM/yy")
}

function sectionLabel(dateStr: string | null): string {
  if (!dateStr) return "Older"
  const d = new Date(dateStr)
  if (isToday(d)) return "Today"
  if (isYesterday(d)) return "Yesterday"
  if (differenceInCalendarDays(new Date(), d) < 7) return "This week"
  return "Older"
}

export default function MessagesTab({
  initialConversationId,
  onConversationChange,
}: MessagesTabProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  // Single presence subscription for the whole list — NOT inside each row
  const { isOnline, getLastSeen } = usePresence(userId)
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterTab>("all")
  const openedIds = useRef<Set<string>>(new Set())
  // IDs of conversations that have been deleted — any fetch that returns them
  // will be filtered out, so stale reads can't resurrect a deleted chat.
  const deletedIds = useRef<Set<string>>(new Set())
  const didAutoOpen = useRef(false)
  const headerObserverRef = useRef<ResizeObserver | null>(null)
  const [headerHeight, setHeaderHeight] = useState(0)

  // Measure the sticky header so the section labels can pin directly beneath
  // it. A hardcoded offset drifts the moment the header's contents change.
  const attachHeader = useCallback((el: HTMLElement | null) => {
    headerObserverRef.current?.disconnect()
    headerObserverRef.current = null
    if (!el) return
    setHeaderHeight(el.offsetHeight)
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => setHeaderHeight(el.offsetHeight))
    observer.observe(el)
    headerObserverRef.current = observer
  }, [])

  useEffect(() => () => headerObserverRef.current?.disconnect(), [])

  const sortConversations = (list: Conversation[]): Conversation[] =>
    list.slice().sort((a, b) => {
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : new Date(a.created_at).getTime()
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : new Date(b.created_at).getTime()
      return bTime - aTime
    })

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/messages/conversations")
      if (res.status === 401) {
        setIsAuthenticated(false)
        setLoading(false)
        return
      }
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      setIsAuthenticated(true)
      const incoming: Conversation[] = data.conversations ?? []
      // Drop anything the user already deleted this session — protects against
      // stale realtime reads or race conditions re-inserting deleted chats.
      const filtered = incoming.filter((c) => !deletedIds.current.has(c.id))
      // Zero out unread for conversations we've already opened this session
      const patched = filtered.map((c) =>
        openedIds.current.has(c.id) ? { ...c, unread_count: 0 } : c
      )
      setConversations(sortConversations(patched))
    } catch {
      setIsAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Previously this awaited a network auth.getUser() and only then started
    // the list fetch, so the skeleton waited on two chained round trips. The
    // API route is the real auth authority; here we only need the user id for
    // presence, which the locally cached session already has. So resolve it
    // without a network hop and kick the fetch off immediately.
    getSharedSupabaseClient()
      .auth.getSession()
      .then(({ data }) => setUserId(data.session?.user?.id ?? null))
      .catch(() => setUserId(null))
    void fetchConversations()
  }, [fetchConversations])

  // Realtime: refresh list on new messages
  useEffect(() => {
    if (!isAuthenticated || !userId) return
    const supabase = getSharedSupabaseClient()
    const channel = supabase
      .channel("messages_tab_list_v2")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as { sender_id?: string }
          // Only refresh the list when someone else sent the message
          if (msg.sender_id !== userId) {
            fetchConversations()
          } else {
            // Own message: still refresh to update the preview text + timestamp, but
            // fetchConversations will correctly return unread_count=0 for own messages
            // because the API already uses neq("sender_id", user.id)
            fetchConversations()
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "conversations" },
        (payload) => {
          const removed = payload.old as { id?: string }
          if (!removed?.id) return
          // Remove instantly from local state + record so future fetches skip it.
          deletedIds.current.add(removed.id)
          setConversations((prev) => prev.filter((c) => c.id !== removed.id))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [isAuthenticated, userId, fetchConversations])

  // Auto-open from deep-link
  useEffect(() => {
    if (!initialConversationId || didAutoOpen.current || conversations.length === 0) return
    const target = conversations.find((c) => c.id === initialConversationId)
    if (target) {
      didAutoOpen.current = true
      openConversation(target)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConversationId, conversations.length])

  function openConversation(convo: Conversation) {
    openedIds.current.add(convo.id)
    setConversations((prev) =>
      prev.map((c) => (c.id === convo.id ? { ...c, unread_count: 0 } : c))
    )
    setActiveConversation(convo)
    onConversationChange?.(convo.id)
  }

  function closeConversation() {
    setActiveConversation(null)
    onConversationChange?.(null)
    fetchConversations()
  }

  async function deleteConversation() {
    if (!deleteTarget) return
    const targetId = deleteTarget.id
    setDeleting(true)
    try {
      const res = await fetch(`/api/messages/conversations/${targetId}`, { method: "DELETE" })
      if (res.ok) {
        // Mark as deleted so future fetches / realtime refreshes filter it out
        deletedIds.current.add(targetId)
        setConversations((prev) => prev.filter((c) => c.id !== targetId))
        openedIds.current.delete(targetId)
      } else {
        // Surface the real error so we don't silently "succeed"
        console.log("[v0] deleteConversation failed:", res.status, await res.text().catch(() => ""))
      }
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const filteredConversations = useMemo(() => {
    let list = conversations
    if (filter === "unread") list = list.filter((c) => (c.unread_count ?? 0) > 0)
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((c) => {
      const shop    = c.vendors?.shop_name?.toLowerCase() ?? ""
      const product = c.products?.name?.toLowerCase() ?? ""
      const preview = c.last_message?.content?.toLowerCase() ?? ""
      return shop.includes(q) || product.includes(q) || preview.includes(q)
    })
  }, [conversations, search, filter])

  // Group filtered conversations by section label
  const grouped = useMemo(() => {
    const order = ["Today", "Yesterday", "This week", "Older"]
    const map = new Map<string, Conversation[]>()
    for (const c of filteredConversations) {
      const label = sectionLabel(c.last_message_at ?? c.created_at)
      if (!map.has(label)) map.set(label, [])
      map.get(label)!.push(c)
    }
    return order.filter((l) => map.has(l)).map((l) => ({ label: l, items: map.get(l)! }))
  }, [filteredConversations])

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count ?? 0), 0)
  const unreadCount = conversations.filter((c) => (c.unread_count ?? 0) > 0).length

  if (activeConversation) {
    return (
      <ChatWindow
        conversation={activeConversation}
        currentUserId={userId ?? ""}
        onBack={closeConversation}
      />
    )
  }

  return (
    <div className="chat-bg-pattern relative flex min-h-dvh flex-col bg-background pb-20">
      {/* Header */}
      <header
        ref={attachHeader}
        className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl"
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold leading-none tracking-tight text-foreground">
              Messages
            </h1>
            {/* Status line replaces the bare chat count: it says what actually
                needs attention instead of just how many rows exist. */}
            <p className="mt-1.5 truncate text-xs text-muted-foreground">
              {conversations.length === 0
                ? "Your conversations with vendors appear here"
                : totalUnread > 0
                  ? `${totalUnread} unread in ${unreadCount} ${unreadCount === 1 ? "chat" : "chats"}`
                  : `${conversations.length} ${conversations.length === 1 ? "conversation" : "conversations"} · all caught up`}
            </p>
          </div>
          {totalUnread > 0 && (
            <span className="mt-0.5 flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-primary px-2 text-xs font-bold leading-none text-primary-foreground shadow-sm ring-4 ring-primary/10">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </div>

        {/* Search and filtering share one row now — three stacked header rows
            ate vertical space that the conversation list needs on mobile. */}
        {conversations.length > 0 && (
          <div className="flex items-center gap-2 px-4 pb-3">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search messages…"
                className="h-10 rounded-xl border border-transparent bg-muted/50 pl-9 pr-9 text-sm shadow-none transition-colors focus-visible:border-primary/30 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/15"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="tap-target absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-muted-foreground/20 text-muted-foreground transition-colors hover:bg-muted-foreground/30"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Segmented control — the unread count lives in the header badge,
                so these stay text-only and don't squeeze the search field. */}
            <div className="flex shrink-0 items-center gap-0.5 rounded-xl bg-muted/50 p-1">
              {(["all", "unread"] as FilterTab[]).map((tab) => {
                const active = filter === tab
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilter(tab)}
                    aria-pressed={active}
                    className={cn(
                      "tap-target h-8 rounded-lg px-3 text-xs font-semibold capitalize transition-all",
                      active
                        ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="relative flex-1">
        {loading ? (
          <ConversationsSkeleton />
        ) : !isAuthenticated ? (
          <NotAuthenticatedState />
        ) : conversations.length === 0 ? (
          <EmptyState />
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted ring-1 ring-border/60">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-semibold text-foreground">
              {filter === "unread" ? "Nothing unread" : "No matches"}
            </p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
              {filter === "unread"
                ? "You're all caught up — every conversation has been read."
                : `No conversations match “${search}”.`}
            </p>
            {/* Dead ends are the worst empty state — always offer the way out. */}
            <div className="mt-5 flex items-center gap-2">
              {search && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full px-4"
                  onClick={() => setSearch("")}
                >
                  Clear search
                </Button>
              )}
              {filter === "unread" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full px-4"
                  onClick={() => setFilter("all")}
                >
                  Show all
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div>
            {grouped.map(({ label, items }) => (
              <div key={label}>
                {/* Section label — pins directly beneath the measured header */}
                <div
                  style={{ top: headerHeight }}
                  className="sticky z-[1] flex items-center gap-3 bg-background/85 px-4 py-2 backdrop-blur"
                >
                  {/* Full opacity: at 10px on the patterned wallpaper, the
                      70% muted tone dropped below readable contrast. */}
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    {label}
                  </span>
                  <div className="h-px flex-1 bg-border/50" />
                  <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <ul role="list" className="space-y-1.5 px-3 pb-2">
                  {items.map((convo) => (
                    <ConversationItem
                      key={convo.id}
                      conversation={convo}
                      currentUserId={userId ?? ""}
                      isOnline={isOnline}
                      getLastSeen={getLastSeen}
                      onClick={() => openConversation(convo)}
                      onDelete={() => setDeleteTarget(convo)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes this conversation and all its messages. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteConversation}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Conversation Row ───────────────────────────────────────────────────────

function ConversationItem({
  conversation,
  currentUserId,
  isOnline,
  getLastSeen,
  onClick,
  onDelete,
}: {
  conversation: Conversation
  currentUserId: string
  isOnline: (id: string | null | undefined) => boolean
  getLastSeen: (id: string | null | undefined) => number | null
  onClick: () => void
  onDelete: () => void
}) {
  const { products, vendors, unread_count, last_message_at, last_message, is_buyer } = conversation
  const hasUnread = (unread_count ?? 0) > 0
  const unreadNum = unread_count ?? 0
  const timeStr = formatTime(last_message_at ?? conversation.created_at)
  const ownedLast = last_message?.sender_id === currentUserId
  const previewText = last_message
    ? (last_message.content ?? "📷 Photo")
    : "Tap to start chatting"
  const shopName  = is_buyer ? (vendors?.shop_name ?? "Unknown Shop") : "Buyer"
  const avatarUrl = is_buyer ? (vendors?.profile_picture_url ?? null) : null
  const gradient  = avatarGradient(shopName)

  const otherUserId = conversation.buyer_id === currentUserId ? conversation.vendor_id : conversation.buyer_id
  const online = isOnline(otherUserId)
  const lastSeenText = formatLastSeen(getLastSeen(otherUserId))

  return (
    <li>
      {/* Inset card row: the tinted surface plus unread ring makes the rows
          scan as distinct conversations instead of one flat list. */}
      <div
        className={cn(
          "group relative flex items-center overflow-hidden rounded-2xl transition-colors",
          hasUnread
            ? "bg-primary/[0.05] ring-1 ring-primary/20"
            : "bg-muted/40 hover:bg-muted/60 active:bg-muted/70"
        )}
      >
        {/* Unread accent stripe */}
        {hasUnread && (
          <span
            aria-hidden
            className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-primary"
          />
        )}

        {/* Main tap area */}
        <button
          onClick={onClick}
          className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2 text-left"
        >
          {/* Avatar */}
          <div className="relative shrink-0">
            <div
              className={cn(
                "relative h-14 w-14 overflow-hidden rounded-full ring-2 transition-all",
                hasUnread ? "ring-primary/30" : "ring-border/50"
              )}
            >
              {avatarUrl ? (
                <Image src={avatarUrl} alt={shopName} fill className="object-cover" sizes="56px" />
              ) : (
                <div
                  className={cn(
                    "flex h-full w-full items-center justify-center bg-gradient-to-br text-lg font-bold text-white",
                    gradient
                  )}
                >
                  {shopName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Presence only — the product this chat is about now has its own
                chip in row 3, so the avatar corner isn't doing double duty. */}
            {online && (
              <span
                aria-label="Online"
                className="absolute bottom-0.5 right-0.5 block h-3.5 w-3.5 rounded-full border-2 border-background bg-emerald-500"
              />
            )}
          </div>

          {/* Text */}
          <div className="min-w-0 flex-1 space-y-1">
            {/* Row 1: name + time */}
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1">
                <span className={cn(
                  "truncate text-[15px] leading-snug text-foreground",
                  hasUnread ? "font-bold" : "font-semibold"
                )}>
                  {shopName}
                </span>
                {is_buyer && vendors?.is_verified && (
                  <VerificationBadge
                    isVerified={vendors.is_verified}
                    verificationExpiresAt={vendors.verification_expires_at}
                    size="sm"
                    showTooltip={false}
                  />
                )}
              </span>
              <span className={cn(
                "shrink-0 text-[11px] tabular-nums",
                hasUnread ? "font-semibold text-primary" : "text-muted-foreground"
              )}>
                {timeStr}
              </span>
            </div>

            {/* Row 2: preview + unread badge */}
            <div className="flex items-center gap-2">
              <p className={cn(
                "flex-1 min-w-0 truncate text-[13px] leading-snug",
                hasUnread ? "font-medium text-foreground" : "text-muted-foreground"
              )}>
                {ownedLast && !hasUnread && (
                  <span className="mr-1 inline-flex items-center align-middle text-primary">
                    <DoubleTickIcon className="h-3.5 w-3.5" />
                  </span>
                )}
                {previewText}
              </p>
              {hasUnread && (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold leading-none text-primary-foreground shadow-sm">
                  {unreadNum > 99 ? "99+" : unreadNum}
                </span>
              )}
            </div>

            {/* Row 3: presence + the product this chat is about, as a chip so
                the item is identifiable at a glance. The product used to be a
                fallback that presence replaced, so it vanished the moment the
                other party came online — losing what you're discussing. */}
            <div className="flex items-center gap-1.5">
              {online ? (
                <span className="shrink-0 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  ● online
                </span>
              ) : lastSeenText ? (
                <span className="shrink-0 text-[11px] text-muted-foreground">{lastSeenText}</span>
              ) : null}
              <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-background/80 py-0.5 pl-0.5 pr-2 ring-1 ring-border/60">
                <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full bg-muted">
                  {products?.image_url ? (
                    <Image
                      src={products.image_url}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="20px"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center">
                      <ShoppingBag className="h-2.5 w-2.5 text-muted-foreground" />
                    </span>
                  )}
                </span>
                <span className="truncate text-[11px] font-medium text-muted-foreground">
                  {products?.name ?? "Product enquiry"}
                </span>
              </span>
            </div>
          </div>
        </button>

        {/* Delete button — visible on hover */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          aria-label={`Delete conversation with ${shopName}`}
          className={cn(
            "tap-target mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            "text-muted-foreground/40 transition-all hover:bg-destructive/10 hover:text-destructive",
            // Touch devices have no hover, so a hover-only control is
            // unreachable there. Stay visible without hover support and use the
            // quieter reveal on pointer devices.
            "opacity-100 [@media(hover:hover)]:opacity-0",
            "[@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
          )}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function DoubleTickIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="m2 12 5 5 10-10" />
      <path d="m8 12 5 5 10-10" />
    </svg>
  )
}

function ConversationsSkeleton() {
  // Mirrors the real row geometry (inset card, 56px avatar, three text rows) so
  // the list doesn't jump when the data lands.
  return (
    <div aria-label="Loading conversations" className="space-y-1.5 px-3 pt-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl bg-muted/40 py-3 pl-4 pr-2">
          <div className="skeleton-shimmer h-14 w-14 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div className="skeleton-shimmer h-3.5 w-28 rounded-full" />
              <div className="skeleton-shimmer h-3 w-10 rounded-full" />
            </div>
            <div className="skeleton-shimmer h-3 w-3/5 rounded-full" />
            <div className="skeleton-shimmer h-4 w-32 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <div className="relative mb-6">
        <div aria-hidden className="absolute inset-0 -m-6 rounded-full bg-primary/5 blur-2xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/15">
          <MessageCircle className="h-9 w-9 text-primary" strokeWidth={1.75} />
        </div>
      </div>
      <h2 className="text-lg font-bold tracking-tight text-foreground">No messages yet</h2>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
        When you ask a vendor about something, the conversation lands here.
      </p>
      {/* Concrete first steps beat "browse products" for someone who has never
          sent a message and doesn't know the flow exists. */}
      <ol className="mt-7 w-full max-w-xs space-y-2.5 text-left">
        {[
          "Find something you like in the Store tab",
          "Tap Message Seller on the product",
          "Chat and agree on the deal",
        ].map((step, i) => (
          <li key={step} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
              {i + 1}
            </span>
            <span className="text-xs leading-relaxed text-muted-foreground">{step}</span>
          </li>
        ))}
      </ol>
      <Button
        size="sm"
        className="mt-7 rounded-full px-5"
        onClick={() => (window.location.href = "/?tab=store")}
      >
        Browse products
      </Button>
    </div>
  )
}

function NotAuthenticatedState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <div className="relative mb-6">
        <div aria-hidden className="absolute inset-0 -m-6 rounded-full bg-primary/5 blur-2xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-muted ring-1 ring-border/60">
          <Store className="h-9 w-9 text-muted-foreground" strokeWidth={1.75} />
        </div>
      </div>
      <h2 className="text-lg font-bold tracking-tight text-foreground">Sign in to view messages</h2>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
        Your chats with vendors are private to your account.
      </p>
      <Button
        size="sm"
        className="mt-7 rounded-full px-5"
        onClick={() => (window.location.href = "/vendor/login")}
      >
        Sign in
      </Button>
    </div>
  )
}
