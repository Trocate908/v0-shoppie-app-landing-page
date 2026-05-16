"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import {
  Eye, Package, LogOut, Plus, Settings, Trash2, Moon, Sun, User,
  Radio, TrendingUp, TrendingDown, MessageCircle, Heart,
  ShoppingBag, ArrowUpRight, Minus, BarChart2, Flame,
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

type Props = {
  vendor: VendorData
  stats: Stats
  userId: string
}

// ── Tiny SVG bar chart ────────────────────────────────────────────────────────
function MiniBarChart({ data }: { data: DailyView[] }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  const W = 200
  const H = 44
  const barW = Math.floor(W / data.length) - 3
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10" preserveAspectRatio="none">
        {data.map((d, i) => {
          const barH = Math.max((d.count / max) * (H - 4), d.count > 0 ? 4 : 1)
          const x = i * (barW + 3)
          const y = H - barH
          const isToday = i === data.length - 1
          return (
            <rect
              key={d.date}
              x={x} y={y} width={barW} height={barH}
              rx="2"
              fill={isToday ? "hsl(var(--primary))" : "hsl(var(--primary)/0.35)"}
            />
          )
        })}
      </svg>
      <div className="flex justify-between mt-1">
        {data.map((d) => {
          const dayIdx = new Date(d.date + "T12:00:00").getDay()
          return (
            <span key={d.date} className="text-[9px] text-muted-foreground leading-none">
              {days[dayIdx]}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── Trend indicator ───────────────────────────────────────────────────────────
function Trend({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0)
    return <span className="text-xs text-muted-foreground">No data yet</span>
  if (previous === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <TrendingUp className="h-3 w-3" /> New this week
      </span>
    )
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> Same as last week
      </span>
    )
  if (pct > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <TrendingUp className="h-3 w-3" /> +{pct}% vs last week
      </span>
    )
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-rose-500 dark:text-rose-400">
      <TrendingDown className="h-3 w-3" /> {pct}% vs last week
    </span>
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
        saveAccount({
          userId,
          email: session.user.email ?? "",
          shopName: vendor.shop_name,
          profilePictureUrl: vendor.profile_picture_url ?? null,
          refreshToken: session.refresh_token,
          accessToken: session.access_token,
        })
        setActiveAccountId(userId)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && session.user.id === userId)
        updateAccountTokens(userId, session.refresh_token, session.access_token)
    })
    return () => subscription.unsubscribe()
  }, [userId, vendor.shop_name, vendor.profile_picture_url])

  const handleToggleShop = async (checked: boolean) => {
    setIsUpdating(true)
    const supabase = createBrowserClient()
    try {
      const { error } = await supabase.from("vendors").update({ is_open: checked }).eq("id", vendor.id)
      if (error) throw error
      setIsOpen(checked)
      toast({ title: checked ? "Shop is now Open" : "Shop is now Closed" })
    } catch {
      toast({ title: "Update failed", variant: "destructive" })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleLogout = async () => {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch("/api/vendor/delete-account", { method: "DELETE" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to delete account")
      toast({ title: "Account deleted" })
      const supabase = createBrowserClient()
      await supabase.auth.signOut()
      window.location.href = "/"
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
      setIsDeleting(false)
    }
  }

  const daysUntilExpiry =
    vendor.is_verified && vendor.verification_expires_at
      ? Math.floor((new Date(vendor.verification_expires_at).getTime() - Date.now()) / 86400000)
      : null

  return (
    <div className="min-h-screen bg-background">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl px-3 py-3 sm:px-4">

          {/* Row 1: identity */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Avatar */}
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
              {vendor.profile_picture_url ? (
                <Image src={vendor.profile_picture_url} alt={vendor.shop_name} fill className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Name + location */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-sm font-bold text-foreground leading-tight truncate max-w-[140px] sm:max-w-none">
                  {vendor.shop_name}
                </h1>
                <VerificationBadge isVerified={vendor.is_verified || false} />
                <Badge
                  variant={isOpen ? "default" : "secondary"}
                  className={`text-[9px] py-0 px-1 h-4 leading-none shrink-0 ${isOpen ? "bg-emerald-500 text-white hover:bg-emerald-500" : ""}`}
                >
                  {isOpen ? "Open" : "Closed"}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                {vendor.location.name}, {vendor.location.country}
              </p>
            </div>
          </div>

          {/* Row 2: action buttons — scrollable on mobile */}
          <div className="mt-2.5 flex items-center gap-0.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={toggleTheme} title="Toggle theme">
              {theme === "light" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
            </Button>
            <div className="shrink-0"><NotificationBell /></div>
            <div className="shrink-0"><AccountSwitcherSheet currentUserId={userId} /></div>
            <div className="shrink-0">
              <ShopShareButton
                shopName={vendor.shop_name}
                vendorId={vendor.id}
                location={`${vendor.location.name}, ${vendor.location.city}`}
              />
            </div>
            <div className="shrink-0">
              <ActivateVerificationDialog
                vendorId={vendor.id}
                shopName={vendor.shop_name}
                isVerified={vendor.is_verified || false}
                expiresAt={vendor.verification_expires_at || null}
              />
            </div>
            <div className="shrink-0"><EditProfileDialog vendor={vendor} /></div>

            {/* Spacer pushes logout to the right */}
            <div className="flex-1" />

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="shrink-0 h-8 px-2 text-xs text-muted-foreground gap-1"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-2xl px-3 py-4 sm:px-4 sm:py-6 space-y-4">

        {/* Verification warning */}
        {daysUntilExpiry !== null && daysUntilExpiry <= 7 && (
          <div className={`rounded-xl border px-3 py-2.5 text-xs font-medium ${
            daysUntilExpiry <= 0
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
              : "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300"
          }`}>
            {daysUntilExpiry <= 0
              ? "⚠️ Your verification badge has expired. Renew to keep displaying it."
              : `⏳ Verification expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? "s" : ""}. Renew soon.`}
          </div>
        )}

        {/* Shop Updates */}
        <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <Radio className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-sm font-semibold text-foreground">Shop Updates</span>
            <span className="text-xs text-muted-foreground">· 24 h</span>
          </div>
          <StatusRow
            currentVendorId={vendor.id}
            currentVendorName={vendor.shop_name}
            currentVendorIsVerified={vendor.is_verified ?? false}
            currentVendorProfilePic={vendor.profile_picture_url ?? null}
          />
        </div>

        {/* Views chart + shop toggle */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Chart */}
          <div className="sm:col-span-2 rounded-2xl border border-border bg-card p-3 sm:p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Views — Last 7 Days
                </p>
                <p className="text-2xl sm:text-3xl font-extrabold text-foreground leading-tight mt-0.5">
                  {stats.weeklyViews.toLocaleString()}
                </p>
                <div className="mt-1">
                  <Trend current={stats.weeklyViews} previous={stats.prevWeekViews} />
                </div>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                <BarChart2 className="h-4 w-4 text-primary" />
              </div>
            </div>
            <MiniBarChart data={stats.dailyViews} />
          </div>

          {/* Shop toggle */}
          <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 flex flex-row sm:flex-col justify-between items-center sm:items-start gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Shop Status</p>
              <p className="text-lg sm:text-2xl font-extrabold text-foreground leading-tight mt-0.5">
                {isOpen ? "Open" : "Closed"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                {isOpen ? "Visible to customers" : "Hidden from customers"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch id="shop-status" checked={isOpen} onCheckedChange={handleToggleShop} disabled={isUpdating} />
              <Label htmlFor="shop-status" className="text-xs font-medium cursor-pointer whitespace-nowrap hidden sm:block">
                {isUpdating ? "Updating…" : isOpen ? "Open" : "Closed"}
              </Label>
            </div>
          </div>
        </div>

        {/* 4 stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {[
            { label: "Total Views", value: stats.totalViews.toLocaleString(), sub: "All time",          icon: Eye,           color: "text-blue-500",    bg: "bg-blue-500/10" },
            { label: "Products",    value: stats.productCount,               sub: `${stats.inStockCount} in stock`, icon: Package,  color: "text-violet-500",  bg: "bg-violet-500/10" },
            { label: "Messages",    value: stats.conversationCount,          sub: "From customers",     icon: MessageCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { label: "Wishlisted",  value: stats.favoritesCount,             sub: "Saved by shoppers",  icon: Heart,         color: "text-rose-500",    bg: "bg-rose-500/10" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-3 sm:p-4">
              <div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-lg ${s.bg}`}>
                <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
              </div>
              <p className="text-xl sm:text-2xl font-extrabold text-foreground leading-tight">{s.value}</p>
              <p className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground mt-0.5">{s.label}</p>
              <p className="text-[10px] text-muted-foreground leading-snug">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Top product */}
        {stats.topProduct && (
          <Link href={`/product/${stats.topProduct.id}`} className="block">
            <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 shrink-0">
                  <Flame className="h-4 w-4 text-amber-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Top Product</p>
                  <p className="text-sm font-bold text-foreground truncate mt-0.5">{stats.topProduct.name}</p>
                  <p className="text-xs text-muted-foreground">{stats.topProduct.views.toLocaleString()} views</p>
                </div>
                {stats.topProduct.image_url && (
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border">
                    <Image src={stats.topProduct.image_url} alt={stats.topProduct.name} fill className="object-cover" />
                  </div>
                )}
                <ArrowUpRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </div>
          </Link>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
          <Link
            href="/vendor/products/add"
            className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 sm:p-4 hover:bg-primary/10 transition-colors"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Add Product</p>
              <p className="text-xs text-muted-foreground">List a new item</p>
            </div>
          </Link>

          <Link
            href="/vendor/products"
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 sm:p-4 hover:bg-muted/40 transition-colors"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted shrink-0">
              <Settings className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Manage Products</p>
              <p className="text-xs text-muted-foreground">{stats.productCount} listed</p>
            </div>
          </Link>

          <Link
            href="/browse"
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 sm:p-4 hover:bg-muted/40 transition-colors"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted shrink-0">
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Browse Store</p>
              <p className="text-xs text-muted-foreground">See what's trending</p>
            </div>
          </Link>
        </div>

        {/* Danger Zone */}
        <div className="rounded-2xl border border-destructive/40 bg-card p-3 sm:p-4">
          <p className="text-sm font-semibold text-destructive mb-1">Danger Zone</p>
          <p className="text-xs text-muted-foreground mb-3">
            Permanently delete your account and all your products.
          </p>
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
                <AlertDialogDescription>
                  This will permanently delete your vendor account, all your products, and all associated data. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, delete everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

      </main>
    </div>
  )
}
