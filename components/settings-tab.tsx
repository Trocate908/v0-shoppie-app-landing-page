"use client"

import { useState, useEffect } from "react"
import { useTheme } from "@/components/theme-provider"
import {
  Moon, Sun, LogOut, Info, FileText, Phone, MapPin, Heart,
  ChevronRight, Store, Plus, RefreshCw, Check, Trash2, Wrench,
  Bug, Palette, ShieldCheck, Bell, Package,
} from "lucide-react"
import { isDevModeEnabled, setDevModeEnabled, subscribeToDevMode } from "@/lib/dev-mode"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { createBrowserClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"
import { getSavedAccounts, removeAccount, setActiveAccountId, type SavedAccount } from "@/lib/account-switcher"

// Row item used in grouped menu lists
function MenuItem({
  icon,
  iconBg,
  label,
  sublabel,
  href,
  onClick,
  right,
  danger,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  sublabel?: string
  href?: string
  onClick?: () => void
  right?: React.ReactNode
  danger?: boolean
}) {
  const inner = (
    <div
      className={[
        "flex w-full items-center gap-3 px-4 py-3.5 transition-colors",
        danger ? "hover:bg-destructive/5" : "hover:bg-muted/50",
        (href || onClick) ? "cursor-pointer" : "",
      ].join(" ")}
      onClick={onClick}
    >
      <span className={["flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", iconBg].join(" ")}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={["text-sm font-medium", danger ? "text-destructive" : "text-foreground"].join(" ")}>
          {label}
        </p>
        {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
      </div>
      {right ?? (
        href || onClick ? (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
        ) : null
      )}
    </div>
  )

  if (href) return <Link href={href} className="block">{inner}</Link>
  return inner
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  )
}

function MenuGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border shadow-sm">
      {children}
    </div>
  )
}

