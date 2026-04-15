"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { MessageCircle, Store, ShoppingBag, Trash2 } from "lucide-react"

// Module-level singleton — reuses the same client as app-shell to prevent
// "Multiple GoTrueClient instances" warnings
let _sharedClient: ReturnType<typeof createBrowserClient> | null = null
function getSharedSupabaseClient() {
  if (!_sharedClient) _sharedClient = createBrowserClient()
  return _sharedClient
}
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { isToday, isYesterday, format } from "date-fns"
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
  /** Called whenever a conversation is opened (id) or closed (null) */
  onConversationChange?: (conversationId: string | null) => void
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  if (isToday(d)) return format(d, "HH:mm")
  if (isYesterday(d)) return "Yesterday"
  return format(d, "dd/MM/yyyy")
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
  // IDs of conversations we've opened this session — kept zero in the local list
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
      if (!res.ok) {
        setLoading(false)
        return
      }
      const data = await res.json()
      setIsAuthenticated(true)
      const incoming: Conversation[] = data.conversations ?? []
      // Zero out unread for conversations we've already opened this session
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

  // Init: get user + load conversations — use module-level singleton to avoid multiple clients
  useEffect(() => {
    async function init() {
      const supabase = getSharedSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id ?? null
      setUserId(uid)
      await fetchConversations()
    }
    init()
  }, [fetchConversations])

  // Realtime: refresh conversation list on new messages (INSERT only)
  // Skip messages the current user sent — they don't generate unread for themselves
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
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [isAuthenticated, userId, fetchConversations])

  // Auto-open a specific conversation (from deep-link / message-seller button)
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
    // Zero out locally immediately — no waiting for server
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

  if (activeConversation) {
    return (
      <ChatWindow
        conversation={activeConversation}
        currentUserId={userId ?? ""}
        onBack={closeConversation}
      />
    )
  }

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count ?? 0), 0)

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-20">
      {/* Header — WhatsApp style */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/98 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-4">
          <h1 className="flex-1 text-xl font-bold text-foreground tracking-tight">Chats</h1>
          {totalUnread > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        {loading ? (
          <ConversationsSkeleton />
        ) : !isAuthenticated ? (
          <NotAuthenticatedState />
        ) : conversations.length === 0 ? (
          <EmptyState />
        ) : (
          <ul role="list">
            {conversations.map((convo) => (
              <ConversationItem
                key={convo.id}
                conversation={convo}
                currentUserId={userId ?? ""}
                onClick={() => openConversation(convo)}
                onDelete={() => setDeleteTarget(convo)}
                formatTime={formatTime}
              />
            ))}
          </ul>
        )}
      </main>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteConversation}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ConversationItem({
  conversation,
  currentUserId,
  onClick,
  onDelete,
  formatTime,
}: {
  conversation: Conversation
  currentUserId: string
  onClick: () => void
  onDelete: () => void
  formatTime: (d: string | null) => string
}) {
  const { products, vendors, unread_count, last_message_at, last_message, is_buyer } =
    conversation
  const hasUnread = (unread_count ?? 0) > 0
  const unreadNum = unread_count ?? 0

  const timeStr = formatTime(last_message_at ?? conversation.created_at)

  const previewText = last_message
    ? last_message.sender_id === currentUserId
      ? `You: ${last_message.content ?? "Image"}`
      : last_message.content ?? "Image"
    : "No messages yet"

  const shopName = is_buyer ? (vendors?.shop_name ?? "Unknown Shop") : "Buyer"

  return (
    <li>
      <div className="flex items-stretch">
        {/* Main tap area */}
        <button
          onClick={onClick}
          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors active:bg-muted/60"
        >
          {/* Avatar: product image */}
          <div
            className="relative shrink-0 overflow-hidden rounded-full bg-muted"
            style={{ height: "54px", width: "54px" }}
          >
            {products?.image_url ? (
              <Image
                src={products.image_url}
                alt={products.name ?? "Product"}
                fill
                className="object-cover"
                sizes="54px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted">
                <ShoppingBag className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Text info */}
          <div className="min-w-0 flex-1">
            {/* Row 1: name + time */}
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1">
                <span
                  className={cn(
                    "truncate text-[15px] leading-snug",
                    hasUnread ? "font-bold text-foreground" : "font-semibold text-foreground"
                  )}
                >
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
              <span
                className={cn(
                  "shrink-0 text-xs",
                  hasUnread ? "font-semibold text-primary" : "text-muted-foreground"
                )}
              >
                {timeStr}
              </span>
            </div>

            {/* Row 2: last message preview + unread badge */}
            <div className="mt-0.5 flex items-center gap-2">
              <p
                className={cn(
                  "flex-1 truncate text-sm leading-snug",
                  hasUnread
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {previewText}
              </p>
              {hasUnread && (
                <span className="flex h-[20px] min-w-[20px] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold leading-none text-primary-foreground">
                  {unreadNum > 99 ? "99+" : unreadNum}
                </span>
              )}
            </div>

            {/* Row 3: product context */}
            <p className="mt-0.5 truncate text-xs text-muted-foreground/70">
              {products?.name ?? "Product enquiry"}
            </p>
          </div>
        </button>

        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          aria-label="Delete conversation"
          className="flex shrink-0 items-center justify-center px-3 text-muted-foreground/40 transition-colors hover:text-destructive active:text-destructive focus-visible:text-destructive focus-visible:outline-none"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Divider — inset like WhatsApp */}
      <div className="ml-[82px] h-px bg-border/60" aria-hidden />
    </li>
  )
}

function ConversationsSkeleton() {
  return (
    <ul aria-label="Loading conversations">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <div
            className="shrink-0 animate-pulse rounded-full bg-muted"
            style={{ height: "54px", width: "54px" }}
          />
          <div className="flex-1 space-y-2">
            <div className="flex justify-between">
              <div className="h-4 w-32 animate-pulse rounded-full bg-muted" />
              <div className="h-3 w-10 animate-pulse rounded-full bg-muted" />
            </div>
            <div className="h-3 w-48 animate-pulse rounded-full bg-muted" />
            <div className="h-3 w-36 animate-pulse rounded-full bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <MessageCircle className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-foreground">No messages yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tap &quot;Message Seller&quot; on any product to start a conversation.
        </p>
      </div>
    </div>
  )
}

function NotAuthenticatedState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Store className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-foreground">Sign in to view messages</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create an account or sign in to message vendors and see your conversations.
        </p>
      </div>
      <Button
        variant="default"
        size="sm"
        onClick={() => (window.location.href = "/vendor/login")}
      >
        Sign in
      </Button>
    </div>
  )
}
