"use client"

import { useRouter } from "next/navigation"
import { Home, Store, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { id: "home", label: "Home", icon: Home, href: "/" },
  { id: "store", label: "Store", icon: Store, href: "/browse" },
  { id: "settings", label: "Settings", icon: Settings, href: "/?tab=settings" },
]

export default function BrowseNavBar() {
  const router = useRouter()
  const activeTab = "store"

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
              <Icon
                className={cn("h-5 w-5 transition-all", isActive && "scale-110")}
                strokeWidth={isActive ? 2.5 : 1.75}
              />
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
