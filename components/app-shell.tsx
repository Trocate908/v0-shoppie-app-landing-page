"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import BottomNav, { type NavTab } from "@/components/bottom-nav"
import BrowseProductsClient from "@/components/browse-products-client"
import { createBrowserClient } from "@/lib/supabase/client"
import { useNotifications } from "@/hooks/use-notifications"
import { useToast } from "@/hooks/use-toast"

const HomeTab = dynamic(() => import("@/components/home-tab"), { ssr: false })
const MessagesTab = dynamic(() => import("@/components/messages-tab"), { ssr: false })
const SettingsTab = dynamic(() => import("@/components/settings-tab"), { ssr: false })

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
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [unreadReady, setUnreadReady] = useState(false)
  // Track which tabs have been visited so we keep them mounted after first load
  const [mountedTabs, setMountedTabs] = useState<Set<NavTab>>(new Set([resolvedTab]))

  const openConversationIdRef = useRef<string | null>(null)
  const activeTabRef = useRef<NavTab>(resolvedTab)
  const currentUserIdRef = useRef<string | null>(null)
  const { notify } = useNotifications()
  const { toast } = useToast()

  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  useEffect(() => {
    const supabase = getSupabaseClient()
    supabase.auth.getUser().then(({ data }) => {
      currentUserIdRef.current = data.user?.id ?? null
    })
  }, [])

  type CachedConv = {
    id: string
    is_buyer: boolean
    vendors: { shop_name: string } | null
  }
  const conversationsCacheRef = useRef<Map<string, CachedConv>>(new Map())

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
      conversationsCacheRef.current = new Map(
        conversations.map((c) => [c.id, { id: c.id, is_buyer: c.is_buyer, vendors: c.vendors }])
      )
      const total = conversations.reduce((sum, c) => {
        if (c.id === openConversationIdRef.current) return sum
        return sum + (c.unread_count ?? 0)
      }, 0)
      setUnreadCount(total)
    } catch {
    } finally {
      setUnreadReady(true)
    }
  }, [])

  useEffect(() => {
    const tab = searchParams.get("tab") as NavTab | null
    const cid = searchParams.get("cid")
    if (tab && VALID_TABS.includes(tab)) {
      setActiveTab(tab)
      setMountedTabs((prev) => new Set([...prev, tab]))
    }
    if (cid) {
      setOpenConversationId(cid)
    }
  }, [searchParams])

  function handleTabChange(tab: NavTab) {
    setActiveTab(tab)
    setMountedTabs((prev) => new Set([...prev, tab]))
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

  function handleConversationChange(conversationId: string | null) {
    openConversationIdRef.current = conversationId
    fetchUnreadCount()
  }

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

          if (!isOwnMessage && !isOpenConversation) {
            fetchUnreadCount()
          }

          const shouldNotify =
            !isOwnMessage &&
            (activeTabRef.current !== "messages" || !isOpenConversation)

          if (shouldNotify) {
            const openInApp = () => {
              setActiveTab("messages")
              setMountedTabs((prev) => new Set([...prev, "messages"]))
              if (msg.conversation_id) {
                setOpenConversationId(msg.conversation_id)
              }
            }

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

            notify({
              title: notifTitle,
              body: notifBody,
              tag: `msg-${msg.conversation_id}`,
              onClick: openInApp,
            })

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
      <div className="flex-1 pb-20">
        {/* Store tab — always mounted, hidden when inactive */}
        <div className={activeTab === "store" ? "" : "hidden"}>
          <BrowseProductsClient
            products={products}
            locations={locations}
            visitorCountry={null}
          />
        </div>

        {/* Other tabs — lazy-loaded on first visit, then kept mounted */}
        {mountedTabs.has("home") && (
          <div className={activeTab === "home" ? "" : "hidden"}>
            <HomeTab onNavigate={setActiveTab} />
          </div>
        )}
        {mountedTabs.has("messages") && (
          <div className={activeTab === "messages" ? "" : "hidden"}>
            <MessagesTab
              initialConversationId={openConversationId}
              onConversationChange={handleConversationChange}
            />
          </div>
        )}
        {mountedTabs.has("settings") && (
          <div className={activeTab === "settings" ? "" : "hidden"}>
            <SettingsTab />
          </div>
        )}
      </div>

      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        unreadMessages={unreadReady ? unreadCount : 0}
      />
    </div>
  )
}
