"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import BottomNav, { type NavTab } from "@/components/bottom-nav"
import BrowseProductsClient from "@/components/browse-products-client"
import SettingsTab from "@/components/settings-tab"
import HomeTab from "@/components/home-tab"
import MessagesTab from "@/components/messages-tab"
import { createBrowserClient } from "@/lib/supabase/client"

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

export default function AppShell({ products, locations }: AppShellProps) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const tabParam = searchParams.get("tab") as NavTab | null
  const cidParam = searchParams.get("cid")

  const resolvedTab: NavTab =
    tabParam && VALID_TABS.includes(tabParam) ? tabParam : "store"

  const [activeTab, setActiveTab] = useState<NavTab>(resolvedTab)
  const [openConversationId, setOpenConversationId] = useState<string | null>(cidParam)
  const [unreadCount, setUnreadCount] = useState(0)

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

  // When the user manually switches tabs, clear the conversation deep-link
  function handleTabChange(tab: NavTab) {
    setActiveTab(tab)
    if (tab !== "messages") {
      setOpenConversationId(null)
    }
    // Update URL without full navigation
    const url = new URL(window.location.href)
    url.searchParams.set("tab", tab)
    if (tab !== "messages") {
      url.searchParams.delete("cid")
    }
    router.replace(url.pathname + url.search, { scroll: false })
  }

  // Unread message count — single Supabase query using the conversations API
  useEffect(() => {
    let cancelled = false

    async function fetchUnreadCount() {
      try {
        const res = await fetch("/api/messages/conversations")
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        const total = (data.conversations ?? []).reduce(
          (sum: number, c: { unread_count: number }) => sum + (c.unread_count ?? 0),
          0
        )
        setUnreadCount(total)
      } catch {
        // Not logged in or network error — no badge
      }
    }

    fetchUnreadCount()

    // Realtime subscription for new/updated messages
    const supabase = createBrowserClient()
    const channel = supabase
      .channel("app_shell_unread")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          fetchUnreadCount()
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  // When messages tab is active and a conversation is opened, decrement unread visually
  function handleConversationOpen() {
    // The actual unread refresh happens via realtime — just trigger a refetch
    fetch("/api/messages/conversations")
      .then((r) => r.json())
      .then((data) => {
        const total = (data.conversations ?? []).reduce(
          (sum: number, c: { unread_count: number }) => sum + (c.unread_count ?? 0),
          0
        )
        setUnreadCount(total)
      })
      .catch(() => {})
  }

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
            onConversationOpen={handleConversationOpen}
          />
        )}
        {activeTab === "settings" && <SettingsTab />}
      </div>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        unreadMessages={unreadCount}
      />
    </div>
  )
}
