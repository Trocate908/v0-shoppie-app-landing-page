"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { MessageCircle, Store, Package, Trash2, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { formatDistanceToNow } from "date-fns"
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
  onConversationOpen?: () => void
}

export default function MessagesTab({
  initialConversationId,
  onConversationOpen,
}: MessagesTabProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null)
  const [deleting, setDeleting] = useState(false)
  // Track which conversations we've opened so we don't re-apply unread from realtime
  const openedConvoIds = useRef<Set<string>>(new Set())
  const isConversationOpenRef = useRef(false)

  const sortConversations = (list: Conversation[]) =>
    list.slice().sort((a, b) => {
      const aUnread = (a.unread_count ?? 0) > 0 ? 1 : 0
      const bUnread = (b.unread_count ?? 0) > 0 ? 1 : 0
      if (bUnread !== aUnread) return bUnread - aUnread
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
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
      // For any conversation the user has already opened, force unread_count = 0
      const patched = incoming.map((c) =>
        openedConvoIds.current.has(c.id) ? { ...c, unread_count: 0 } : c
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
      const supabase = createBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUserId(user?.id ?? null)
      await fetchConversations()
    }
    init()
  }, [fetchConversations])

  // Auto-open a specific conversation when coming from message-seller-button
  useEffect(() => {
    if (!initialConversationId || conversations.length === 0) return
    const target = conversations.find((c) => c.id === initialConversationId)
    if (target) {
      openConversation(target)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConversationId, conversations.length])

  // Realtime: refresh list on new INSERT messages only (not on read-updates to avoid re-showing badge)
  useEffect(() => {
    if (!isAuthenticated) return
    const supabase = createBrowserClient()
    const channel = supabase
      .channel("messages_tab_list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          // Only refresh if no conversation is currently open
          if (!isConversationOpenRef.current) {
            fetchConversations()
          }
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [isAuthenticated, fetchConversations])

  function openConversation(convo: Conversation) {
    openedConvoIds.current.add(convo.id)
    isConversationOpenRef.current = true
    setActiveConversation(convo)
    onConversationOpen?.()
    // Immediately zero out the unread count for this conversation
    setConversations((prev) =>
      prev.map((c) => (c.id === convo.id ? { ...c, unread_count: 0 } : c))
    )
  }

  async function deleteConversation() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/messages/conversations/${deleteTarget.id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== deleteTarget.id))
        openedConvoIds.current.delete(deleteTarget.id)
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
        onBack={() => {
          isConversationOpenRef.current = false
          setActiveConversation(null)
          fetchConversations()
        }}
      />
    )
  }

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count ?? 0), 0)

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4">
          <div className="relative">
            <MessageCircle className="h-5 w-5 text-primary" />
            {totalUnread > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
          </div>
          <h1 className="text-lg font-semibold text-foreground">Messages</h1>
          {conversations.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">
              {conversations.length} chat{conversations.length !== 1 ? "s" : ""}
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
          <ul className="divide-y divide-border" role="list">
            {conversations.map((convo) => (
              <ConversationItem
                key={convo.id}
                conversation={convo}
                currentUserId={userId ?? ""}
                onClick={() => openConversation(convo)}
                onDelete={() => setDeleteTarget(convo)}
              />
            ))}
          </ul>
        )}
      </main>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages. This action cannot be undone.
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
}: {
  conversation: Conversation
  currentUserId: string
  onClick: () => void
  onDelete: () => void
}) {
  const { products, vendors, unread_count, last_message_at, last_message, is_buyer } =
    conversation
  const hasUnread = (unread_count ?? 0) > 0

  const timeAgo = last_message_at
    ? formatDistanceToNow(new Date(last_message_at), { addSuffix: true })
    : ""

  const previewText = last_message
    ? last_message.sender_id === currentUserId
      ? `You: ${last_message.content ?? "Sent an image"}`
      : last_message.content ?? "Sent an image"
    : "No messages yet"

  const shopName = is_buyer ? (vendors?.shop_name ?? "Unknown Shop") : "Buyer"

  return (
    <li className={cn("relative transition-colors", hasUnread ? "bg-primary/[0.03]" : "")}>
      {/* Unread accent bar */}
      {hasUnread && (
        <span className="absolute inset-y-0 left-0 w-0.5 rounded-r-full bg-primary" aria-hidden />
      )}

      <div className="flex items-center gap-0">
        {/* Main tap area */}
        <button
          onClick={onClick}
          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 active:bg-muted/70"
        >
          {/* Avatar: product image with unread ring */}
          <div
            className={cn(
              "relative h-13 w-13 shrink-0 overflow-hidden rounded-2xl bg-muted",
              hasUnread ? "ring-2 ring-primary ring-offset-1" : ""
            )}
            style={{ height: "52px", width: "52px" }}
          >
            {products?.image_url ? (
              <Image
                src={products.image_url}
                alt={products.name ?? "Product"}
                fill
                className="object-cover"
                sizes="52px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Text info */}
          <div className="min-w-0 flex-1">
            {/* Row 1: name + time */}
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1">
                <span
                  className={cn(
                    "truncate text-sm",
                    hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground"
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
              <span className={cn("shrink-0 text-[11px]", hasUnread ? "font-medium text-primary" : "text-muted-foreground")}>
                {timeAgo}
              </span>
            </div>

            {/* Row 2: product name */}
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {products?.name ?? "Product enquiry"}
            </p>

            {/* Row 3: last message preview + unread dot */}
            <div className="mt-1 flex items-center gap-2">
              <p
                className={cn(
                  "flex-1 truncate text-xs leading-snug",
                  hasUnread ? "font-semibold text-foreground" : "text-muted-foreground"
                )}
              >
                {previewText}
              </p>
              {hasUnread && (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                  {unread_count > 99 ? "99+" : unread_count}
                </span>
              )}
            </div>
          </div>
        </button>

        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          aria-label="Delete conversation"
          className="flex h-full shrink-0 items-center justify-center px-3 py-3.5 text-muted-foreground transition-colors hover:text-destructive active:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  )
}

function ConversationsSkeleton() {
  return (
    <ul className="divide-y divide-border" aria-label="Loading conversations">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3.5">
          <div className="h-13 w-13 animate-pulse rounded-2xl bg-muted" style={{ height: "52px", width: "52px" }} />
          <div className="flex-1 space-y-2">
            <div className="flex justify-between">
              <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
              <div className="h-3 w-14 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-3 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3 w-48 animate-pulse rounded bg-muted" />
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
