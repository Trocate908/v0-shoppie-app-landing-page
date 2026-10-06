"use client"

import { useState, useMemo, useEffect, useCallback, memo, useRef } from "react"
import { PRODUCT_CATEGORIES } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AppFooter } from "@/components/app-footer"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  MapPin,
  ChevronRight,
  Filter,
  X,
  DollarSign,
  BadgeCheck,
  Locate,
  Loader2,
  Heart,
  PackageOpen,
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
  Star,
  Store,
  Shuffle,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import HorizontalProductCarousel, {
  type CarouselProduct,
} from "@/components/horizontal-product-carousel"
import { EmptyState } from "@/components/empty-state"
import WhatsAppButton from "@/components/whatsapp-button"
import FavoriteButton from "@/components/favorite-button"
import ShareButton from "@/components/share-button"
import { createBrowserClient } from "@/lib/supabase/client"
import { getCurrencyForCountry, convertPrice, formatPrice, CURRENCIES, type Currency } from "@/lib/currency"
import { ProductPrice } from "@/components/price-display"
import { effectiveFilterPrice } from "@/lib/pricing"
import { searchProducts } from "@/lib/search"
import Image from "next/image"
import { NotificationBell } from "@/components/notification-bell"
import CartButton from "@/components/cart-button"
import AddToCartButton from "@/components/add-to-cart-button"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { VerificationBadge } from "@/components/verification-badge"
import ProductCarousel from "./product-carousel"
import SearchBox from "@/components/search-box"
import StatusRow from "@/components/status-row"

interface Location {
  id: string
  country: string
  city: string
  market_name: string
}

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  original_price?: number | null
  promo_label?: string | null
  promo_ends_at?: string | null
  category: string | null
  image_url: string | null
  image_urls: string[] | null
  in_stock: boolean
  created_at?: string | null
  is_featured?: boolean
  vendor: {
    id: string
    shop_name: string
    is_open: boolean
    is_verified?: boolean
    verification_expires_at?: string | null
    whatsapp_number?: string | null
    profile_picture_url?: string | null
    location: Location
  }
}

interface BrowseProductsClientProps {
  products: Product[]
  locations: Location[]
  visitorCountry: string | null
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  All: Layers,
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

/* Category tiles: one hue per category, taken from the store mockup (orange
   groceries, blue electronics, pink fashion, teal home, purple beauty, green
   pharmacy). Categories come from lib/constants, so anything without a hue here
   falls back to a neutral slate tile. */
const CATEGORY_GRADIENTS: Record<string, string> = {
  All:                 "from-slate-500 to-slate-700",
  Electronics:         "from-sky-400 to-blue-600",
  Fashion:             "from-pink-400 to-rose-600",
  "Food & Beverages":  "from-amber-400 to-orange-600",
  "Home & Garden":     "from-teal-400 to-emerald-600",
  "Health & Beauty":   "from-fuchsia-400 to-purple-600",
  "Sports & Outdoors": "from-emerald-400 to-teal-600",
  "Toys & Games":      "from-violet-400 to-purple-600",
  "Books & Media":     "from-indigo-400 to-indigo-600",
  Automotive:          "from-zinc-500 to-zinc-700",
  Services:            "from-teal-400 to-cyan-600",
  Other:               "from-slate-400 to-slate-600",
}

/* How many category tiles the row shows before "See all" expands it. */
const CATEGORY_PREVIEW_COUNT = 6

/* How many shop tiles the Popular shops carousel shows. */
const POPULAR_SHOPS_LIMIT = 10

interface CategoryCircleProps {
  label: string
  icon: LucideIcon
  gradient: string
  active: boolean
  onClick: () => void
}

/* Stable gradient lookup for the memoized tiles. */
const ALL_GRADIENT = CATEGORY_GRADIENTS.All

/** Circular category tile — gradient icon over a label, as in the store mockup.
    Memoized so grid re-renders (search keystrokes, filter changes) don't redo
    work for tiles whose props never changed. */
const CategoryCircle = memo(function CategoryCircle({ label, icon: Icon, gradient, active, onClick }: CategoryCircleProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="group flex w-[70px] shrink-0 flex-col items-center gap-2 sm:w-20"
    >
      <span
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-sm transition-transform duration-200 sm:h-[72px] sm:w-[72px]",
          gradient,
          active
            ? "scale-105 ring-2 ring-primary ring-offset-2 ring-offset-background"
            : "group-hover:scale-105 group-hover:shadow-md",
        )}
      >
        <Icon className="h-7 w-7" strokeWidth={1.75} />
      </span>
      <span
        className={cn(
          "line-clamp-2 text-center text-[11px] leading-tight sm:text-xs",
          active ? "font-bold text-foreground" : "font-medium text-muted-foreground",
        )}
      >
        {label}
      </span>
    </button>
  )
})

