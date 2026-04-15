"use client"

import { useState, useEffect, useCallback } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { MessageCircle, Store, Package, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { formatDistanceToNow } from "date-fns"
import ChatWindow from "@/components/chat-window"
import { VerificationBadge } from "@/components/verification-badge"

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
      // Sort: unread conversations first, then by most recent message
      const sorted = (data.conversations ?? []).slice().sort((a: Conversation, b: Conversation) => {
        const aUnread = (a.unread_count ?? 0) > 0 ? 1 : 0
        const bUnread = (b.unread_count ?? 0) > 0 ? 1 : 0
        if (bUnread !== aUnread) return bUnread - aUnread
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
        return bTime - aTime
      })
      setConversations(sorted)
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
      setActiveConversation(target)
      onConversationOpen?.()
    }
  }, [initialConversationId, conversations, onConversationOpen])

  // Realtime: refresh list on new/updated messages
  useEffect(() => {
    if (!isAuthenticated) return
    const supabase = createBrowserClient()
    const channel = supabase
      .channel("messages_tab_list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          fetchConversations()
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [isAuthenticated, fetchConversations])

  function openConversation(convo: Conversation) {
    setActiveConversation(convo)
    onConversationOpen?.()
    // Optimistically clear unread badge on this conversation
    setConversations((prev) =>
      prev.map((c) => (c.id === convo.id ? { ...c, unread_count: 0 } : c))
    )
  }

  if (activeConversation) {
    return (
      <ChatWindow
        conversation={activeConversation}
        currentUserId={userId ?? ""}
        onBack={() => {
          setActiveConversation(null)
          fetchConversations()
        }}
      />
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">Messages</h1>
          {conversations.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">
              {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
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
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ConversationItem({
  conversation,
  currentUserId,
  onClick,
}: {
  conversation: Conversation
  currentUserId: string
  onClick: () => void
}) {
  const { products, vendors, unread_count, last_message_at, last_message, is_buyer } =
    conversation
  const hasUnread = unread_count > 0

  const timeAgo = last_message_at
    ? formatDistanceToNow(new Date(last_message_at), { addSuffix: true })
    : ""

  const previewText = last_message
    ? last_message.sender_id === currentUserId
      ? `You: ${last_message.content ?? "Sent an image"}`
      : last_message.content ?? "Sent an image"
    : "No messages yet — tap to start"

  return (
    <li>
      <button
        onClick={onClick}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 active:bg-muted"
      >
        {/* Avatar: product image */}
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">
          {products?.image_url ? (
            <Image
              src={products.image_url}
              alt={products.name ?? "Product"}
              fill
              className="object-cover"
              sizes="48px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Text info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1">
              <span
                className={`truncate text-sm ${
                  hasUnread
                    ? "font-semibold text-foreground"
                    : "font-medium text-foreground"
                }`}
              >
                {is_buyer ? (vendors?.shop_name ?? "Unknown Shop") : "Buyer"}
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
            <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {products?.name ?? "Product enquiry"}
          </p>
          <p
            className={`mt-0.5 truncate text-xs ${
              hasUnread ? "font-medium text-foreground" : "text-muted-foreground"
            }`}
          >
            {previewText}
          </p>
        </div>

        {/* Unread badge + chevron */}
        <div className="flex shrink-0 items-center gap-1.5">
          {hasUnread && (
            <Badge className="h-5 min-w-5 rounded-full px-1.5 text-[10px] font-bold">
              {unread_count > 99 ? "99+" : unread_count}
            </Badge>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </button>
    </li>
  )
}

function ConversationsSkeleton() {
  return (
    <ul className="divide-y divide-border" aria-label="Loading conversations">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="h-12 w-12 animate-pulse rounded-xl bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
            <div className="h-3 w-48 animate-pulse rounded bg-muted" />
            <div className="h-3 w-40 animate-pulse rounded bg-muted" />
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
