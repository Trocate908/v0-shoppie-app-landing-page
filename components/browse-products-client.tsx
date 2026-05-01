"use client"

import { useState, useMemo, useEffect } from "react"
import { PRODUCT_CATEGORIES } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  Filter,
  X,
  DollarSign,
  BadgeCheck,
  Locate,
  Loader2,
  Menu,
  Heart,
  PackageOpen,
  Sparkles,
  Search,
  ArrowUpDown,
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
} from "lucide-react"
import Link from "next/link"
import WhatsAppButton from "@/components/whatsapp-button"
import FavoriteButton from "@/components/favorite-button"
import ShareButton from "@/components/share-button"
import { createBrowserClient } from "@/lib/supabase/client"
import { getCurrencyForCountry, convertPrice, formatPrice, CURRENCIES, type Currency } from "@/lib/currency"
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
  category: string | null
  image_url: string | null
  image_urls: string[] | null
  in_stock: boolean
  vendor: {
    id: string
    shop_name: string
    is_open: boolean
    is_verified?: boolean
    verification_expires_at?: string | null
    whatsapp_number?: string | null
    location: Location
  }
}

interface BrowseProductsClientProps {
  products: Product[]
  locations: Location[]
  visitorCountry: string | null
}

const CATEGORY_ICONS: Record<string, typeof Layers> = {
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

const CATEGORY_COLORS: Record<string, { bg: string; icon: string; border: string }> = {
  All:               { bg: "bg-slate-100 dark:bg-slate-800",       icon: "text-slate-600 dark:text-slate-300",  border: "border-slate-200 dark:border-slate-700" },
  Electronics:       { bg: "bg-blue-50 dark:bg-blue-950/40",      icon: "text-blue-500",                       border: "border-blue-200 dark:border-blue-800" },
  Fashion:           { bg: "bg-pink-50 dark:bg-pink-950/40",      icon: "text-pink-500",                       border: "border-pink-200 dark:border-pink-800" },
  "Food & Beverages":{ bg: "bg-amber-50 dark:bg-amber-950/40",    icon: "text-amber-500",                      border: "border-amber-200 dark:border-amber-800" },
  "Home & Garden":   { bg: "bg-lime-50 dark:bg-lime-950/40",      icon: "text-lime-600",                       border: "border-lime-200 dark:border-lime-800" },
  "Health & Beauty": { bg: "bg-rose-50 dark:bg-rose-950/40",      icon: "text-rose-500",                       border: "border-rose-200 dark:border-rose-800" },
  "Sports & Outdoors":{ bg: "bg-cyan-50 dark:bg-cyan-950/40",     icon: "text-cyan-500",                       border: "border-cyan-200 dark:border-cyan-800" },
  "Toys & Games":    { bg: "bg-purple-50 dark:bg-purple-950/40",  icon: "text-purple-500",                     border: "border-purple-200 dark:border-purple-800" },
  "Books & Media":   { bg: "bg-indigo-50 dark:bg-indigo-950/40",  icon: "text-indigo-500",                     border: "border-indigo-200 dark:border-indigo-800" },
  Automotive:        { bg: "bg-zinc-100 dark:bg-zinc-800",        icon: "text-zinc-600 dark:text-zinc-300",    border: "border-zinc-200 dark:border-zinc-700" },
  Services:          { bg: "bg-teal-50 dark:bg-teal-950/40",      icon: "text-teal-500",                       border: "border-teal-200 dark:border-teal-800" },
  Other:             { bg: "bg-slate-100 dark:bg-slate-800",      icon: "text-slate-500",                      border: "border-slate-200 dark:border-slate-700" },
}

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
  const [trackedViews, setTrackedViews] = useState<Set<string>>(new Set())

  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [sortBy, setSortBy] = useState<string>("random")
  const [minPrice, setMinPrice] = useState<string>("")
  const [maxPrice, setMaxPrice] = useState<string>("")
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const [detectedCountry, setDetectedCountry] = useState<string | null>(initialVisitorCountry)
  const [geoStatus, setGeoStatus] = useState<"idle" | "detecting" | "success" | "error">("idle")

  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(
    initialVisitorCountry ? getCurrencyForCountry(initialVisitorCountry) : CURRENCIES.USD,
  )

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
            setSelectedCurrency(getCurrencyForCountry(country))
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
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          p.category?.toLowerCase().includes(query),
      )
    }
    if (selectedCategory && selectedCategory !== "all") {
      filtered = filtered.filter((p) => p.category === selectedCategory)
    }
    if (selectedLocation) {
      filtered = filtered.filter((p) => p.vendor.location.id === selectedLocation)
    }
    if (minPrice) filtered = filtered.filter((p) => p.price >= Number.parseFloat(minPrice))
    if (maxPrice) filtered = filtered.filter((p) => p.price <= Number.parseFloat(maxPrice))

    const sorted = [...filtered]
    switch (sortBy) {
      case "random":
        for (let i = sorted.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [sorted[i], sorted[j]] = [sorted[j], sorted[i]]
        }
        break
      case "price-low":  sorted.sort((a, b) => a.price - b.price); break
      case "price-high": sorted.sort((a, b) => b.price - a.price); break
      case "name":       sorted.sort((a, b) => a.name.localeCompare(b.name)); break
      default:
        sorted.sort((a, b) => {
          const da = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0
          const db = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0
          return db - da
        })
    }
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

  const trackProductView = async (productId: string) => {
    if (trackedViews.has(productId)) return
    try {
      const supabase = createBrowserClient()
      const { error } = await supabase.from("product_views").insert({ product_id: productId })
      if (!error) setTrackedViews((prev) => new Set(prev).add(productId))
    } catch (error) {
      console.error("[v0] Error tracking product view:", error)
    }
  }

  const handleLocationSelect = () => { if (selectedLocation) setLocationDialogOpen(false) }
  const clearLocationFilter = () => { setSelectedCountry(""); setSelectedCity(""); setSelectedLocation("") }
  const clearAllFilters = () => {
    setSelectedCategory(""); setMinPrice(""); setMaxPrice(""); setShowVerifiedOnly(false); clearLocationFilter()
  }

  const selectedLocationData = locations.find((l) => l.id === selectedLocation)
  const activeFiltersCount = [selectedCategory && selectedCategory !== "all", selectedLocation, minPrice, maxPrice, showVerifiedOnly].filter(Boolean).length

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

  return (
    <>
      {/* ── Store Header ── */}
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-base font-extrabold leading-tight text-foreground sm:text-lg">Store</h1>
              <p className="truncate text-[11px] leading-tight text-muted-foreground">
                {initialProducts.length.toLocaleString()} products from local vendors
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Select value={selectedCurrency.code} onValueChange={(code) => setSelectedCurrency(CURRENCIES[code])}>
                <SelectTrigger className="h-9 w-[72px] rounded-xl text-xs border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(CURRENCIES).map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>{currency.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 rounded-xl px-2.5"
                onClick={() => router.push("/wishlist")}
                aria-label="Open wishlist"
              >
                <Heart className="h-4 w-4" />
                <span className="hidden text-xs font-semibold sm:inline">Wishlist</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 sm:px-6 lg:px-8 pb-24">
        <div className="mx-auto max-w-7xl space-y-4">

          {/* ── Search + Sort + Menu ── */}
          <div className="flex gap-2">
            <div className="flex-1">
              <SearchBox
                value={searchQuery}
                onChange={setSearchQuery}
                suggestions={searchSuggestions}
                placeholder="Search products, shops, categories..."
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-10 w-[130px] rounded-2xl text-xs border-border bg-card">
                  <ArrowUpDown className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="random">Random</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="name">Name A–Z</SelectItem>
                  <SelectItem value="price-low">Price ↑</SelectItem>
                  <SelectItem value="price-high">Price ↓</SelectItem>
                </SelectContent>
              </Select>

              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-10 w-10 relative shrink-0 rounded-2xl">
                    <Menu className="h-4 w-4" />
                    {activeFiltersCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white font-bold">
                        {activeFiltersCount}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 rounded-2xl p-3 space-y-3">
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
                                    setSelectedCurrency(getCurrencyForCountry(country))
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
            </div>
          </div>

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

          {/* ── Category chips ── */}
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {/* All chip */}
              {(() => {
                const isActive = !selectedCategory || selectedCategory === "all"
                const colors = CATEGORY_COLORS["All"]
                return (
                  <button
                    key="All"
                    onClick={() => setSelectedCategory("")}
                    className={[
                      "inline-flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all duration-150 whitespace-nowrap",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-[1.02]"
                        : `${colors.bg} ${colors.border} text-foreground hover:opacity-80`,
                    ].join(" ")}
                  >
                    <Layers className={["h-4 w-4 shrink-0", isActive ? "text-primary-foreground" : colors.icon].join(" ")} />
                    All
                  </button>
                )
              })()}
              {availableCategories.map((cat) => {
                const Icon = CATEGORY_ICONS[cat] ?? Package
                const colors = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS["Other"]
                const isActive = selectedCategory === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(isActive ? "" : cat)}
                    className={[
                      "inline-flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all duration-150 whitespace-nowrap",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-[1.02]"
                        : `${colors.bg} ${colors.border} text-foreground hover:opacity-80`,
                    ].join(" ")}
                  >
                    <Icon className={["h-4 w-4 shrink-0", isActive ? "text-primary-foreground" : colors.icon].join(" ")} />
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>

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
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <h2 className="font-serif text-2xl italic leading-none text-primary">Explore</h2>
              <span className="text-xs font-medium text-muted-foreground">
                {filteredProducts.length.toLocaleString()} {filteredProducts.length === 1 ? "item" : "items"}
              </span>
            </div>
            <div className="hidden h-px flex-1 bg-border sm:block ml-4" />
          </div>

          {/* ── Products Grid ── */}
          {filteredProducts.length === 0 ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-3xl border-2 border-dashed border-border bg-card/50 px-6">
              <div className="max-w-sm text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <PackageOpen className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-base font-bold text-foreground">
                  {searchQuery || activeFiltersCount > 0 ? "No products found" : "No products available"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchQuery || activeFiltersCount > 0
                    ? "Try adjusting your search or filters to see more results."
                    : "Check back soon — new items are added every day."}
                </p>
                {(searchQuery || activeFiltersCount > 0) && (
                  <Button variant="outline" size="sm" className="mt-4 rounded-full"
                    onClick={() => { setSearchQuery(""); clearAllFilters() }}>
                    Clear search &amp; filters
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => {
                const convertedPrice = convertPrice(product.price, selectedCurrency.code)
                const formattedPrice = formatPrice(convertedPrice, selectedCurrency)
                const isActivelyVerified =
                  !!product.vendor.is_verified &&
                  (!product.vendor.verification_expires_at ||
                    new Date(product.vendor.verification_expires_at).getTime() >= Date.now())

                return (
                  <div
                    key={product.id}
                    data-product-id={product.id}
                    className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/8"
                    onClick={() => { trackProductView(product.id); router.push(`/product/${product.id}`) }}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Image area */}
                    <div className="relative overflow-hidden">
                      <div className="transition-transform duration-500 ease-out group-hover:scale-[1.04]">
                        <ProductCarousel
                          images={
                            product.image_urls && product.image_urls.length > 0
                              ? product.image_urls
                              : product.image_url ? [product.image_url] : []
                          }
                          productName={product.name}
                          autoSlide={false}
                        />
                      </div>

                      {/* Gradient for bottom legibility */}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />

                      {/* Top-right: favorite + share */}
                      <div className="absolute right-2 top-2 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <FavoriteButton productId={product.id} variant="outline" />
                        <ShareButton
                          type="product"
                          productId={product.id}
                          productName={product.name}
                          productPrice={product.price}
                          variant="outline"
                        />
                      </div>

                      {/* Top-left: stock / verified ribbons */}
                      <div className="absolute left-2 top-2 flex flex-col items-start gap-1.5">
                        {!product.in_stock && (
                          <Badge variant="destructive" className="h-6 rounded-full px-2 text-[10px] font-semibold shadow-md">
                            Out of Stock
                          </Badge>
                        )}
                        {isActivelyVerified && product.in_stock && (
                          <Badge className="h-6 gap-1 rounded-full bg-background/95 px-2 text-[10px] font-semibold text-primary shadow-md backdrop-blur hover:bg-background/95">
                            <BadgeCheck className="h-3 w-3" /> Verified
                          </Badge>
                        )}
                      </div>

                      {/* Bottom-left: price pill */}
                      <div className="absolute bottom-2 left-2">
                        <div className="rounded-full bg-background/95 px-3 py-1 text-sm font-extrabold leading-tight text-primary shadow-lg backdrop-blur">
                          {formattedPrice}
                        </div>
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="flex flex-1 flex-col p-3 sm:p-3.5">
                      {product.category && (
                        <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {product.category}
                        </span>
                      )}
                      <h3 className="line-clamp-2 min-h-[2.4rem] text-sm font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
                        {product.name}
                      </h3>

                      <div className="mt-1 flex items-center gap-1 text-xs">
                        <span className="truncate font-medium text-foreground/80">{product.vendor.shop_name}</span>
                        {product.vendor.is_verified && (
                          <VerificationBadge isVerified={product.vendor.is_verified} size="xs" showTooltip={false} />
                        )}
                      </div>

                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{product.vendor.location.market_name}, {product.vendor.location.city}</span>
                      </div>

                      {/* Star rating row */}
                      <div className="mt-1.5 flex items-center gap-0.5">
                        {[1,2,3,4,5].map((s) => (
                          <Star key={s} className={["h-3 w-3", s <= 4 ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"].join(" ")} />
                        ))}
                      </div>

                      {/* Open/Closed pill */}
                      <div className="mt-2">
                        <span className={[
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          product.vendor.is_open ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground",
                        ].join(" ")}>
                          <span className={["h-1.5 w-1.5 rounded-full", product.vendor.is_open ? "bg-emerald-500" : "bg-muted-foreground"].join(" ")} />
                          {product.vendor.is_open ? "Open now" : "Closed"}
                        </span>
                      </div>

                      {/* WhatsApp CTA */}
                      {product.vendor.whatsapp_number && (
                        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                          <WhatsAppButton
                            phoneNumber={product.vendor.whatsapp_number}
                            shopName={product.vendor.shop_name}
                            productName={product.name}
                            label="Chat on WhatsApp"
                            variant="outline"
                            size="sm"
                            className="h-8 w-full rounded-xl text-xs"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-background/60 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} ShoppieApp. All rights reserved.</p>
          <Link href="/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Terms &amp; Conditions
          </Link>
        </div>
      </footer>
    </>
  )
}