interface ShopSummary {
  id: string
  name: string
  city: string
  market: string
  isVerified: boolean
  productCount: number
  category: string | null
  /** Null for shops that never uploaded a logo — those fall back to initials. */
  profilePictureUrl: string | null
}

/* The products feed carries no shop logo, so each shop gets a colour derived
   from its id — stable per shop, and never a broken image. */
const SHOP_GRADIENTS = [
  "from-sky-400 to-blue-600",
  "from-amber-400 to-orange-600",
  "from-pink-400 to-rose-600",
  "from-teal-400 to-emerald-600",
  "from-fuchsia-400 to-purple-600",
  "from-emerald-400 to-teal-600",
  "from-indigo-400 to-indigo-600",
  "from-violet-400 to-purple-600",
]

function shopGradient(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return SHOP_GRADIENTS[hash % SHOP_GRADIENTS.length]
}

/** One shop tile in the Popular shops carousel. */
function ShopCard({ shop }: { shop: ShopSummary }) {
  return (
    <Link
      href={`/shop/${shop.id}`}
      className="group flex w-[128px] shrink-0 snap-start flex-col items-center gap-1.5 rounded-2xl border border-border/60 bg-card p-3 transition-colors hover:border-primary/40 sm:w-[148px]"
    >
      <span
        className={cn(
          "relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br text-xl font-bold text-white shadow-sm",
          !shop.profilePictureUrl && shopGradient(shop.id),
        )}
      >
        {shop.profilePictureUrl ? (
          <Image
            src={shop.profilePictureUrl}
            alt=""
            fill
            sizes="56px"
            className="object-cover"
          />
        ) : (
          shop.name.trim().charAt(0).toUpperCase() || "?"
        )}
      </span>
      <span className="flex w-full items-center justify-center gap-1">
        <span className="line-clamp-1 text-[13px] font-semibold text-foreground transition-colors group-hover:text-primary">
          {shop.name}
        </span>
        {shop.isVerified && <BadgeCheck className="h-3 w-3 shrink-0 text-primary" />}
      </span>
      <span className="line-clamp-1 w-full text-center text-[11px] text-muted-foreground">
        {shop.category ? `${shop.category} • ${shop.city}` : shop.city || shop.market}
      </span>
    </Link>
  )
}

/* Header currency toggle. Zimbabwean shoppers read prices in USD or ZiG, so the
   pill offers exactly those two; the conversion itself still goes through
   lib/currency, which is where the rates and the other currencies live. */
const CURRENCY_PILL: { code: string; label: string }[] = [
  { code: "USD", label: "USD" },
  { code: "ZWG", label: "ZiG" },
]

/* Sorting used to have its own <Select> next to the search bar. It now lives
   inside the filter menu so the search row stays a single control. */
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "random", label: "Random" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name A–Z" },
  { value: "price-low", label: "Price ↑" },
  { value: "price-high", label: "Price ↓" },
]

let _sharedBrowserClient: ReturnType<typeof createBrowserClient> | null = null

