"use client"

import { useState, useMemo, useEffect, useCallback, useTransition, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Flame,
  Sparkles,
  Search,
  Layers,
  Shirt,
  Cpu,
  UtensilsCrossed,
  Sofa,
  HeartPulse,
  Bike,
  Gamepad2,
  BookOpen,
  Car,
  Wrench,
  Package,
  ArrowUpDown,
  X,
  ChevronRight,
  TrendingUp,
  Star,
  ShoppingBag,
} from "lucide-react"
import Image from "next/image"
import { createBrowserClient } from "@/lib/supabase/client"
import Link from "next/link"
import { VerificationBadge } from "@/components/verification-badge"
import { PRODUCT_CATEGORIES } from "@/lib/constants"

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  category: string | null
  image_url: string | null
  image_urls: string[] | null
  in_stock: boolean
  created_at: string
  vendor: {
    shop_name: string
    is_open: boolean
    is_verified: boolean
    verification_expires_at?: string | null
  }
}

interface ProductsClientProps {
  products: Product[]
  trendingIds?: string[]
}

type SortKey = "featured" | "newest" | "price-asc" | "price-desc"

const SPECIAL_FILTERS = ["All", "Trending", "New"] as const
type SpecialFilter = (typeof SPECIAL_FILTERS)[number]
type ChipFilter = SpecialFilter | (typeof PRODUCT_CATEGORIES)[number]

const CATEGORY_ICONS: Record<string, typeof Flame> = {
  All: Layers,
  Trending: Flame,
  New: Sparkles,
  Electronics: Cpu,
  Fashion: Shirt,
  "Food & Beverages": UtensilsCrossed,
  "Home & Garden": Sofa,
  "Health & Beauty": HeartPulse,
  "Sports & Outdoors": Bike,
  "Toys & Games": Gamepad2,
  "Books & Media": BookOpen,
  Automotive: Car,
  Services: Wrench,
  Other: Package,
}

const CATEGORY_COLORS: Record<string, { bg: string; icon: string; border: string }> = {
  All:               { bg: "bg-slate-100 dark:bg-slate-800",      icon: "text-slate-600 dark:text-slate-300",   border: "border-slate-200 dark:border-slate-700" },
  Trending:          { bg: "bg-orange-50 dark:bg-orange-950/40",  icon: "text-orange-500",                      border: "border-orange-200 dark:border-orange-800" },
  New:               { bg: "bg-emerald-50 dark:bg-emerald-950/40",icon: "text-emerald-500",                     border: "border-emerald-200 dark:border-emerald-800" },
  Electronics:       { bg: "bg-blue-50 dark:bg-blue-950/40",     icon: "text-blue-500",                        border: "border-blue-200 dark:border-blue-800" },
  Fashion:           { bg: "bg-pink-50 dark:bg-pink-950/40",     icon: "text-pink-500",                        border: "border-pink-200 dark:border-pink-800" },
  "Food & Beverages":{ bg: "bg-amber-50 dark:bg-amber-950/40",   icon: "text-amber-500",                       border: "border-amber-200 dark:border-amber-800" },
  "Home & Garden":   { bg: "bg-lime-50 dark:bg-lime-950/40",     icon: "text-lime-600",                        border: "border-lime-200 dark:border-lime-800" },
  "Health & Beauty": { bg: "bg-rose-50 dark:bg-rose-950/40",     icon: "text-rose-500",                        border: "border-rose-200 dark:border-rose-800" },
  "Sports & Outdoors":{ bg: "bg-cyan-50 dark:bg-cyan-950/40",    icon: "text-cyan-500",                        border: "border-cyan-200 dark:border-cyan-800" },
  "Toys & Games":    { bg: "bg-purple-50 dark:bg-purple-950/40", icon: "text-purple-500",                      border: "border-purple-200 dark:border-purple-800" },
  "Books & Media":   { bg: "bg-indigo-50 dark:bg-indigo-950/40", icon: "text-indigo-500",                      border: "border-indigo-200 dark:border-indigo-800" },
  Automotive:        { bg: "bg-zinc-100 dark:bg-zinc-800",       icon: "text-zinc-600 dark:text-zinc-300",     border: "border-zinc-200 dark:border-zinc-700" },
  Services:          { bg: "bg-teal-50 dark:bg-teal-950/40",     icon: "text-teal-500",                        border: "border-teal-200 dark:border-teal-800" },
  Other:             { bg: "bg-slate-100 dark:bg-slate-800",     icon: "text-slate-500",                       border: "border-slate-200 dark:border-slate-700" },
}

const NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