export default function SettingsTab() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [vendorName, setVendorName] = useState<string | null>(null)
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([])
  const [switchingTo, setSwitchingTo] = useState<string | null>(null)
  const [devMode, setDevMode] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    setMounted(true)
    setSavedAccounts(getSavedAccounts())
    setDevMode(isDevModeEnabled())
    const unsubDev = subscribeToDevMode(setDevMode)
    const supabase = createBrowserClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setIsLoggedIn(true)
        setCurrentUserId(user.id)
        supabase
          .from("vendors")
          .select("shop_name, profile_picture_url")
          .eq("user_id", user.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setVendorName(data.shop_name)
              setProfilePictureUrl(data.profile_picture_url || null)
            }
          })
      }
    })
    return () => { unsubDev() }
  }, [])

  const isDark = theme === "dark"

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const supabase = createBrowserClient()
      await supabase.auth.signOut()
      setIsLoggedIn(false)
      setVendorName(null)
      setCurrentUserId(null)
      toast({ title: "Signed out", description: "You have been logged out successfully." })
    } catch {
      toast({ title: "Error", description: "Failed to sign out.", variant: "destructive" })
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleSwitchAccount = async (account: SavedAccount) => {
    if (account.userId === currentUserId) return
    setSwitchingTo(account.userId)
    const supabase = createBrowserClient()
    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: account.accessToken,
        refresh_token: account.refreshToken,
      })
      if (error) {
        toast({ title: "Session expired", description: `Please log back into ${account.shopName}.`, variant: "destructive" })
        return
      }
      if (data.user) {
        setActiveAccountId(data.user.id)
        toast({ title: "Switched account", description: `Now logged in as ${account.shopName}` })
        await new Promise((r) => setTimeout(r, 300))
        window.location.href = "/vendor/dashboard"
      }
    } catch {
      toast({ title: "Switch failed", description: "Could not switch account. Please log in again.", variant: "destructive" })
    } finally {
      setSwitchingTo(null)
    }
  }

  const handleRemoveAccount = (userId: string) => {
    removeAccount(userId)
    setSavedAccounts(getSavedAccounts())
    toast({ title: "Account removed" })
  }

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-4">
          <Image src="/logo.png" alt="ShoppieApp" width={28} height={28} className="h-7 w-7 rounded-lg" />
          <h1 className="text-lg font-bold text-foreground">Settings</h1>
        </div>
      </header>

      <div className="flex-1 space-y-5 px-4 py-5">

        {/* ── Vendor profile card (logged in) ── */}
        {isLoggedIn && (
          <div
            className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 px-4 py-4 cursor-pointer"
            onClick={() => router.push("/vendor/dashboard")}
          >
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border-2 border-primary/20 bg-muted shadow-sm">
              {profilePictureUrl ? (
                <Image src={profilePictureUrl} alt={vendorName ?? "Shop"} fill className="object-cover" sizes="56px" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary/10">
                  <Store className="h-6 w-6 text-primary" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground truncate">{vendorName ?? "Your Shop"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Tap to open Dashboard</p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <ChevronRight className="h-4 w-4 text-primary" />
            </div>
          </div>
        )}

        {/* ── Accounts section ── */}
        <section>
          <SectionLabel>Accounts</SectionLabel>
          <MenuGroup>
            {isLoggedIn ? (
              <>
                {savedAccounts.length > 0 ? (
                  savedAccounts.map((account) => {
                    const isActive = account.userId === currentUserId
                    const isSwitching = switchingTo === account.userId
                    return (
                      <button
                        key={account.userId}
                        onClick={() => handleSwitchAccount(account)}
                        disabled={isSwitching || isActive}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 disabled:cursor-default"
                      >
                        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                          {account.profilePictureUrl ? (
                            <Image src={account.profilePictureUrl} alt={account.shopName} fill className="object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Store className="h-4 w-4 text-primary" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{account.shopName}</p>
                          <p className="truncate text-xs text-muted-foreground">{account.email}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {isActive && (
                            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                              <Check className="h-3 w-3" /> Active
                            </span>
                          )}
                          {isSwitching && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
                          {!isActive && !isSwitching && <ChevronRight className="h-4 w-4 text-muted-foreground/60" />}
                          {!isActive && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveAccount(account.userId) }}
                              className="rounded-lg p-1 text-muted-foreground hover:text-destructive transition-colors"
                              aria-label="Remove account"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </button>
                    )
                  })
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted">
                      <Store className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{vendorName ?? "Your account"}</p>
                      <p className="truncate text-xs text-muted-foreground">Currently signed in</p>
                    </div>
                    <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      <Check className="h-3 w-3" /> Active
                    </span>
                  </div>
                )}

                {/* Add account */}
                <button
                  type="button"
                  onClick={() => { window.location.href = "/vendor/login?add_account=1" }}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-sm transition-colors hover:bg-muted/50 cursor-pointer"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground">
                    <Plus className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-muted-foreground">Add another account</span>
                </button>

                {/* Sign out */}
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-sm transition-colors hover:bg-destructive/5 cursor-pointer"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
                    <LogOut className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </span>
                  <span className="font-medium text-destructive flex-1 text-left">
                    {isLoggingOut ? "Signing out…" : "Sign Out"}
                  </span>
                </button>
              </>
            ) : (
              <>
                <MenuItem
                  icon={<Store className="h-4 w-4 text-white" />}
                  iconBg="bg-primary"
                  label="Vendor Login"
                  onClick={() => router.push("/vendor/login")}
                />
                <MenuItem
                  icon={<Plus className="h-4 w-4 text-white" />}
                  iconBg="bg-emerald-500"
                  label="Register as Vendor"
                  sublabel="Start selling on ShoppieApp"
                  onClick={() => router.push("/vendor/signup")}
                />
              </>
            )}
          </MenuGroup>
        </section>

        {/* ── Appearance ── */}
        <section>
          <SectionLabel>Appearance</SectionLabel>
          <MenuGroup>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className={["flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", isDark ? "bg-slate-700" : "bg-amber-100"].join(" ")}>
                {mounted && isDark
                  ? <Moon className="h-4 w-4 text-slate-200" />
                  : <Sun className="h-4 w-4 text-amber-500" />}
              </span>
              <span className="flex-1 text-sm font-medium text-foreground">Dark Mode</span>
              {mounted && (
                <Switch
                  checked={isDark}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                  aria-label="Toggle dark mode"
                />
              )}
            </div>
          </MenuGroup>
        </section>

        {/* ── Explore ── */}
        <section>
          <SectionLabel>Explore</SectionLabel>
          <MenuGroup>
            <MenuItem
              icon={<Heart className="h-4 w-4 text-white" />}
              iconBg="bg-rose-500"
              label="Wishlist"
              sublabel="Your saved products"
              href="/wishlist"
            />
            <MenuItem
              icon={<MapPin className="h-4 w-4 text-white" />}
              iconBg="bg-sky-500"
              label="Browse by Location"
              sublabel="Find shops near you"
              href="/locations"
            />
            <MenuItem
              icon={<Package className="h-4 w-4 text-white" />}
              iconBg="bg-violet-500"
              label="All Products"
              sublabel="Browse the marketplace"
              href="/"
            />
          </MenuGroup>
        </section>

        {/* ── About ── */}
        <section>
          <SectionLabel>About</SectionLabel>
          <MenuGroup>
            <MenuItem
              icon={<Info className="h-4 w-4 text-white" />}
              iconBg="bg-blue-500"
              label="About ShoppieApp"
              sublabel="Learn more about us"
              href="/about"
            />
            <MenuItem
              icon={<Phone className="h-4 w-4 text-white" />}
              iconBg="bg-green-500"
              label="Contact Us"
              sublabel="Get in touch"
              href="/contact"
            />
            <MenuItem
              icon={<FileText className="h-4 w-4 text-white" />}
              iconBg="bg-orange-400"
              label="Terms & Conditions"
              href="/terms"
            />
          </MenuGroup>
        </section>

        {/* ── Developer Options ── */}
        <section>
          <SectionLabel>Developer</SectionLabel>
          <MenuGroup>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-500">
                <Wrench className="h-4 w-4 text-white" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Developer Options</p>
                <p className="text-xs text-muted-foreground">Unlocks diagnostics</p>
              </div>
              {mounted && (
                <Switch
                  checked={devMode}
                  onCheckedChange={(checked) => {
                    setDevModeEnabled(checked)
                    setDevMode(checked)
                  }}
                  aria-label="Toggle developer options"
                />
              )}
            </div>
            {devMode && (
              <MenuItem
                icon={<Bug className="h-4 w-4 text-white" />}
                iconBg="bg-red-500"
                label="Notification Diagnostics"
                href="/notifications/debug"
              />
            )}
          </MenuGroup>
        </section>

        {/* Footer */}
        <div className="flex flex-col items-center gap-1 pt-2 pb-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="ShoppieApp" width={20} height={20} className="h-5 w-5 opacity-60" />
            <p className="text-xs text-muted-foreground font-medium">ShoppieApp</p>
          </div>
          <p className="text-[11px] text-muted-foreground/60">
            &copy; {new Date().getFullYear()} · Connecting local vendors in Zimbabwe
          </p>
        </div>
      </div>
    </div>
  )
}
