"use client"

import { useState } from "react"
import BottomNav, { type NavTab } from "@/components/bottom-nav"
import BrowseProductsClient from "@/components/browse-products-client"
import SettingsTab from "@/components/settings-tab"
import HomeTab from "@/components/home-tab"

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
  // Default to "store" so products show first, like Shein
  const [activeTab, setActiveTab] = useState<NavTab>("store")

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <img src="/logo.png" alt="ShoppieApp" className="h-7 w-7 rounded-md object-contain" />
          <span className="text-lg font-bold tracking-tight text-foreground">ShoppieApp</span>
        </div>
      </header>

      {/* Tab Content */}
      <div className="flex-1 pb-16">
        {activeTab === "store" && (
          <BrowseProductsClient products={products} locations={locations} visitorCountry={null} />
        )}
        {activeTab === "home" && <HomeTab onNavigate={setActiveTab} />}
        {activeTab === "settings" && <SettingsTab />}
      </div>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