export default function ProductsClient({ products, trendingIds = [] }: ProductsClientProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [trackedViews, setTrackedViews] = useState<Set<string>>(new Set())
  const [activeChip, setActiveChip] = useState<ChipFilter>("All")
  const [sortBy, setSortBy] = useState<SortKey>("featured")
  const [, startTransition] = useTransition()
  const chipRowRef = useRef<HTMLDivElement | null>(null)

  const trendingSet = useMemo(() => new Set(trendingIds), [trendingIds])
  const trendingRank = useMemo(() => {
    const m = new Map<string, number>()
    trendingIds.forEach((id, i) => m.set(id, i))
    return m
  }, [trendingIds])

  const availableCategories = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => { if (p.category) set.add(p.category) })
    return PRODUCT_CATEGORIES.filter((c) => set.has(c))
  }, [products])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 250)
    return () => clearTimeout(t)
  }, [searchQuery])

  const isNew = useCallback((p: Product) => {
    if (!p.created_at) return false
    return Date.now() - new Date(p.created_at).getTime() < NEW_WINDOW_MS
  }, [])

  const filteredProducts = useMemo(() => {
    let result = products.slice()
    if (activeChip === "Trending") {
      result = result.filter((p) => trendingSet.has(p.id))
    } else if (activeChip === "New") {
      result = result.filter(isNew)
    } else if (activeChip !== "All") {
      result = result.filter((p) => p.category === activeChip)
    }
    const q = debouncedQuery.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          p.vendor.shop_name.toLowerCase().includes(q),
      )
    }
    if (sortBy === "newest") {
      result.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    } else if (sortBy === "price-asc") {
      result.sort((a, b) => a.price - b.price)
    } else if (sortBy === "price-desc") {
      result.sort((a, b) => b.price - a.price)
    } else {
      result.sort((a, b) => {
        const ar = trendingRank.has(a.id) ? trendingRank.get(a.id)! : Infinity
        const br = trendingRank.has(b.id) ? trendingRank.get(b.id)! : Infinity
        if (ar !== br) return ar - br
        if (a.in_stock !== b.in_stock) return a.in_stock ? -1 : 1
        return +new Date(b.created_at) - +new Date(a.created_at)
      })
    }
    return result
  }, [products, activeChip, debouncedQuery, sortBy, trendingSet, trendingRank, isNew])

  const trackProductView = useCallback(
    async (productId: string) => {
      if (trackedViews.has(productId)) return
      try {
        const supabase = createBrowserClient()
        await supabase.from("product_views").insert({ product_id: productId })
        setTrackedViews((prev) => new Set(prev).add(productId))
      } catch (error) {
        console.error("[v0] Error tracking product view:", error)
      }
    },
    [trackedViews],
  )

  useEffect(() => {
    try {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const productId = entry.target.getAttribute("data-product-id")
              if (productId) trackProductView(productId)
            }
          })
        },
        { threshold: 0.5 },
      )
      const productCards = document.querySelectorAll("[data-product-id]")
      productCards.forEach((card) => observer.observe(card))
      return () => observer.disconnect()
    } catch (err) {
      console.error("[v0] IntersectionObserver error:", err)
    }
  }, [filteredProducts, trackProductView])

  const chips: ChipFilter[] = useMemo(() => {
    const list: ChipFilter[] = ["All"]
    if (trendingIds.length > 0) list.push("Trending")
    if (products.some(isNew)) list.push("New")
    return [...list, ...availableCategories]
  }, [trendingIds.length, availableCategories, products, isNew])

  const handleChip = (chip: ChipFilter) => startTransition(() => setActiveChip(chip))
  const handleSearch = (value: string) => startTransition(() => setSearchQuery(value))

  const resolveImage = (p: Product) =>
    p.image_url ||
    (Array.isArray(p.image_urls) ? p.image_urls.find((u) => !!u) : null) ||
    null

  const trendingProducts = useMemo(
    () => products.filter((p) => trendingSet.has(p.id)).slice(0, 10),
    [products, trendingSet],
  )

  if (products.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-3xl border-2 border-dashed border-border bg-card/50">
        <div className="text-center px-6">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <ShoppingBag className="h-9 w-9 text-primary" />
          </div>
          <p className="text-lg font-bold text-foreground">No products yet in this market</p>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">
            Vendors are getting set up — check back soon!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Search + Sort bar ── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search products, vendors…"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-12 pl-11 pr-10 rounded-2xl border-border bg-card shadow-sm text-sm focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => handleSearch("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger
            className="h-12 w-auto gap-2 rounded-2xl border-border bg-card px-4 text-sm shadow-sm sm:w-[160px] shrink-0"
            aria-label="Sort"
          >
            <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="hidden sm:inline"><SelectValue /></span>
          </SelectTrigger>
          <SelectContent align="end" className="rounded-xl">
            <SelectItem value="featured">Featured</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="price-asc">Price: low → high</SelectItem>
            <SelectItem value="price-desc">Price: high → low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Category chips ── */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <div
          ref={chipRowRef}
          className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Product category filters"
        >
          {chips.map((chip) => {
            const Icon = CATEGORY_ICONS[chip] ?? Package
            const colors = CATEGORY_COLORS[chip] ?? CATEGORY_COLORS["Other"]
            const isActive = activeChip === chip
            return (
              <button
                key={chip}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleChip(chip)}
                className={[
                  "inline-flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all duration-150 whitespace-nowrap",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-[1.02]"
                    : `${colors.bg} ${colors.border} text-foreground hover:opacity-80`,
                ].join(" ")}
              >
                <Icon className={["h-4 w-4 shrink-0", isActive ? "text-primary-foreground" : colors.icon].join(" ")} />
                {chip}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Trending Now carousel (only on "All" tab, no active search) ── */}
      {activeChip === "All" && !debouncedQuery && trendingProducts.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500/15">
                <TrendingUp className="h-4 w-4 text-orange-500" />
              </div>
              <h2 className="text-base font-bold text-foreground">Trending Now</h2>
            </div>
            <button
              type="button"
              onClick={() => handleChip("Trending")}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              See all <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 sm:mx-0 sm:px-0">
            {trendingProducts.map((product) => {
              const img = resolveImage(product)
              return (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                  className="group shrink-0 w-40 sm:w-44"
                >
                  <div
                    data-product-id={product.id}
                    className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
                  >
                    <div className="relative aspect-square w-full overflow-hidden bg-muted">
                      {img ? (
                        <Image
                          src={img}
                          alt={product.name}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                          sizes="176px"
                          quality={70}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Package className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                      )}
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                        <Flame className="h-3 w-3" /> Hot
                      </span>
                      {!product.in_stock && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
                          <span className="rounded-full bg-foreground/90 px-2.5 py-1 text-[10px] font-semibold text-background">Out of stock</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="line-clamp-1 text-xs font-semibold text-foreground">{product.name}</p>
                      <p className="mt-1 text-sm font-bold text-primary">${product.price.toFixed(2)}</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Results meta ── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{filteredProducts.length}</span>{" "}
          {filteredProducts.length === 1 ? "result" : "results"}
          {activeChip !== "All" && (
            <> in <span className="font-semibold text-foreground">{activeChip}</span></>
          )}
        </p>
        {(activeChip !== "All" || debouncedQuery) && (
          <button
            type="button"
            onClick={() => { setActiveChip("All"); setSearchQuery("") }}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Products grid ── */}
      {filteredProducts.length === 0 ? (
        <div className="flex min-h-[300px] items-center justify-center rounded-3xl border-2 border-dashed border-border bg-card/50">
          <div className="text-center px-6">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-bold text-foreground">No products match your filters</p>
            <p className="mt-1 text-xs text-muted-foreground">Try a different category or search term.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 rounded-full"
              onClick={() => { setActiveChip("All"); setSearchQuery("") }}
            >
              Reset filters
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {filteredProducts.map((product) => {
            const img = resolveImage(product)
            const trending = trendingSet.has(product.id)
            const fresh = isNew(product)
            return (
              <Link key={product.id} href={`/product/${product.id}`} className="group">
                <div
                  data-product-id={product.id}
                  className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/8"
                >
                  {/* Image */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                    {img ? (
                      <Image
                        src={img}
                        alt={product.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        quality={75}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-10 w-10 text-muted-foreground/30" />
                      </div>
                    )}

                    {/* Badges */}
                    {(trending || fresh) && (
                      <div className="absolute left-2 top-2 flex flex-col gap-1">
                        {trending && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                            <Flame className="h-2.5 w-2.5" /> Trending
                          </span>
                        )}
                        {fresh && !trending && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                            <Sparkles className="h-2.5 w-2.5" /> New
                          </span>
                        )}
                      </div>
                    )}

                    {/* Out of stock overlay */}
                    {!product.in_stock && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
                        <span className="rounded-full bg-foreground/90 px-3 py-1 text-xs font-semibold text-background">
                          Out of stock
                        </span>
                      </div>
                    )}

                    {/* Open / Closed pill */}
                    <div className="absolute bottom-2 right-2">
                      <span
                        className={[
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md",
                          product.vendor.is_open
                            ? "bg-emerald-500/90 text-white"
                            : "bg-foreground/70 text-background",
                        ].join(" ")}
                      >
                        <span className={["h-1.5 w-1.5 rounded-full", product.vendor.is_open ? "bg-white" : "bg-background"].join(" ")} />
                        {product.vendor.is_open ? "Open" : "Closed"}
                      </span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    {product.category && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {product.category}
                      </span>
                    )}
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                      {product.name}
                    </h3>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="truncate">{product.vendor.shop_name}</span>
                      {product.vendor.is_verified && (
                        <VerificationBadge
                          isVerified={product.vendor.is_verified}
                          verificationExpiresAt={product.vendor.verification_expires_at}
                          size="xs"
                          showTooltip={false}
                        />
                      )}
                    </div>

                    {/* Placeholder star row for visual polish */}
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map((s) => (
                        <Star key={s} className={["h-3 w-3", s <= 4 ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"].join(" ")} />
                      ))}
                    </div>

                    <div className="mt-auto flex items-end justify-between pt-2">
                      <p className="text-base font-extrabold text-foreground">
                        ${product.price.toFixed(2)}
                      </p>
                      <span className="rounded-xl bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        View
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