export default function BrowseProductsClient({
  products: initialProducts,
  locations,
  visitorCountry: initialVisitorCountry,
}: BrowseProductsClientProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCountry, setSelectedCountry] = useState<string>("")
  const [selectedCity, setSelectedCity] = useState<string>("")
  const [selectedLocation, setSelectedLocation] = useState<string>("")
  const [locationDialogOpen, setLocationDialogOpen] = useState(false)

  const [selectedCategory, setSelectedCategory] = useState<string>("")
  /* The results section sits well below the categories row, so a tap there
     would otherwise look like nothing happened. We scroll it into view on
     every category change. */
  const resultsRef = useRef<HTMLDivElement>(null)
  const [sortBy, setSortBy] = useState<string>("random")
  const [minPrice, setMinPrice] = useState<string>("")
  const [maxPrice, setMaxPrice] = useState<string>("")
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [shopsRotation, setShopsRotation] = useState(0)

  const [detectedCountry, setDetectedCountry] = useState<string | null>(initialVisitorCountry)
  const [geoStatus, setGeoStatus] = useState<"idle" | "detecting" | "success" | "error">("idle")

  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(
    initialVisitorCountry ? getCurrencyForCountry(initialVisitorCountry) : CURRENCIES.USD,
  )
  const [liveRates, setLiveRates] = useState<Record<string, number>>({})
  const [ratesDate, setRatesDate] = useState<string>("")
  const [ratesSource, setRatesSource] = useState<"live" | "fallback" | "">("")

  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false)

  const [currentVendor, setCurrentVendor] = useState<{
    id: string
    shop_name: string
    is_verified: boolean
    profile_picture_url?: string | null
  } | null>(null)

  useEffect(() => {
    async function fetchCurrentVendor() {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from("vendors")
        .select("id, shop_name, is_verified, profile_picture_url")
        .eq("user_id", user.id)
        .single()
      if (data) setCurrentVendor(data)
    }
    fetchCurrentVendor()
  }, [])

  useEffect(() => {
    if (detectedCountry) return
    if (!navigator.geolocation) return
    setGeoStatus("detecting")
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { "Accept-Language": "en" } }
          )
          if (!res.ok) throw new Error("Geocoding failed")
          const data = await res.json()
          const country: string = data?.address?.country ?? ""
          if (country) {
            setDetectedCountry(country)
            setGeoStatus("success")
          } else {
            setGeoStatus("error")
          }
        } catch {
          setGeoStatus("error")
        }
      },
      () => setGeoStatus("error"),
      { timeout: 8000 }
    )
  }, [detectedCountry])

  // Fetch live exchange rates on mount
  useEffect(() => {
    fetch("/api/currency/rates")
      .then((r) => r.json())
      .then((data) => {
        if (data?.rates) {
          setLiveRates(data.rates)
          setRatesDate(data.date ?? "")
          setRatesSource(data.source === "live" ? "live" : "fallback")
        }
      })
      .catch(() => {})
  }, [])

  const sortedProducts = useMemo(() => {
    if (!detectedCountry) return initialProducts
    const fromVisitorCountry: Product[] = []
    const fromOtherCountries: Product[] = []
    initialProducts.forEach((product) => {
      if (product.vendor.location.country === detectedCountry) {
        fromVisitorCountry.push(product)
      } else {
        fromOtherCountries.push(product)
      }
    })
    const isActivelyVerified = (p: Product) =>
      !!p.vendor.is_verified &&
      (!p.vendor.verification_expires_at || new Date(p.vendor.verification_expires_at).getTime() >= Date.now())
    const sortByVerification = (a: Product, b: Product) => {
      if (isActivelyVerified(a) && !isActivelyVerified(b)) return -1
      if (!isActivelyVerified(a) && isActivelyVerified(b)) return 1
      return 0
    }
    fromVisitorCountry.sort(sortByVerification)
    fromOtherCountries.sort(sortByVerification)
    return [...fromVisitorCountry, ...fromOtherCountries]
  }, [initialProducts, detectedCountry])

  const filteredProducts = useMemo(() => {
    let filtered = sortedProducts
    if (showVerifiedOnly) {
      filtered = filtered.filter(
        (p) => p.vendor.is_verified &&
          (!p.vendor.verification_expires_at || new Date(p.vendor.verification_expires_at).getTime() >= Date.now()),
      )
    }
    const searching = searchQuery.trim().length > 0
    // Search ranks by relevance, and the ranking is preserved through the
    // category/price filters below so the best match stays at the top.
    const ranked = searching
      ? searchProducts(filtered, searchQuery)
      : filtered.map((item) => ({ item, score: 0 }))
    filtered = ranked.map((r) => r.item)

    if (selectedCategory && selectedCategory !== "all") {
      filtered = filtered.filter((p) => p.category === selectedCategory)
    }
    if (selectedLocation) {
      filtered = filtered.filter((p) => p.vendor.location.id === selectedLocation)
    }
    // Price filters and sorting use the price the shopper actually pays, so a
    // discounted product lands in the range it really belongs to.
    if (minPrice) filtered = filtered.filter((p) => effectiveFilterPrice(p) >= Number.parseFloat(minPrice))
    if (maxPrice) filtered = filtered.filter((p) => effectiveFilterPrice(p) <= Number.parseFloat(maxPrice))

    // An explicit sort in the filter menu always wins over relevance — we
    // don't override a deliberate choice. Otherwise, while searching, the
    // order from lib/search is the order the shopper sees.
    const useRelevance = searching && (sortBy === "random" || sortBy === "relevance")

    const sorted = useRelevance
      ? filtered
      : (() => {
          const list = [...filtered]
          switch (sortBy) {
            case "random":
              for (let i = list.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1))
                ;[list[i], list[j]] = [list[j], list[i]]
              }
              break
            case "price-low":  list.sort((a, b) => effectiveFilterPrice(a) - effectiveFilterPrice(b)); break
            case "price-high": list.sort((a, b) => effectiveFilterPrice(b) - effectiveFilterPrice(a)); break
            case "name":       list.sort((a, b) => a.name.localeCompare(b.name)); break
            default:
              list.sort((a, b) => {
                const da = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0
                const db = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0
                return db - da
              })
          }
          return list
        })()

    // Filtering and sorting always see every product, and the grid below
    // renders all of them.
    return sorted
  }, [sortedProducts, searchQuery, selectedCategory, selectedLocation, minPrice, maxPrice, sortBy, showVerifiedOnly])

  const countries = useMemo(() => Array.from(new Set(locations.map((l) => l.country))).sort(), [locations])
  const cities = useMemo(() => {
    if (!selectedCountry) return []
    return Array.from(new Set(locations.filter((l) => l.country === selectedCountry).map((l) => l.city))).sort()
  }, [locations, selectedCountry])
  const markets = useMemo(() => {
    if (!selectedCity) return []
    return locations
      .filter((l) => l.country === selectedCountry && l.city === selectedCity)
      .sort((a, b) => a.market_name.localeCompare(b.market_name))
  }, [locations, selectedCountry, selectedCity])

  /* Recording a view used to add to a state Set, which re-rendered every
     product card on each tap. The tracked ids now live in a ref — no
     re-render, and an id is still never recorded twice. */
  const trackedViewsRef = useRef<Set<string>>(new Set())
  const trackProductView = useCallback(async (productId: string) => {
    if (trackedViewsRef.current.has(productId)) return
    try {
      const supabase = _sharedBrowserClient ?? (_sharedBrowserClient = createBrowserClient())
      const { error } = await supabase.from("product_views").insert({ product_id: productId })
      if (!error) trackedViewsRef.current.add(productId)
    } catch (error) {
      console.error("[v0] Error tracking product view:", error)
    }
  }, [])

  const handleLocationSelect = () => { if (selectedLocation) setLocationDialogOpen(false) }
  const clearLocationFilter = () => { setSelectedCountry(""); setSelectedCity(""); setSelectedLocation("") }
  const clearAllFilters = () => {
    setSelectedCategory(""); setMinPrice(""); setMaxPrice(""); setShowVerifiedOnly(false); clearLocationFilter()
  }

  const selectedLocationData = locations.find((l) => l.id === selectedLocation)
  const activeFiltersCount = [selectedCategory && selectedCategory !== "all", selectedLocation, minPrice, maxPrice, showVerifiedOnly].filter(Boolean).length

  /* Stable tile handlers — fresh closures every render would defeat the
     memoized CategoryCircle below. */
  /* Bring the results into view after the filter has been applied, so the
     shopper lands on the products their tap just filtered. The short delay
     lets React paint the new results before we scroll. */
  useEffect(() => {
    // Clearing the category (the "All" tile) shouldn't yank the viewport.
    if (!selectedCategory) return
    const target = resultsRef.current
    if (!target) return
    const frame = requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
    })
    return () => cancelAnimationFrame(frame)
  }, [selectedCategory])

  /* Search scrolls only on commit (Enter or picking a suggestion), never
     while typing — auto-scrolling on every keystroke would fight the user. */
  const scrollToResults = useCallback(() => {
    const target = resultsRef.current
    if (!target) return
    const frame = requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  const clearCategory = useCallback(() => setSelectedCategory(""), [])
  const makeCategoryToggle = useCallback(
    (cat: string) => () => setSelectedCategory((prev) => (prev === cat ? "" : cat)),
    [],
  )

  const searchSuggestions = useMemo(() => {
    const names = initialProducts.map((p) => p.name)
    const shopNames = initialProducts.map((p) => p.vendor.shop_name)
    const categories = Array.from(new Set(initialProducts.map((p) => p.category).filter(Boolean))) as string[]
    return Array.from(new Set([...names, ...shopNames, ...categories]))
  }, [initialProducts])

  const availableCategories = useMemo(() => {
    const set = new Set<string>()
    initialProducts.forEach((p) => { if (p.category) set.add(p.category) })
    return PRODUCT_CATEGORIES.filter((c) => set.has(c))
  }, [initialProducts])

  // Collapsed, the row mirrors the design's six tiles; it never hides the
  // shopper's current pick, which they can set from the filter menu too.
  const visibleCategories = useMemo(() => {
    if (showAllCategories) return availableCategories
    const preview = availableCategories.slice(0, CATEGORY_PREVIEW_COUNT)
    if (selectedCategory && !preview.includes(selectedCategory)) {
      return [...preview.slice(0, CATEGORY_PREVIEW_COUNT - 1), selectedCategory]
    }
    return preview
  }, [availableCategories, showAllCategories, selectedCategory])

  /* ── Homepage discovery carousels ──────────────────────────────────── */

  const carouselProducts = useMemo((): CarouselProduct[] => initialProducts, [initialProducts])

  const featuredProducts = useMemo(() => {
    const withFlag = carouselProducts.filter((p) => (p as CarouselProduct).is_featured)
    const source = withFlag.length > 0 ? withFlag : carouselProducts.filter((p) => p.vendor.is_verified)
    return source.slice(0, 10)
  }, [carouselProducts])

  const newArrivals = useMemo(() => {
    const byDate = [...carouselProducts].sort((a, b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0
      const db = b.created_at ? new Date(b.created_at).getTime() : 0
      return db - da
    })
    return byDate.slice(0, 10)
  }, [carouselProducts])

  /* ── Popular shops ── */

  /* Shops come from the vendors already joined onto the products feed, so
     this needs no extra query — one entry per vendor, with the catalogue
     size and main category we can actually prove from the data. */
  const shops = useMemo(() => {
    const byVendorId = new Map<string, ShopSummary>()
    for (const product of initialProducts) {
      const vendor = product.vendor
      let shop = byVendorId.get(vendor.id)
      if (!shop) {
        shop = {
          id: vendor.id,
          name: vendor.shop_name,
          city: vendor.location.city,
          market: vendor.location.market_name,
          isVerified: !!vendor.is_verified,
          productCount: 0,
          category: null,
          profilePictureUrl: vendor.profile_picture_url ?? null,
        }
        byVendorId.set(vendor.id, shop)
      }
      shop.productCount += 1
      if (!shop.category && product.category) shop.category = product.category
    }
    return Array.from(byVendorId.values())
  }, [initialProducts])

  /* "Popular" here means the biggest catalogues, then rotated by a random
     offset. The offset is picked after mount rather than during render, so
     the server-rendered order still matches on hydration while every reload
     lands on a different starting shop. */
  const popularShops = useMemo(() => {
    if (shops.length === 0) return []
    const ranked = [...shops].sort((a, b) => b.productCount - a.productCount)
    const offset = shopsRotation % ranked.length
    return [...ranked.slice(offset), ...ranked.slice(0, offset)].slice(0, POPULAR_SHOPS_LIMIT)
  }, [shops, shopsRotation])

  // Rotate to a new random offset after mount — runs once per page load, and
  // again on every reload, so the same shops aren't always in front.
  useEffect(() => {
    if (shops.length === 0) return
    setShopsRotation(Math.floor(Math.random() * shops.length))
  }, [shops.length])

  // The "Shuffle" button: jump to a different offset on demand.
  const reshuffleShops = useCallback(() => {
    if (shops.length === 0) return
    setShopsRotation((prev) => {
      const span = Math.max(1, shops.length - 1)
      return (prev + 1 + Math.floor(Math.random() * span)) % shops.length
    })
  }, [shops.length])

  return (
    <>
      {/* ── Store Header ── */}
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex min-w-0 items-center gap-2">
              <Image
                src="/logo.png"
                alt="ShoppieApp"
                width={32}
                height={32}
                priority
                className="h-8 w-8 shrink-0 rounded-xl ring-1 ring-border"
              />
              <span className="truncate text-lg font-extrabold tracking-tight text-foreground">
                ShoppieApp
              </span>
            </Link>
            <div className="flex shrink-0 items-center gap-1.5">
              {/* ── Display currency: USD / ZiG ── */}
              <div
                role="group"
                aria-label="Display currency"
                className="flex items-center rounded-full border border-border bg-muted/60 p-0.5"
              >
                {CURRENCY_PILL.map((option) => {
                  const isActive = selectedCurrency.code === option.code
                  return (
                    <button
                      key={option.code}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setSelectedCurrency(CURRENCIES[option.code])}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-bold transition-colors",
                        isActive
                          ? "bg-orange-500 text-white shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
              <NotificationBell />
              <CartButton />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => router.push("/wishlist")}
                aria-label="Open wishlist"
              >
                <Heart className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 sm:px-6 lg:px-8 pb-24">
        <div className="mx-auto max-w-7xl space-y-4">

          {/* ── Search bar — filters and sorting live inside it ── */}
          <SearchBox
            value={searchQuery}
            onChange={setSearchQuery}
            suggestions={searchSuggestions}
            placeholder="Search products, stores, categories..."
            onSubmit={scrollToResults}
            rightSlot={
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Filters and sorting"
                    className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white transition-colors hover:bg-blue-600"
                  >
                    <Filter className="h-4 w-4" />
                    {activeFiltersCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                        {activeFiltersCount}
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 rounded-2xl p-3 space-y-3">
                  <DropdownMenuLabel className="px-0 pb-1 text-sm">Sort by</DropdownMenuLabel>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setSortBy(option.value)}
                        className={`rounded-xl px-2 py-2 text-xs font-semibold transition-colors ${
                          sortBy === option.value
                            ? "bg-primary text-primary-foreground"
                            : "border border-border hover:bg-muted"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <DropdownMenuSeparator className="-mx-1" />
                  <DropdownMenuLabel className="px-0 pb-1 text-sm">Filter Options</DropdownMenuLabel>
                  <DropdownMenuSeparator className="-mx-1" />

                  <button
                    onClick={() => setShowVerifiedOnly(!showVerifiedOnly)}
                    className={`w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors
                      ${showVerifiedOnly ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}
                  >
                    <BadgeCheck className="h-4 w-4" />
                    {showVerifiedOnly ? "Showing Verified" : "Verified Only"}
                  </button>

                  <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
                    <DialogTrigger asChild>
                      <button
                        className={`w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors border
                          ${selectedLocationData ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                      >
                        <MapPin className="h-4 w-4" />
                        {selectedLocationData ? selectedLocationData.city : "Nearby Products"}
                      </button>
                    </DialogTrigger>
                    <DialogContent className="rounded-2xl">
                      <DialogHeader>
                        <DialogTitle>Select Your Location</DialogTitle>
                        <DialogDescription>Choose your country, city, and market to see nearby products</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <Button
                          variant="outline"
                          className="w-full gap-2 rounded-xl"
                          disabled={geoStatus === "detecting"}
                          onClick={() => {
                            if (!navigator.geolocation) return
                            setGeoStatus("detecting")
                            navigator.geolocation.getCurrentPosition(
                              async (pos) => {
                                try {
                                  const { latitude, longitude } = pos.coords
                                  const res = await fetch(
                                    `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
                                    { headers: { "Accept-Language": "en" } }
                                  )
                                  if (!res.ok) throw new Error()
                                  const data = await res.json()
                                  const country: string = data?.address?.country ?? ""
                                  const city: string = data?.address?.city ?? data?.address?.town ?? data?.address?.state ?? ""
                                  if (country) {
                                    setDetectedCountry(country)
                                    setSelectedCountry(country)
                                    if (city) setSelectedCity(city)
                                    setGeoStatus("success")
                                  } else {
                                    setGeoStatus("error")
                                  }
                                } catch { setGeoStatus("error") }
                              },
                              () => setGeoStatus("error"),
                              { timeout: 8000 }
                            )
                          }}
                        >
                          {geoStatus === "detecting"
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> Detecting...</>
                            : <><Locate className="h-4 w-4" /> Use My Current Location</>}
                        </Button>
                        <div className="relative flex items-center">
                          <div className="flex-1 border-t border-border" />
                          <span className="mx-3 text-xs text-muted-foreground">or select manually</span>
                          <div className="flex-1 border-t border-border" />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium">Country</label>
                          <Select value={selectedCountry} onValueChange={(val) => { setSelectedCountry(val); setSelectedCity(""); setSelectedLocation("") }}>
                            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select country" /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        {selectedCountry && (
                          <div>
                            <label className="mb-2 block text-sm font-medium">City</label>
                            <Select value={selectedCity} onValueChange={(val) => { setSelectedCity(val); setSelectedLocation("") }}>
                              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select city" /></SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {selectedCity && (
                          <div>
                            <label className="mb-2 block text-sm font-medium">Market</label>
                            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select market" /></SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {markets.map((m) => <SelectItem key={m.id} value={m.id}>{m.market_name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <Button onClick={handleLocationSelect} disabled={!selectedLocation} className="w-full rounded-xl">
                          Apply Filter
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
                    <DialogTrigger asChild>
                      <button className="w-full flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
                        <Filter className="h-4 w-4" />
                        Filters
                        {(selectedCategory || minPrice || maxPrice) && (
                          <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-[10px]">
                            {[selectedCategory, minPrice, maxPrice].filter(Boolean).length}
                          </Badge>
                        )}
                      </button>
                    </DialogTrigger>
                    <DialogContent className="rounded-2xl">
                      <DialogHeader>
                        <DialogTitle>Filter Products</DialogTitle>
                        <DialogDescription>Refine your search with these filters</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div>
                          <Label className="mb-2">Category</Label>
                          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                            <SelectTrigger className="rounded-xl"><SelectValue placeholder="All categories" /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="all">All categories</SelectItem>
                              {PRODUCT_CATEGORIES.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-3">
                          <Label>Price Range (USD)</Label>
                          <div className="flex gap-2">
                            <Input type="number" placeholder="Min" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} min="0" step="0.01" className="rounded-xl" />
                            <Input type="number" placeholder="Max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} min="0" step="0.01" className="rounded-xl" />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button onClick={() => setFilterDialogOpen(false)} className="flex-1 rounded-xl">Apply Filters</Button>
                          <Button variant="outline" onClick={() => { setSelectedCategory(""); setMinPrice(""); setMaxPrice("") }} className="flex-1 rounded-xl">Clear</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {activeFiltersCount > 0 && (
                    <>
                      <DropdownMenuSeparator className="-mx-1" />
                      <button onClick={clearAllFilters} className="w-full text-xs text-destructive hover:underline text-center">
                        Clear all filters
                      </button>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />

          {/* ── Categories ── */}
          <section>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <h2 className="text-base font-bold tracking-tight text-foreground">Categories</h2>
              {availableCategories.length > CATEGORY_PREVIEW_COUNT && (
                <button
                  type="button"
                  onClick={() => setShowAllCategories((prev) => !prev)}
                  aria-expanded={showAllCategories}
                  className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline"
                >
                  {showAllCategories ? "Show less" : "See all"}
                  <ChevronRight
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-200",
                      showAllCategories && "rotate-90",
                    )}
                  />
                </button>
              )}
            </div>
            <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
              {/* The scroller pads itself so the active ring — which paints
                  outside the circle and would otherwise be clipped by
                  overflow-y — has room; from sm up the -mx/px pair also keeps
                  the first tile flush with the page edge. */}
              <div
                role="group"
                aria-label="Product categories"
                className="flex gap-3 overflow-x-auto py-1.5 sm:-mx-1.5 sm:gap-5 sm:px-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                <CategoryCircle
                  label="All"
                  icon={Layers}
                  gradient={ALL_GRADIENT}
                  active={!selectedCategory || selectedCategory === "all"}
                  onClick={clearCategory}
                />
                {visibleCategories.map((cat) => (
                  <CategoryCircle
                    key={cat}
                    label={cat}
                    icon={CATEGORY_ICONS[cat] ?? Package}
                    gradient={CATEGORY_GRADIENTS[cat] ?? CATEGORY_GRADIENTS.Other}
                    active={selectedCategory === cat}
                    onClick={makeCategoryToggle(cat)}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* ── Status Row (Shop Updates) ── */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Shop Updates</p>
            </div>
            <StatusRow
              currentVendorId={currentVendor?.id ?? null}
              currentVendorName={currentVendor?.shop_name ?? null}
              currentVendorIsVerified={currentVendor?.is_verified ?? false}
              currentVendorProfilePic={currentVendor?.profile_picture_url ?? null}
            />
          </div>

          {/* ── Discovery carousels (Featured / Trending / New Arrivals) ── */}
          {(featuredProducts.length > 0 ||
            popularShops.length > 0 ||
            newArrivals.length > 0) && (
            <div className="content-visibility-auto space-y-6">
              <HorizontalProductCarousel
                title="Featured"
                icon={Star}
                products={featuredProducts}
                seeAllUrl="/?tab=store"
                variant="banner"
                accentClassName="bg-amber-500/15 text-amber-500"
                autoPlay
              />
              {/* Popular Shops — ranked by catalogue size, rotated at random
                  after mount so a reload shows a different set. */}
              {popularShops.length > 0 && (
                <section aria-labelledby="popular-shops-heading">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h2
                      id="popular-shops-heading"
                      className="flex items-center gap-1.5 text-base font-bold tracking-tight text-foreground"
                    >
                      <Store className="h-4 w-4 text-primary" />
                      Popular Shops
                    </h2>
                    <button
                      type="button"
                      onClick={reshuffleShops}
                      className="flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
                    >
                      <Shuffle className="h-3.5 w-3.5" />
                      Shuffle
                    </button>
                  </div>
                  <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
                    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4">
                      {popularShops.map((shop) => (
                        <ShopCard key={shop.id} shop={shop} />
                      ))}
                    </div>
                  </div>
                </section>
              )}
              <HorizontalProductCarousel
                title="New Arrivals"
                icon={Sparkles}
                products={newArrivals}
                seeAllUrl="/?tab=store"
                accentClassName="bg-emerald-500/15 text-emerald-500"
              />
            </div>
          )}

          {/* ── Active filter pills ── */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {showVerifiedOnly && (
                <Badge variant="secondary" className="gap-2 rounded-full py-1.5 pr-2">
                  <BadgeCheck className="h-3 w-3" /> Verified Only
                  <button onClick={() => setShowVerifiedOnly(false)} className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedLocationData && (
                <Badge variant="secondary" className="gap-2 rounded-full py-1.5 pr-2">
                  <MapPin className="h-3 w-3" /> {selectedLocationData.market_name}, {selectedLocationData.city}
                  <button onClick={clearLocationFilter} className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedCategory && selectedCategory !== "all" && (
                <Badge variant="secondary" className="gap-2 rounded-full py-1.5 pr-2">
                  {selectedCategory}
                  <button onClick={() => setSelectedCategory("")} className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {(minPrice || maxPrice) && (
                <Badge variant="secondary" className="gap-2 rounded-full py-1.5 pr-2">
                  <DollarSign className="h-3 w-3" />
                  {minPrice && maxPrice ? `$${minPrice}–$${maxPrice}` : minPrice ? `From $${minPrice}` : `Up to $${maxPrice}`}
                  <button onClick={() => { setMinPrice(""); setMaxPrice("") }} className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              <button onClick={clearAllFilters} className="text-xs font-semibold text-destructive hover:underline">
                Clear all
              </button>
            </div>
          )}

          {/* ── Results header ── */}
          <div
            ref={resultsRef}
            className="flex items-center justify-between scroll-mt-20"
          >
            <div className="flex items-baseline gap-2">
              <h2 className="font-serif text-2xl italic leading-none text-primary">
                {searchQuery.trim() ? "Results" : "Explore"}
              </h2>
              {selectedCategory && selectedCategory !== "all" && (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  {selectedCategory}
                </span>
              )}
              {searchQuery.trim() && (
                <span className="text-xs text-muted-foreground">
                  {filteredProducts.length} {filteredProducts.length === 1 ? "match" : "matches"}
                  {searchQuery.trim() ? ` for “${searchQuery.trim()}”` : ""}
                </span>
              )}
            </div>
            <div className="hidden h-px flex-1 bg-border sm:block ml-4" />
          </div>

          {/* ── Products Grid ── */}
          {filteredProducts.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              title={searchQuery || activeFiltersCount > 0 ? "No products found" : "No products available"}
              description={
                searchQuery || activeFiltersCount > 0
                  ? "Try adjusting your search or filters to see more results."
                  : "Check back soon — new items are added every day."
              }
              action={
                searchQuery || activeFiltersCount > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => { setSearchQuery(""); clearAllFilters() }}
                  >
                    Clear search &amp; filters
                  </Button>
                ) : undefined
              }
              minHeightClassName="min-h-[360px]"
            />
          ) : (
            <div className="content-visibility-auto grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredProducts.map((product, index) => {
                const formatMoney = (value: number) =>
                  formatPrice(convertPrice(value, selectedCurrency.code, liveRates), selectedCurrency)
                const isActivelyVerified =
                  !!product.vendor.is_verified &&
                  (!product.vendor.verification_expires_at ||
                    new Date(product.vendor.verification_expires_at).getTime() >= Date.now())

                return (
                  <div
                    key={product.id}
                    data-product-id={product.id}
                    className="group relative flex flex-col overflow-hidden rounded-xl bg-card cursor-pointer"
                    onClick={() => { trackProductView(product.id); router.push(`/product/${product.id}`) }}
                  >
                    {/* ── Image area ── */}
                    <div className="relative overflow-hidden rounded-xl">
                      <div className="transition-transform duration-500 ease-out group-hover:scale-[1.03]">
                        <ProductCarousel
                          images={
                            product.image_urls && product.image_urls.length > 0
                              ? product.image_urls
                              : product.image_url ? [product.image_url] : []
                          }
                          productName={product.name}
                          autoSlide={false}
                          priority={index < 4}
                          aspectClass="aspect-[3/4]"
                        />
                      </div>

                      {/* Top-left: badges */}
                      <div className="absolute left-1.5 top-1.5 flex flex-col items-start gap-1">
                        {!product.in_stock && (
                          <span className="rounded-sm bg-black/75 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                            Sold Out
                          </span>
                        )}
                        {product.original_price != null && product.original_price > product.price && product.in_stock && (
                          <span className="rounded-sm bg-destructive px-1.5 py-0.5 text-[9px] font-bold text-white">
                            On sale
                          </span>
                        )}
                        {isActivelyVerified && product.in_stock && (
                          <span className="flex items-center gap-0.5 rounded-sm bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                            <BadgeCheck className="h-2.5 w-2.5" /> Verified
                          </span>
                        )}
                      </div>

                      {/* Top-right: wishlist heart */}
                      <div
                        className="absolute right-1.5 top-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FavoriteButton productId={product.id} variant="ghost" />
                      </div>

                      {/* Bottom-right: quick add to cart */}
                      <div
                        className="absolute bottom-1.5 right-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <AddToCartButton
                          product={{
                            id: product.id,
                            name: product.name,
                            price: product.price,
                            image_url: product.image_url,
                            in_stock: product.in_stock,
                            vendor_id: product.vendor.id,
                            shop_name: product.vendor.shop_name,
                          }}
                          variant="secondary"
                        />
                      </div>
                    </div>

                    {/* ── Card body ── */}
                    <div className="flex flex-col gap-0.5 px-1 pt-2 pb-2.5">
                      {/* Price — most prominent, including any active discount */}
                      <ProductPrice product={product} size="sm" showPromoLabel format={formatMoney} />

                      {/* Product name */}
                      <h3 className="line-clamp-2 text-[12px] leading-snug text-foreground/90 group-hover:text-primary transition-colors">
                        {product.name}
                      </h3>

                      {/* Shop + location — muted */}
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="truncate text-[10px] text-muted-foreground leading-none">
                          {product.vendor.shop_name}
                        </span>
                        {product.vendor.is_verified && (
                          <VerificationBadge isVerified={product.vendor.is_verified} size="xs" showTooltip={false} />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      <AppFooter />
    </>
  )
}
