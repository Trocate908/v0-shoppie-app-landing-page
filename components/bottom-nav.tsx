"use client"

import { Home, Store, Settings, MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"

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
]

export default function BottomNav({ activeTab, onTabChange, unreadMessages }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      aria-label="Main navigation"
    >
      <div className="flex h-16 w-full items-stretch">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const showBadge = tab.id === "messages" && (unreadMessages ?? 0) > 0
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              aria-label={tab.label + (showBadge ? ` (${unreadMessages} unread)` : "")}
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
                    {unreadMessages > 99 ? "99+" : unreadMessages}
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
