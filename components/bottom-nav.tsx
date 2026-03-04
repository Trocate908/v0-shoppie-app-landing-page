"use client"

import { Home, Store, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

export type NavTab = "store" | "home" | "settings"

interface BottomNavProps {
  activeTab: NavTab
  onTabChange: (tab: NavTab) => void
}

const tabs = [
  { id: "home" as NavTab, label: "Home", icon: Home },
  { id: "store" as NavTab, label: "Store", icon: Store },
  { id: "settings" as NavTab, label: "Settings", icon: Settings },
]

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon
                className={cn("h-5 w-5 transition-all", isActive && "scale-110")}
                strokeWidth={isActive ? 2.5 : 1.75}
              />
              <span className={cn("text-[11px] font-medium tracking-wide", isActive ? "text-primary" : "text-muted-foreground")}>
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 h-0.5 w-8 rounded-t-full bg-primary" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
