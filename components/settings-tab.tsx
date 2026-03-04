"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun, Monitor, LogOut, Info, FileText, Phone, MapPin, Heart, ChevronRight, Store } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { createBrowserClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function SettingsTab() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [vendorName, setVendorName] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    setMounted(true)
    const supabase = createBrowserClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setIsLoggedIn(true)
        // Try to get vendor name
        supabase
          .from("vendors")
          .select("shop_name")
          .eq("user_id", user.id)
          .single()
          .then(({ data }) => {
            if (data) setVendorName(data.shop_name)
          })
      }
    })
  }, [])

  const isDark = resolvedTheme === "dark"

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const supabase = createBrowserClient()
      await supabase.auth.signOut()
      setIsLoggedIn(false)
      setVendorName(null)
      toast({ title: "Signed out", description: "You have been logged out successfully." })
    } catch {
      toast({ title: "Error", description: "Failed to sign out.", variant: "destructive" })
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-4">
          <Image src="/logo.png" alt="ShoppieApp" width={28} height={28} className="h-7 w-7" />
          <h1 className="text-lg font-semibold text-foreground">Settings</h1>
        </div>
      </header>

      <div className="flex-1 space-y-1 px-4 py-4">
        {/* Account Section */}
        {isLoggedIn ? (
          <section className="mb-2">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Account</p>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Store className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-foreground">{vendorName ?? "Vendor"}</p>
                  <p className="text-xs text-muted-foreground">Vendor account</p>
                </div>
              </div>
              <div className="border-t border-border">
                <button
                  onClick={() => router.push("/vendor/dashboard")}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-muted/50 transition-colors"
                >
                  <span>Go to Dashboard</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div className="border-t border-border">
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm text-destructive hover:bg-destructive/5 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <LogOut className="h-4 w-4" />
                    {isLoggingOut ? "Signing out..." : "Sign Out"}
                  </span>
                  <ChevronRight className="h-4 w-4 opacity-40" />
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="mb-2">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Account</p>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <button
                onClick={() => router.push("/vendor/login")}
                className="flex w-full items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-muted/50 transition-colors"
              >
                <span>Vendor Login</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className="border-t border-border">
                <button
                  onClick={() => router.push("/vendor/signup")}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-muted/50 transition-colors"
                >
                  <span>Register as Vendor</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Appearance */}
        <section className="mb-2">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Appearance</p>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                {mounted && isDark ? (
                  <Moon className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Sun className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm text-foreground">Dark Mode</span>
              </div>
              {mounted && (
                <Switch
                  checked={isDark}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                  aria-label="Toggle dark mode"
                />
              )}
            </div>
            <div className="border-t border-border">
              <button
                onClick={() => setTheme("system")}
                className={cn(
                  "flex w-full items-center justify-between px-4 py-3 text-sm transition-colors",
                  theme === "system" ? "text-primary" : "text-foreground hover:bg-muted/50",
                )}
              >
                <span className="flex items-center gap-3">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  Use System Theme
                </span>
                {theme === "system" && <span className="text-xs text-primary font-medium">Active</span>}
              </button>
            </div>
          </div>
        </section>

        {/* Quick Links */}
        <section className="mb-2">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Explore</p>
          <div className="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
            <Link href="/wishlist" className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
              <span className="flex items-center gap-3 text-sm text-foreground">
                <Heart className="h-4 w-4 text-muted-foreground" />
                Wishlist
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link href="/locations" className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
              <span className="flex items-center gap-3 text-sm text-foreground">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Browse by Location
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </section>

        {/* Info Links */}
        <section className="mb-2">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">About</p>
          <div className="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
            <Link href="/about" className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
              <span className="flex items-center gap-3 text-sm text-foreground">
                <Info className="h-4 w-4 text-muted-foreground" />
                About ShoppieApp
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link href="/contact" className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
              <span className="flex items-center gap-3 text-sm text-foreground">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Contact Us
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link href="/terms" className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
              <span className="flex items-center gap-3 text-sm text-foreground">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Terms & Conditions
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </section>

        {/* Footer note */}
        <p className="px-1 pt-4 text-center text-xs text-muted-foreground">
          ShoppieApp &copy; {new Date().getFullYear()} &mdash; Connecting local vendors
        </p>
      </div>
    </div>
  )
}
