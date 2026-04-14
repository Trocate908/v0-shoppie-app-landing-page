"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
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

export default function AppShell({ products, locations }: AppShellProps) {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab") as NavTab | null
  const validTabs: NavTab[] = ["store", "home", "messages", "settings"]
  const initialTab: NavTab =
    tabParam && validTabs.includes(tabParam) ? tabParam : "store"

  const [activeTab, setActiveTab] = useState<NavTab>(initialTab)
  const [unreadCount, setUnreadCount] = useState(0)

  // Fetch unread message count
  useEffect(() => {
    async function fetchUnreadCount() {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      const { data: conversations } = await supabase
        .from("conversations")
        .select("id")
        .or(`buyer_id.eq.${user.id},vendor_id.eq.${user.id}`)

      if (!conversations || conversations.length === 0) return

      const conversationIds = conversations.map((c) => c.id)
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", conversationIds)
        .eq("read", false)
        .eq("deleted", false)
        .neq("sender_id", user.id)

      setUnreadCount(count ?? 0)
    }

    fetchUnreadCount()

    // Subscribe to realtime updates
    const supabase = createBrowserClient()
    const channel = supabase
      .channel("unread_messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          fetchUnreadCount()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Tab Content */}
      <div className="flex-1 pb-20">
        {activeTab === "store" && (
          <BrowseProductsClient products={products} locations={locations} visitorCountry={null} />
        )}
        {activeTab === "home" && <HomeTab onNavigate={setActiveTab} />}
        {activeTab === "messages" && <MessagesTab />}
        {activeTab === "settings" && <SettingsTab />}
      </div>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} unreadMessages={unreadCount} />
    </div>
  )
}
