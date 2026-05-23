"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import BottomNav, { type NavTab } from "@/components/bottom-nav"
import BrowseProductsClient from "@/components/browse-products-client"
import SettingsTab from "@/components/settings-tab"
import HomeTab from "@/components/home-tab"
import MessagesTab from "@/components/messages-tab"
import { createBrowserClient } from "@/lib/supabase/client"
import { useNotifications } from "@/hooks/use-notifications"
import { useToast } from "@/hooks/use-toast"

interface Location {
  id: string
  country: string
  city: string
  market_name: string
}

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  category: string | null
  image_url: string | null
  image_urls: string[] | null
  in_stock: boolean
  vendor: {
    id: string
    shop_name: string
    is_open: boolean
    is_verified?: boolean
    verification_expires_at?: string | null
    whatsapp_number?: string | null
    location: Location
  }
}

interface AppShellProps {
  products: Product[]
  locations: Location[]
}

const VALID_TABS: NavTab[] = ["store", "home", "messages", "settings"]

// Single shared Supabase client — prevents multiple GoTrueClient instances
let sharedSupabaseClient: ReturnType<typeof createBrowserClient> | null = null
function getSupabaseClient() {
  if (!sharedSupabaseClient) {
    sharedSupabaseClient = createBrowserClient()
  }
  return sharedSupabaseClient
}

export default function AppShell({ products, locations }: AppShellProps) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const tabParam = searchParams.get("tab") as NavTab | null
  const cidParam = searchParams.get("cid")

  const resolvedTab: NavTab =
    tabParam && VALID_TABS.includes(tabParam) ? tabParam : "store"

  const [activeTab, setActiveTab] = useState<NavTab>(resolvedTab)
  const [openConversationId, setOpenConversationId] = useState<string | null>(cidParam)
  // Start at 0 (not null) so the badge is stable from the very first render.
  // The realtime subscription will update it once the fetch completes.
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [unreadReady, setUnreadReady] = useState(false)
  // Tracks which conversation is currently open so we never double-count it
  const openConversationIdRef = useRef<string | null>(null)
  const activeTabRef = useRef<NavTab>(resolvedTab)
  const currentUserIdRef = useRef<string | null>(null)
  const { notify } = useNotifications()
  const { toast } = useToast()

  // Keep refs in sync
  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  // Fetch current user id once — initialise immediately, don't wait for UI
  useEffect(() => {
    const supabase = getSupabaseClient()
    supabase.auth.getUser().then(({ data }) => {
      currentUserIdRef.current = data.user?.id ?? null
    })
  }, [])

  // Cache of conversations so realtime message INSERTs can resolve the
  // sender's display name without an extra round-trip.
  type CachedConv = {
    id: string
    is_buyer: boolean
    vendors: { shop_name: string } | null
  }
  const conversationsCacheRef = useRef<Map<string, CachedConv>>(new Map())

  // Fetch unread count from the conversations API
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/messages/conversations")
      if (!res.ok) {
        setUnreadReady(true)
        return
      }
      const data = await res.json()
      const conversations: (CachedConv & { unread_count: number })[] =
        data.conversations ?? []
      // Refresh the cache so incoming realtime messages can look up sender names
      conversationsCacheRef.current = new Map(
        conversations.map((c) => [c.id, { id: c.id, is_buyer: c.is_buyer, vendors: c.vendors }])
      )
      // Conversations that are currently open should not count toward the badge
      const total = conversations.reduce((sum, c) => {
        if (c.id === openConversationIdRef.current) return sum
        return sum + (c.unread_count ?? 0)
      }, 0)
      setUnreadCount(total)
    } catch {
      // Not logged in or network error — show 0, no badge
    } finally {
      setUnreadReady(true)
    }
  }, [])

  // Keep activeTab in sync when URL search params change (e.g. after message-seller redirect)
  useEffect(() => {
    const tab = searchParams.get("tab") as NavTab | null
    const cid = searchParams.get("cid")
    if (tab && VALID_TABS.includes(tab)) {
      setActiveTab(tab)
    }
    if (cid) {
      setOpenConversationId(cid)
    }
  }, [searchParams])

  // When the user manually switches tabs
  function handleTabChange(tab: NavTab) {
    setActiveTab(tab)
    if (tab !== "messages") {
      setOpenConversationId(null)
    }
    const url = new URL(window.location.href)
    url.searchParams.set("tab", tab)
    if (tab !== "messages") {
      url.searchParams.delete("cid")
    }
    router.replace(url.pathname + url.search, { scroll: false })
  }

  // Called by MessagesTab when a conversation is opened or closed
  function handleConversationChange(conversationId: string | null) {
    openConversationIdRef.current = conversationId
    // Re-compute unread without the now-open conversation
    fetchUnreadCount()
  }

  // Single realtime subscription for the whole app — no duplicate clients
  useEffect(() => {
    fetchUnreadCount()

    const supabase = getSupabaseClient()
    const channel = supabase
      .channel("app_shell_unread")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as { sender_id?: string; content?: string; conversation_id?: string }
          const isOwnMessage = msg.sender_id === currentUserIdRef.current
          const isOpenConversation = msg.conversation_id === openConversationIdRef.current

          // Only bump the unread count for messages from others in conversations not currently open
          if (!isOwnMessage && !isOpenConversation) {
            fetchUnreadCount()
          }

          // Notify when message is from someone else AND the user isn't
          // already viewing this exact conversation
          const shouldNotify =
            !isOwnMessage &&
            (activeTabRef.current !== "messages" || !isOpenConversation)

          if (shouldNotify) {
            const openInApp = () => {
              setActiveTab("messages")
              if (msg.conversation_id) {
                setOpenConversationId(msg.conversation_id)
              }
            }

            // Resolve the sender's display name from the cache so the
            // notification says "New message from Shop Name" rather than a
            // generic label. If the conversation isn't cached yet, fall back
            // to "Someone".
            const convo = msg.conversation_id
              ? conversationsCacheRef.current.get(msg.conversation_id)
              : undefined
            const senderLabel = convo
              ? convo.is_buyer
                ? convo.vendors?.shop_name ?? "Vendor"
                : "Customer"
              : "Someone"
            const notifTitle = `New message from ${senderLabel}`
            const notifBody = msg.content?.trim() || "Sent an image"

            // Browser notification (shown when tab is hidden)
            // Hook also forwards "title|body" to window.AppInventor for native
            // wrappers — see hooks/use-notifications.ts.
            notify({
              title: notifTitle,
              body: notifBody,
              tag: `msg-${msg.conversation_id}`,
              onClick: openInApp,
            })

            // In-app toast (shown while app is visible)
            if (typeof document !== "undefined" && !document.hidden) {
              toast({
                title: notifTitle,
                description: notifBody,
              })
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as { read?: boolean }
          // When a message is marked read, recompute the badge
          if (msg.read === true) {
            fetchUnreadCount()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchUnreadCount, notify, toast])

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Tab Content */}
      <div className="flex-1 pb-20">
        {activeTab === "store" && (
          <BrowseProductsClient
            products={products}
            locations={locations}
            visitorCountry={null}
          />
        )}
        {activeTab === "home" && <HomeTab onNavigate={setActiveTab} />}
        {activeTab === "messages" && (
          <MessagesTab
            initialConversationId={openConversationId}
            onConversationChange={handleConversationChange}
          />
        )}
        {activeTab === "settings" && <SettingsTab />}
      </div>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        unreadMessages={unreadReady ? unreadCount : 0}
      />
    </div>
  )
}
