"use client"

import { useState, useMemo, useEffect, useCallback, useTransition, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
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

// Map a category label to a small icon for the chip row.
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

// Considered "new" if added in the last 14 days.
const NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

export default function ProductsClient({ products, trendingIds = [] }: ProductsClientProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [trackedViews, setTrackedViews] = useState<Set<string>>(new Set())
  const [activeChip, setActiveChip] = useState<ChipFilter>("All")
  const [sortBy, setSortBy] = useState<SortKey>("featured")
  const [, startTransition] = useTransition()
  const chipRowRef = useRef<HTMLDivElement | null>(null)

  // Set of trending IDs for O(1) lookup + ranking helper.
  const trendingSet = useMemo(() => new Set(trendingIds), [trendingIds])
  const trendingRank = useMemo(() => {
    const m = new Map<string, number>()
    trendingIds.forEach((id, i) => m.set(id, i))
    return m
  }, [trendingIds])

  // Which categories actually exist among our products (so we don't show
  // empty chips for categories with no listings here).
  const availableCategories = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => {
      if (p.category) set.add(p.category)
    })
    return PRODUCT_CATEGORIES.filter((c) => set.has(c))
  }, [products])

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 250)
    return () => clearTimeout(t)
  }, [searchQuery])

  const isNew = useCallback((p: Product) => {
    if (!p.created_at) return false
    return Date.now() - new Date(p.created_at).getTime() < NEW_WINDOW_MS
  }, [])

  // Filter + sort.
  const filteredProducts = useMemo(() => {
    let result = products.slice()

    // Chip filter
    if (activeChip === "Trending") {
      result = result.filter((p) => trendingSet.has(p.id))
    } else if (activeChip === "New") {
      result = result.filter(isNew)
    } else if (activeChip !== "All") {
      result = result.filter((p) => p.category === activeChip)
    }

    // Search
    const q = debouncedQuery.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          p.vendor.shop_name.toLowerCase().includes(q),
      )
    }

    // Sort
    if (sortBy === "newest") {
      result.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    } else if (sortBy === "price-asc") {
      result.sort((a, b) => a.price - b.price)
    } else if (sortBy === "price-desc") {
      result.sort((a, b) => b.price - a.price)
    } else if (sortBy === "featured") {
      // Featured = trending order first, then in-stock, then newest.
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

  // Track product views (memoized for performance)
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

  // Track views when products come into view.
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
  }, [filteredProducts])

  // Build the chip list — special filters always come first, then categories
  // that actually have products in this market.
  const chips: ChipFilter[] = useMemo(() => {
    const list: ChipFilter[] = ["All"]
    if (trendingIds.length > 0) list.push("Trending")
    if (products.some(isNew)) list.push("New")
    return [...list, ...availableCategories]
  }, [trendingIds.length, availableCategories, products, isNew])

  const handleChip = (chip: ChipFilter) => {
    startTransition(() => setActiveChip(chip))
  }

  const handleSearch = (value: string) => {
    startTransition(() => setSearchQuery(value))
  }

  const resolveImage = (p: Product) =>
    p.image_url ||
    (Array.isArray(p.image_urls) ? p.image_urls.find((u) => !!u) : null) ||
    null

  if (products.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-dashed border-border bg-card/50">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <p className="text-base font-semibold text-foreground">No products yet in this market</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Vendors are getting set up &mdash; check back soon!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Search + Sort */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search products, vendors..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-11 pl-10 pr-10 rounded-full border-border bg-card shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => handleSearch("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger
            className="h-11 w-auto gap-1.5 rounded-full border-border bg-card pl-3 pr-2 text-sm shadow-sm sm:w-[160px] sm:pl-4"
            aria-label="Sort"
          >
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <span className="hidden sm:inline">
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="featured">Featured</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="price-asc">Price: low to high</SelectItem>
            <SelectItem value="price-desc">Price: high to low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Category chip row — horizontally scrollable on mobile */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <div
          ref={chipRowRef}
          className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Product category filters"
        >
          {chips.map((chip) => {
            const Icon = CATEGORY_ICONS[chip] ?? Package
            const isActive = activeChip === chip
            const isTrending = chip === "Trending"
            const isNewChip = chip === "New"
            return (
              <button
                key={chip}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleChip(chip)}
                className={[
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                    : isTrending
                      ? "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300 hover:border-orange-500/50"
                      : isNewChip
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:border-emerald-500/50"
                        : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted",
                ].join(" ")}
              >
                <Icon className={["h-3.5 w-3.5", isTrending && !isActive ? "text-orange-500" : "", isNewChip && !isActive ? "text-emerald-500" : ""].join(" ")} />
                {chip}
              </button>
            )
          })}
        </div>
      </div>

      {/* Results meta + active filter pill */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {filteredProducts.length}{" "}
          {filteredProducts.length === 1 ? "result" : "results"}
          {activeChip !== "All" && (
            <>
              {" "}
              in <span className="font-semibold text-foreground">{activeChip}</span>
            </>
          )}
        </span>
        {(activeChip !== "All" || debouncedQuery) && (
          <button
            type="button"
            onClick={() => {
              setActiveChip("All")
              setSearchQuery("")
            }}
            className="font-medium text-primary hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-border bg-card/50">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">No products match your filters</p>
            <p className="mt-1 text-xs text-muted-foreground">Try a different category or search term.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setActiveChip("All")
                setSearchQuery("")
              }}
            >
              Reset filters
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => {
            const img = resolveImage(product)
            const trending = trendingSet.has(product.id)
            const fresh = isNew(product)
            return (
              <Link key={product.id} href={`/product/${product.id}`} className="group">
                <Card
                  data-product-id={product.id}
                  className="relative flex h-full flex-col overflow-hidden border-border/60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5"
                >
                  {/* Image */}
                  <div className="relative aspect-square w-full overflow-hidden bg-muted">
                    {img ? (
                      <Image
                        src={img}
                        alt={product.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                        quality={75}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                    )}

                    {/* Top-left ribbon: Trending or New */}
                    {(trending || fresh) && (
                      <div className="absolute left-2 top-2 flex flex-col gap-1">
                        {trending && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                            <Flame className="h-3 w-3" />
                            Trending
                          </span>
                        )}
                        {fresh && !trending && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                            <Sparkles className="h-3 w-3" />
                            New
                          </span>
                        )}
                      </div>
                    )}

                    {/* Top-right: Out-of-stock overlay */}
                    {!product.in_stock && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
                        <span className="rounded-full bg-foreground/90 px-3 py-1 text-xs font-semibold text-background">
                          Out of stock
                        </span>
                      </div>
                    )}

                    {/* Bottom-right: Open / Closed pill */}
                    <div className="absolute bottom-2 right-2">
                      <span
                        className={[
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md",
                          product.vendor.is_open
                            ? "bg-emerald-500/90 text-white"
                            : "bg-foreground/70 text-background",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "h-1.5 w-1.5 rounded-full",
                            product.vendor.is_open ? "bg-white" : "bg-background",
                          ].join(" ")}
                        />
                        {product.vendor.is_open ? "Open" : "Closed"}
                      </span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 flex-col p-3">
                    {product.category && (
                      <p className="mb-1 truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {product.category}
                      </p>
                    )}
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                      {product.name}
                    </h3>

                    <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
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

                    <div className="mt-auto pt-3">
                      <p className="text-base font-bold text-foreground">
                        ${product.price.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
