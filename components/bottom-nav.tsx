"use client"

import { Home, Store, Settings, MessageCircle, ShoppingCart } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useCart } from "@/components/cart-provider"

export type NavTab = "store" | "home" | "messages" | "settings"

interface BottomNavProps {
  activeTab: NavTab
  onTabChange: (tab: NavTab) => void
  unreadMessages?: number
}

const tabs = [
  { id: "home" as NavTab, label: "Home", icon: Home },
  { id: "store" as NavTab, label: "Store", icon: Store },
  { id: "messages" as NavTab, label: "Messages", icon: MessageCircle },
  { id: "settings" as NavTab, label: "Settings", icon: Settings },
] as const

const cartTab = { id: "cart" as const, label: "Cart", icon: ShoppingCart }

/** Home, Store, Messages, Cart, Settings — cart sits between Messages and Settings. */
const navItems = [tabs[0], tabs[1], tabs[2], cartTab, tabs[3]]

export default function BottomNav({ activeTab, onTabChange, unreadMessages }: BottomNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { count } = useCart()
  const unread = unreadMessages ?? 0
  const cartIsActive = pathname === "/cart"

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      aria-label="Main navigation"
    >
      <div className="flex h-16 w-full items-stretch">
        {navItems.map((tab) => {
          const Icon = tab.icon
          const isCart = tab.id === "cart"
          const isActive = isCart ? cartIsActive : activeTab === tab.id
          const showBadge = isCart ? count > 0 : tab.id === "messages" && unread > 0
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (isCart) router.push("/cart")
                else onTabChange(tab.id as NavTab)
              }}
              aria-label={
                tab.label +
                (isCart && count > 0
                  ? `, ${count} item${count === 1 ? "" : "s"}`
                  : showBadge ? ` (${unread} unread)` : "")
              }
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
                {showBadge && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
                    {isCart ? (count > 99 ? "99+" : count) : unread > 99 ? "99+" : unread}
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
