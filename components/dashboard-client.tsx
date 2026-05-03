"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import {
  Eye, Package, LogOut, Plus, Settings, Trash2, Moon, Sun, User,
  Radio, TrendingUp, TrendingDown, MessageCircle, Heart,
  ShoppingBag, ArrowUpRight, Minus, BarChart2, Flame, Store,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { EditProfileDialog } from "@/components/edit-profile-dialog"
import { useTheme } from "@/components/theme-provider"
import { ActivateVerificationDialog } from "@/components/activate-verification-dialog"
import { VerificationBadge } from "@/components/verification-badge"
import ShopShareButton from "@/components/shop-share-button"
import { AccountSwitcherSheet } from "@/components/account-switcher-sheet"
import { saveAccount, updateAccountTokens, setActiveAccountId } from "@/lib/account-switcher"
import StatusRow from "@/components/status-row"
import { NotificationBell } from "@/components/notification-bell"

type VendorData = {
  id: string
  shop_name: string
  shop_description?: string
  whatsapp_number?: string
  location_id: string
  is_open: boolean
  is_verified?: boolean
  verification_status?: string
  verification_expires_at?: string | null
  profile_picture_url?: string
  location: { name: string; city: string; country: string }
}

type DailyView = { date: string; count: number }

type Stats = {
  totalViews: number
  weeklyViews: number
  prevWeekViews: number
  productCount: number
  inStockCount: number
  conversationCount: number
  favoritesCount: number
  dailyViews: DailyView[]
  topProduct: { id: string; name: string; image_url: string | null; views: number } | null
}

type Props = { vendor: VendorData; stats: Stats; userId: string }

