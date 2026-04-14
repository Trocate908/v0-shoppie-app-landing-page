"use client"

import { useState, useEffect, useCallback } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { MessageCircle, Store, Package, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { formatDistanceToNow } from "date-fns"
import ChatWindow from "@/components/chat-window"

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
  last_message_at: string
  created_at: string
  unread_count: number
  is_buyer: boolean
  products: ConversationProduct | null
  vendors: ConversationVendor | null
}

export default function MessagesTab() {
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
        return
      }
      const data = await res.json()
      setIsAuthenticated(true)
      setConversations(data.conversations ?? [])
    } catch {
      setIsAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    async function init() {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id ?? null)
      await fetchConversations()
    }
    init()
  }, [fetchConversations])

  // Realtime: refresh list on new messages
  useEffect(() => {
    if (!isAuthenticated) return
    const supabase = createBrowserClient()
    const channel = supabase
      .channel("conversations_list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => { fetchConversations() }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [isAuthenticated, fetchConversations])

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
                onClick={() => setActiveConversation(convo)}
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
  onClick,
}: {
  conversation: Conversation
  onClick: () => void
}) {
  const { products, vendors, unread_count, last_message_at, is_buyer } = conversation
  const hasUnread = unread_count > 0

  const timeAgo = last_message_at
    ? formatDistanceToNow(new Date(last_message_at), { addSuffix: true })
    : ""

  return (
    <li>
      <button
        onClick={onClick}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 active:bg-muted"
      >
        {/* Avatar: product image or shop icon */}
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
            <span className={`truncate text-sm ${hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
              {is_buyer ? vendors?.shop_name ?? "Unknown Shop" : "Buyer"}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo}</span>
          </div>
          <p className="truncate text-xs text-muted-foreground mt-0.5">
            {products?.name ?? "Product enquiry"}
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
          When you enquire about a product, your conversations will appear here.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => window.history.back()}>
        Browse products
      </Button>
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
        <h2 className="text-base font-semibold text-foreground">Sign in to message vendors</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create an account or sign in to start a conversation with any seller.
        </p>
      </div>
    </div>
  )
}
