"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import BottomNav, { type NavTab } from "@/components/bottom-nav"
import BrowseProductsClient from "@/components/browse-products-client"
import { createBrowserClient } from "@/lib/supabase/client"
import { useNotifications } from "@/hooks/use-notifications"
import { usePresence } from "@/hooks/use-presence"
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
    profile_picture_url?: string | null
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
  const [selfId, setSelfId] = useState<string | null>(null)
  const selfIdRef = useRef<string | null>(null)
  const unreadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { notify } = useNotifications()
  const { toast } = useToast()

  // Presence is tracked for the whole app, not only while the messages tab is
  // mounted — otherwise a vendor browsing their shop reads as "offline" to the
  // buyer waiting on a reply. The hook is a module-level singleton, so the
  // messages tab joining in costs nothing extra.
  usePresence(selfId)

  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  useEffect(() => {
    // Locally cached session: no auth round trip before the first paint just to
    // learn our own user id.
    getSupabaseClient()
      .auth.getSession()
      .then(({ data }) => setSelfId(data.session?.user?.id ?? null))
      .catch(() => setSelfId(null))
  }, [])

  useEffect(() => {
    selfIdRef.current = selfId
  }, [selfId])

  const fetchUnreadCount = useCallback(async () => {
    try {
      // Counts-only endpoint: the badge no longer downloads the whole inbox.
      const res = await fetch("/api/messages/unread-count")
      if (!res.ok) {
        setUnreadReady(true)
        return
      }
      const data: { total?: number; byConversation?: Record<string, number> } =
        await res.json()
      const openId = openConversationIdRef.current
      const openCount = openId ? (data.byConversation?.[openId] ?? 0) : 0
      setUnreadCount(Math.max((data.total ?? 0) - openCount, 0))
    } catch {
    } finally {
      setUnreadReady(true)
    }
  }, [])

  // Coalesce bursts (a chatty thread can emit several inserts a second) into a
  // single count refresh.
  const scheduleUnreadRefresh = useCallback(() => {
    if (unreadTimerRef.current) clearTimeout(unreadTimerRef.current)
    unreadTimerRef.current = setTimeout(() => {
      unreadTimerRef.current = null
      void fetchUnreadCount()
    }, 400)
  }, [fetchUnreadCount])

  useEffect(() => () => {
    if (unreadTimerRef.current) clearTimeout(unreadTimerRef.current)
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
    void fetchUnreadCount()
  }

  useEffect(() => {
    void fetchUnreadCount()

    const supabase = getSupabaseClient()
    const channel = supabase
      .channel("app_shell_unread")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as { sender_id?: string; content?: string; conversation_id?: string }
          const isOwnMessage = msg.sender_id === selfIdRef.current
          const isOpenConversation = msg.conversation_id === openConversationIdRef.current

          if (!isOwnMessage && !isOpenConversation) {
            scheduleUnreadRefresh()
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

            const notifBody = msg.content?.trim() || "Sent an image"

            notify({
              title: "New message",
              body: notifBody,
              tag: `msg-${msg.conversation_id}`,
              onClick: openInApp,
            })

            if (typeof document !== "undefined" && !document.hidden) {
              toast({
                title: "New message",
                description: notifBody,
              })
            }
          }
        }
      )
      // No UPDATE subscription: read receipts on our own sent messages used to
      // re-run the inbox query on every tick. Unread count only changes on
      // inserts from the other side.
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchUnreadCount, notify, toast, scheduleUnreadRefresh])

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
