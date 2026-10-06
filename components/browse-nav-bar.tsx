"use client"

import { useRouter } from "next/navigation"
import { Home, Store, Settings, MessageCircle, ShoppingCart } from "lucide-react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useCart } from "@/components/cart-provider"

const tabs = [
  { id: "home",     label: "Home",     icon: Home,          href: "/" },
  { id: "store",    label: "Store",    icon: Store,         href: "/browse" },
  { id: "messages", label: "Messages", icon: MessageCircle, href: "/?tab=messages" },
  { id: "cart",     label: "Cart",     icon: ShoppingCart,  href: "/cart" },
  { id: "settings", label: "Settings", icon: Settings,      href: "/?tab=settings" },
]

export default function BrowseNavBar() {
  const router = useRouter()
  const pathname = usePathname()
  const { count } = useCart()
  const activeTab = pathname === "/cart" ? "cart" : "store"

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      aria-label="Main navigation"
    >
      <div className="flex h-16 w-full items-stretch">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => router.push(tab.href)}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-b-full bg-primary" />
              )}
              <span className="relative">
                <Icon
                  className={cn("h-5 w-5 transition-all", isActive && "scale-110")}
                  strokeWidth={isActive ? 2.5 : 1.75}
                />
                {tab.id === "cart" && count > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </span>
              <span className={cn("text-[11px] font-medium tracking-wide", isActive ? "text-primary" : "text-muted-foreground")}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