// ── Bar chart ─────────────────────────────────────────────────────────────────
function MiniBarChart({ data }: { data: DailyView[] }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  const W = 200; const H = 56
  const barW = Math.floor(W / data.length) - 3
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14" preserveAspectRatio="none">
        {data.map((d, i) => {
          const barH = Math.max((d.count / max) * (H - 4), d.count > 0 ? 5 : 2)
          const x = i * (barW + 3); const y = H - barH
          return (
            <rect key={d.date} x={x} y={y} width={barW} height={barH} rx="3"
              fill={i === data.length - 1 ? "hsl(var(--primary))" : "hsl(var(--primary)/0.3)"} />
          )
        })}
      </svg>
      <div className="flex justify-between mt-1.5">
        {data.map((d) => (
          <span key={d.date} className="text-[10px] text-muted-foreground">
            {days[new Date(d.date + "T12:00:00").getDay()]}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Trend ─────────────────────────────────────────────────────────────────────
function Trend({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0)
    return <span className="text-xs text-muted-foreground">No data yet</span>
  if (previous === 0)
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"><TrendingUp className="h-3 w-3" />New this week</span>
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0)
    return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Minus className="h-3 w-3" />Same as last week</span>
  if (pct > 0)
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"><TrendingUp className="h-3 w-3" />+{pct}% vs last week</span>
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-500"><TrendingDown className="h-3 w-3" />{pct}% vs last week</span>
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color, bg }: {
  label: string; value: string | number; sub: string
  icon: React.ElementType; color: string; bg: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg}`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div>
        <p className="text-2xl font-extrabold text-foreground leading-tight">{value}</p>
        <p className="text-xs font-semibold text-muted-foreground mt-0.5">{label}</p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  )
}

export function DashboardClient({ vendor, stats, userId }: Props) {
  const [isOpen, setIsOpen] = useState(vendor.is_open)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        saveAccount({ userId, email: session.user.email ?? "", shopName: vendor.shop_name, profilePictureUrl: vendor.profile_picture_url ?? null, refreshToken: session.refresh_token, accessToken: session.access_token })
        setActiveAccountId(userId)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session && session.user.id === userId) updateAccountTokens(userId, session.refresh_token, session.access_token)
    })
    return () => subscription.unsubscribe()
  }, [userId, vendor.shop_name, vendor.profile_picture_url])

  const handleToggleShop = async (checked: boolean) => {
    setIsUpdating(true)
    try {
      const { error } = await createBrowserClient().from("vendors").update({ is_open: checked }).eq("id", vendor.id)
      if (error) throw error
      setIsOpen(checked)
      toast({ title: checked ? "Shop is now Open" : "Shop is now Closed" })
    } catch { toast({ title: "Update failed", variant: "destructive" }) }
    finally { setIsUpdating(false) }
  }

  const handleLogout = async () => { await createBrowserClient().auth.signOut(); window.location.href = "/" }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch("/api/vendor/delete-account", { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      toast({ title: "Account deleted" })
      await createBrowserClient().auth.signOut()
      window.location.href = "/"
    } catch (e) {
      toast({ title: "Delete failed", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" })
      setIsDeleting(false)
    }
  }

  const daysUntilExpiry = vendor.is_verified && vendor.verification_expires_at
    ? Math.floor((new Date(vendor.verification_expires_at).getTime() - Date.now()) / 86400000) : null

  return (
    <div className="min-h-screen bg-muted/30 dark:bg-background flex flex-col">

      {/* ══════════════════════ TOP NAV BAR ══════════════════════ */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
          {/* Brand mark */}
          <div className="flex items-center gap-2 shrink-0 mr-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Store className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="hidden sm:block text-sm font-bold text-foreground">Vendor Hub</span>
          </div>

          <div className="h-5 w-px bg-border hidden sm:block" />

          {/* Shop identity */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
              {vendor.profile_picture_url
                ? <Image src={vendor.profile_picture_url} alt={vendor.shop_name} fill className="object-cover" />
                : <div className="flex h-full w-full items-center justify-center"><User className="h-3.5 w-3.5 text-muted-foreground" /></div>}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground truncate max-w-[120px] sm:max-w-[220px] lg:max-w-none">
                  {vendor.shop_name}
                </span>
                <VerificationBadge isVerified={vendor.is_verified || false} />
                <Badge
                  variant={isOpen ? "default" : "secondary"}
                  className={`text-[9px] h-4 px-1.5 py-0 shrink-0 ${isOpen ? "bg-emerald-500 text-white hover:bg-emerald-500" : ""}`}
                >
                  {isOpen ? "Open" : "Closed"}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground truncate hidden sm:block">
                {vendor.location.name}, {vendor.location.country}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 shrink-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={toggleTheme}>
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            <div className="shrink-0"><NotificationBell /></div>
            <div className="shrink-0"><AccountSwitcherSheet currentUserId={userId} /></div>
            <div className="shrink-0">
              <ShopShareButton shopName={vendor.shop_name} vendorId={vendor.id} location={`${vendor.location.name}, ${vendor.location.city}`} />
            </div>
            <div className="shrink-0">
              <ActivateVerificationDialog vendorId={vendor.id} shopName={vendor.shop_name} isVerified={vendor.is_verified || false} expiresAt={vendor.verification_expires_at || null} />
            </div>
            <div className="shrink-0"><EditProfileDialog vendor={vendor} /></div>
            <div className="h-5 w-px bg-border mx-1 hidden sm:block" />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="shrink-0 h-8 gap-1.5 text-xs text-muted-foreground">
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ══════════════════════ BODY ══════════════════════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT SIDEBAR (desktop only) ── */}
        <aside className="hidden lg:flex lg:w-64 xl:w-72 shrink-0 flex-col border-r border-border bg-card overflow-y-auto">
          <div className="flex flex-col gap-4 p-5 flex-1">

            {/* Profile block */}
            <div className="flex flex-col items-center text-center pt-4 pb-5 border-b border-border">
              <div className="relative h-20 w-20 overflow-hidden rounded-2xl border-2 border-border bg-muted shadow-sm mb-3">
                {vendor.profile_picture_url
                  ? <Image src={vendor.profile_picture_url} alt={vendor.shop_name} fill className="object-cover" />
                  : <div className="flex h-full w-full items-center justify-center"><User className="h-8 w-8 text-muted-foreground" /></div>}
              </div>
              <h2 className="text-base font-bold text-foreground leading-tight">{vendor.shop_name}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{vendor.location.name}, {vendor.location.country}</p>
              <div className="flex items-center gap-1.5 mt-2">
                <VerificationBadge isVerified={vendor.is_verified || false} />
                <Badge
                  variant={isOpen ? "default" : "secondary"}
                  className={`text-[10px] h-5 px-2 ${isOpen ? "bg-emerald-500 text-white hover:bg-emerald-500" : ""}`}
                >
                  {isOpen ? "Open" : "Closed"}
                </Badge>
              </div>
            </div>

            {/* Shop status toggle */}
            <div className="rounded-xl border border-border bg-muted/50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Shop Status</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground">{isOpen ? "Open for Business" : "Currently Closed"}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {isOpen ? "Customers can find you" : "Hidden from browse"}
                  </p>
                </div>
                <Switch checked={isOpen} onCheckedChange={handleToggleShop} disabled={isUpdating} />
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1">Quick Actions</p>
              <Link href="/vendor/products/add"
                className="flex items-center gap-3 rounded-xl bg-primary px-4 py-3 hover:bg-primary/90 transition-colors">
                <Plus className="h-4 w-4 text-primary-foreground shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-primary-foreground leading-none">Add Product</p>
                  <p className="text-[11px] text-primary-foreground/70 mt-0.5">List a new item</p>
                </div>
              </Link>
              <Link href="/vendor/products"
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/60 transition-colors">
                <Settings className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground leading-none">Manage Products</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{stats.productCount} listed</p>
                </div>
              </Link>
              <Link href="/browse"
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/60 transition-colors">
                <ShoppingBag className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground leading-none">Browse Store</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">See what's trending</p>
                </div>
              </Link>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Danger zone */}
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-xs font-semibold text-destructive mb-2">Danger Zone</p>
              <p className="text-[11px] text-muted-foreground mb-3">Permanently delete your account and all products.</p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="w-full" disabled={isDeleting}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    {isDeleting ? "Deleting…" : "Delete Account"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete your vendor account, all your products, and all associated data. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Yes, delete everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8 lg:py-7 space-y-5">

            {/* Verification warning */}
            {daysUntilExpiry !== null && daysUntilExpiry <= 7 && (
              <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                daysUntilExpiry <= 0
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                  : "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300"
              }`}>
                {daysUntilExpiry <= 0
                  ? "⚠️ Your verification badge has expired. Renew to keep displaying it."
                  : `⏳ Verification expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? "s" : ""}. Renew soon.`}
              </div>
            )}

            {/* Page title row */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">Dashboard</h2>
                <p className="text-sm text-muted-foreground">Welcome back — here's how your shop is doing.</p>
              </div>
            </div>

            {/* ── Views chart + shop status (mobile toggle) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Chart card */}
              <div className="sm:col-span-2 rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Views — Last 7 Days</p>
                    <p className="text-4xl font-extrabold text-foreground leading-tight mt-1">
                      {stats.weeklyViews.toLocaleString()}
                    </p>
                    <div className="mt-1.5">
                      <Trend current={stats.weeklyViews} previous={stats.prevWeekViews} />
                    </div>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                    <BarChart2 className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <MiniBarChart data={stats.dailyViews} />
              </div>

              {/* Mobile-only shop toggle (hidden lg — it's in sidebar there) */}
              <div className="lg:hidden rounded-2xl border border-border bg-card p-5 flex flex-col justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Shop Status</p>
                  <p className="text-2xl font-extrabold text-foreground mt-1">{isOpen ? "Open" : "Closed"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isOpen ? "Visible to customers" : "Hidden from customers"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch id="shop-status-mobile" checked={isOpen} onCheckedChange={handleToggleShop} disabled={isUpdating} />
                  <span className="text-sm font-medium text-foreground">
                    {isUpdating ? "Updating…" : isOpen ? "Open" : "Closed"}
                  </span>
                </div>
              </div>
            </div>

            {/* ── 4 Stat cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard label="Total Views"  value={stats.totalViews.toLocaleString()} sub="All time"              icon={Eye}           color="text-blue-500"    bg="bg-blue-500/10" />
              <StatCard label="Products"     value={stats.productCount}                sub={`${stats.inStockCount} in stock`} icon={Package}  color="text-violet-500"  bg="bg-violet-500/10" />
              <StatCard label="Messages"     value={stats.conversationCount}           sub="From customers"         icon={MessageCircle} color="text-emerald-500" bg="bg-emerald-500/10" />
              <StatCard label="Wishlisted"   value={stats.favoritesCount}              sub="Saved by shoppers"      icon={Heart}         color="text-rose-500"    bg="bg-rose-500/10" />
            </div>

            {/* ── Top product + Shop Updates (2-column on desktop) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top product */}
              {stats.topProduct ? (
                <Link href={`/product/${stats.topProduct.id}`} className="block">
                  <div className="h-full rounded-2xl border border-border bg-card p-5 hover:bg-muted/40 transition-colors">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Top Product</p>
                    <div className="flex items-center gap-4">
                      {stats.topProduct.image_url && (
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border">
                          <Image src={stats.topProduct.image_url} alt={stats.topProduct.name} fill className="object-cover" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 shrink-0">
                            <Flame className="h-3.5 w-3.5 text-amber-500" />
                          </div>
                          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Most Viewed</span>
                        </div>
                        <p className="text-base font-bold text-foreground truncate">{stats.topProduct.name}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{stats.topProduct.views.toLocaleString()} total views</p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-card/50 p-5 flex flex-col items-center justify-center text-center gap-2 min-h-[120px]">
                  <Package className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">No products yet</p>
                  <Link href="/vendor/products/add" className="text-xs text-primary hover:underline">Add your first product</Link>
                </div>
              )}

              {/* Shop Updates */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Radio className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Shop Updates</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">visible 24 h</span>
                </div>
                <StatusRow
                  currentVendorId={vendor.id}
                  currentVendorName={vendor.shop_name}
                  currentVendorIsVerified={vendor.is_verified ?? false}
                  currentVendorProfilePic={vendor.profile_picture_url ?? null}
                />
              </div>
            </div>

            {/* ── Mobile-only quick actions (hidden lg) ── */}
            <div className="lg:hidden grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link href="/vendor/products/add"
                className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 hover:bg-primary/10 transition-colors">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0"><Plus className="h-4 w-4" /></div>
                <div><p className="text-sm font-semibold text-foreground">Add Product</p><p className="text-xs text-muted-foreground">List a new item</p></div>
              </Link>
              <Link href="/vendor/products"
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:bg-muted/40 transition-colors">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted shrink-0"><Settings className="h-4 w-4 text-muted-foreground" /></div>
                <div><p className="text-sm font-semibold text-foreground">Manage Products</p><p className="text-xs text-muted-foreground">{stats.productCount} listed</p></div>
              </Link>
              <Link href="/browse"
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:bg-muted/40 transition-colors">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted shrink-0"><ShoppingBag className="h-4 w-4 text-muted-foreground" /></div>
                <div><p className="text-sm font-semibold text-foreground">Browse Store</p><p className="text-xs text-muted-foreground">See what's trending</p></div>
              </Link>
            </div>

            {/* ── Mobile-only danger zone (hidden lg) ── */}
            <div className="lg:hidden rounded-2xl border border-destructive/40 bg-card p-4">
              <p className="text-sm font-semibold text-destructive mb-1">Danger Zone</p>
              <p className="text-xs text-muted-foreground mb-3">Permanently delete your account and all your products.</p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isDeleting}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    {isDeleting ? "Deleting…" : "Delete Account"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently delete your vendor account, all your products, and all associated data. This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes, delete everything</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}
