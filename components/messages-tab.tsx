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

// Pastel avatar colours derived from the first character
const AVATAR_COLOURS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500",   "bg-indigo-500", "bg-teal-500", "bg-orange-500",
]
function avatarColour(name: string): string {
  const idx = (name.charCodeAt(0) || 0) % AVATAR_COLOURS.length
  return AVATAR_COLOURS[idx]
}

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
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterTab>("all")
  const openedIds = useRef<Set<string>>(new Set())
  const didAutoOpen = useRef(false)

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
      const patched = incoming.map((c) =>
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
    async function init() {
      const supabase = getSharedSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id ?? null)
      await fetchConversations()
    }
    init()
  }, [fetchConversations])

  // Realtime: refresh list on new messages
  useEffect(() => {
    if (!isAuthenticated || !userId) return
    const supabase = getSharedSupabaseClient()
    const channel = supabase
      .channel("messages_tab_list_v3")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        fetchConversations()
      })
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
    setDeleting(true)
    try {
      const res = await fetch(`/api/messages/conversations/${deleteTarget.id}`, { method: "DELETE" })
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== deleteTarget.id))
        openedIds.current.delete(deleteTarget.id)
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
    <div className="flex min-h-dvh flex-col bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/50">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Messages</h1>
            {totalUnread > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold leading-none text-primary-foreground">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </div>
          {conversations.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {conversations.length} {conversations.length === 1 ? "chat" : "chats"}
            </span>
          )}
        </div>

        {/* Search bar */}
        {conversations.length > 0 && (
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search messages…"
                className="h-9 rounded-full border-0 bg-muted/60 pl-9 pr-9 text-sm focus-visible:ring-1 focus-visible:ring-primary/40"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/20 hover:bg-muted-foreground/30 text-muted-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Filter pills */}
        {conversations.length > 0 && (
          <div className="flex gap-2 px-4 pb-3">
            <button
              onClick={() => setFilter("all")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                filter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                filter === "unread"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              Unread
              {unreadCount > 0 && (
                <span className={cn(
                  "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none",
                  filter === "unread" ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"
                )}>
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1">
        {loading ? (
          <ConversationsSkeleton />
        ) : !isAuthenticated ? (
          <NotAuthenticatedState />
        ) : conversations.length === 0 ? (
          <EmptyState />
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No results found</p>
            <p className="text-xs text-muted-foreground">
              {filter === "unread" ? "No unread messages right now." : `Nothing matched "${search}"`}
            </p>
          </div>
        ) : (
          <div>
            {grouped.map(({ label, items }) => (
              <div key={label}>
                {/* Section label */}
                <div className="sticky top-[calc(var(--header-h,140px))] z-[1] flex items-center gap-3 px-4 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {label}
                  </span>
                  <div className="h-px flex-1 bg-border/40" />
                </div>
                <ul role="list">
                  {items.map((convo) => (
                    <ConversationItem
                      key={convo.id}
                      conversation={convo}
                      currentUserId={userId ?? ""}
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
  onClick,
  onDelete,
}: {
  conversation: Conversation
  currentUserId: string
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
  const colour    = avatarColour(shopName)

  const otherUserId = conversation.buyer_id === currentUserId ? conversation.vendor_id : conversation.buyer_id
  const { isOnline, getLastSeen } = usePresence(currentUserId)
  const online = isOnline(otherUserId)
  const lastSeenText = formatLastSeen(getLastSeen(otherUserId))

  return (
    <li>
      <div className="group relative flex items-center transition-colors hover:bg-muted/40 active:bg-muted/60">
        {/* Unread accent stripe */}
        {hasUnread && (
          <span className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full bg-primary" />
        )}

        {/* Main tap area */}
        <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className={cn(
              "relative h-14 w-14 overflow-hidden rounded-full ring-2 transition-all",
              hasUnread ? "ring-primary/40" : "ring-border/60"
            )}>
              {avatarUrl ? (
                <Image src={avatarUrl} alt={shopName} fill className="object-cover" sizes="56px" />
              ) : (
                <div className={cn("flex h-full w-full items-center justify-center text-lg font-bold text-white", colour)}>
                  {shopName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Online / product badge */}
            {online ? (
              <span
                aria-label="Online"
                className="absolute bottom-0.5 right-0.5 block h-3 w-3 rounded-full border-2 border-background bg-emerald-500"
              />
            ) : products?.image_url ? (
              <div className="absolute -bottom-0.5 -right-0.5 h-6 w-6 overflow-hidden rounded-full border-2 border-background bg-muted shadow-sm">
                <Image src={products.image_url} alt={products.name ?? ""} width={24} height={24} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted shadow-sm">
                <ShoppingBag className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Text */}
          <div className="min-w-0 flex-1 space-y-0.5">
            {/* Row 1: name + time */}
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1">
                <span className={cn(
                  "truncate text-[15px] leading-snug",
                  hasUnread ? "font-bold text-foreground" : "font-medium text-foreground"
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
                <span className="flex h-[20px] min-w-[20px] shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold leading-none text-primary-foreground">
                  {unreadNum > 99 ? "99+" : unreadNum}
                </span>
              )}
            </div>

            {/* Row 3: presence / product context */}
            <p className="flex items-center gap-1 truncate text-[11px]">
              {online ? (
                <span className="font-medium text-emerald-600 dark:text-emerald-400">● online</span>
              ) : lastSeenText ? (
                <span className="text-muted-foreground/70">{lastSeenText}</span>
              ) : (
                <span className="truncate text-muted-foreground/60">
                  {products?.name ?? "Product enquiry"}
                </span>
              )}
            </p>
          </div>
        </button>

        {/* Delete button — visible on hover */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          aria-label="Delete conversation"
          className="flex shrink-0 items-center justify-center px-3 py-3.5 text-muted-foreground/30 opacity-0 transition-all group-hover:opacity-100 hover:text-destructive"
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
  return (
    <ul aria-label="Loading conversations">
      {Array.from({ length: 7 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3.5">
          <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2.5">
            <div className="flex justify-between">
              <div className="h-3.5 w-28 animate-pulse rounded-full bg-muted" />
              <div className="h-3 w-10 animate-pulse rounded-full bg-muted" />
            </div>
            <div className="h-3 w-44 animate-pulse rounded-full bg-muted" />
            <div className="h-3 w-32 animate-pulse rounded-full bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 px-6 py-28 text-center">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <MessageCircle className="h-9 w-9 text-primary" />
        <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
          0
        </span>
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-bold text-foreground">No messages yet</h2>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          Browse products and tap <strong>Message Seller</strong> to start a conversation with a vendor.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => (window.location.href = "/?tab=store")}>
        Browse products
      </Button>
    </div>
  )
}

function NotAuthenticatedState() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 px-6 py-28 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <Store className="h-9 w-9 text-muted-foreground" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-bold text-foreground">Sign in to view messages</h2>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          Create an account or sign in to chat with vendors and track your conversations.
        </p>
      </div>
      <Button size="sm" onClick={() => (window.location.href = "/vendor/login")}>
        Sign in
      </Button>
    </div>
  )
}
