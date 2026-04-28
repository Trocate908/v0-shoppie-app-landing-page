"use client"

import { useState, useMemo, useEffect } from "react"
import { PRODUCT_CATEGORIES } from "@/lib/constants"
import { Card } from "@/components/ui/card"
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
import { Store, MapPin, Filter, X, DollarSign, BadgeCheck, Locate, Loader2, Menu, Heart, PackageOpen, Sparkles } from "lucide-react"
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
import { NotificationBell } from "@/components/notification-bell"

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

  // Current logged-in vendor info for StatusRow
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

  // Auto-detect country on mount using browser Geolocation + reverse geocoding
  useEffect(() => {
    if (detectedCountry) return // already have one
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

    // Priority sort: Verified (and not expired) first, then by country
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
        (product) =>
          product.vendor.is_verified &&
          (!product.vendor.verification_expires_at ||
            new Date(product.vendor.verification_expires_at).getTime() >= Date.now()),
      )
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.description?.toLowerCase().includes(query) ||
          product.category?.toLowerCase().includes(query),
      )
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter((product) => product.category === selectedCategory)
    }

    // Filter by location
    if (selectedLocation) {
      filtered = filtered.filter((product) => product.vendor.location.id === selectedLocation)
    }

    // Filter by price range
    if (minPrice) {
      filtered = filtered.filter((product) => product.price >= Number.parseFloat(minPrice))
    }
    if (maxPrice) {
      filtered = filtered.filter((product) => product.price <= Number.parseFloat(maxPrice))
    }

    // Sort products
    const sorted = [...filtered]
    switch (sortBy) {
      case "random":
        // Fisher-Yates shuffle — stable per render via useMemo dep on sortBy
        for (let i = sorted.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [sorted[i], sorted[j]] = [sorted[j], sorted[i]]
        }
        break
      case "price-low":
        sorted.sort((a, b) => a.price - b.price)
        break
      case "price-high":
        sorted.sort((a, b) => b.price - a.price)
        break
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
      case "newest":
      default:
        sorted.sort((a, b) => {
          const dateA = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0
          const dateB = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0
          return dateB - dateA
        })
        break
    }

    return sorted
  }, [sortedProducts, searchQuery, selectedCategory, selectedLocation, minPrice, maxPrice, sortBy, showVerifiedOnly])

  const countries = useMemo(() => {
    const uniqueCountries = new Set(locations.map((l) => l.country))
    return Array.from(uniqueCountries).sort()
  }, [locations])

  const cities = useMemo(() => {
    if (!selectedCountry) return []
    const uniqueCities = new Set(locations.filter((l) => l.country === selectedCountry).map((l) => l.city))
    return Array.from(uniqueCities).sort()
  }, [locations, selectedCountry])

  const markets = useMemo(() => {
    if (!selectedCity) return []
    return locations
      .filter((l) => l.country === selectedCountry && l.city === selectedCity)
      .sort((a, b) => a.market_name.localeCompare(b.market_name))
  }, [locations, selectedCountry, selectedCity])

  // Track product views
  const trackProductView = async (productId: string) => {
    if (trackedViews.has(productId)) return

    try {
      const supabase = createBrowserClient()
      const { error } = await supabase.from("product_views").insert({ product_id: productId })

      if (!error) {
        setTrackedViews((prev) => new Set(prev).add(productId))
      }
    } catch (error) {
      console.error("[v0] Error tracking product view:", error)
    }
  }

  const handleLocationSelect = () => {
    if (selectedLocation) {
      setLocationDialogOpen(false)
    }
  }

  const clearLocationFilter = () => {
    setSelectedCountry("")
    setSelectedCity("")
    setSelectedLocation("")
  }

  const clearAllFilters = () => {
    setSelectedCategory("")
    setMinPrice("")
    setMaxPrice("")
    setShowVerifiedOnly(false)
    clearLocationFilter()
  }

  const selectedLocationData = locations.find((l) => l.id === selectedLocation)
  const activeFiltersCount = [selectedCategory, selectedLocation, minPrice, maxPrice, showVerifiedOnly].filter(
    Boolean,
  ).length

  // Build suggestion pool from all product names + unique categories
  const searchSuggestions = useMemo(() => {
    const names = initialProducts.map((p) => p.name)
    const shopNames = initialProducts.map((p) => p.vendor.shop_name)
    const categories = Array.from(new Set(initialProducts.map((p) => p.category).filter(Boolean))) as string[]
    return Array.from(new Set([...names, ...shopNames, ...categories]))
  }, [initialProducts])

  return (
    <>
      {/* Store Header */}
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                <Store className="h-4.5 w-4.5 text-primary" strokeWidth={2.25} />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold leading-tight text-foreground sm:text-lg">Store</h1>
                <p className="truncate text-[11px] leading-tight text-muted-foreground sm:text-xs">
                  {initialProducts.length.toLocaleString()} products from local vendors
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Select value={selectedCurrency.code} onValueChange={(code) => setSelectedCurrency(CURRENCIES[code])}>
                <SelectTrigger className="h-9 w-[72px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(CURRENCIES).map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 px-2.5"
                onClick={() => router.push("/wishlist")}
                aria-label="Open wishlist"
              >
                <Heart className="h-4 w-4" />
                <span className="hidden text-xs font-medium sm:inline">Wishlist</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-4 sm:px-6 lg:px-8 pb-20">
        <div className="mx-auto max-w-7xl">
          {/* Location detection happens silently in the background */}

          {/* Search and Sort Bar */}
          <div className="mb-4 flex gap-2">
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
                <SelectTrigger className="w-[140px] h-10">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">Random</SelectItem>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>

              {/* Single Menu button replacing the 3 buttons */}
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-10 w-10 relative shrink-0">
                    <Menu className="h-4 w-4" />
                    {activeFiltersCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white font-bold">
                        {activeFiltersCount}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 p-3 space-y-3">
                  <DropdownMenuLabel className="px-0 pb-1">Filter Options</DropdownMenuLabel>
                  <DropdownMenuSeparator className="-mx-1" />

                  {/* Verified Only */}
                  <button
                    onClick={() => setShowVerifiedOnly(!showVerifiedOnly)}
                    className={`w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                      ${showVerifiedOnly ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}
                  >
                    <BadgeCheck className="h-4 w-4" />
                    {showVerifiedOnly ? "Showing Verified" : "Verified Only"}
                  </button>

                  {/* Nearby Products */}
                  <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
                    <DialogTrigger asChild>
                      <button
                        className={`w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors border
                          ${selectedLocationData ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                      >
                        <MapPin className="h-4 w-4" />
                        {selectedLocationData ? `${selectedLocationData.city}` : "Nearby Products"}
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Select Your Location</DialogTitle>
                        <DialogDescription>Choose your country, city, and market to see nearby products</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <Button
                          variant="outline"
                          className="w-full gap-2"
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
                                } catch {
                                  setGeoStatus("error")
                                }
                              },
                              () => setGeoStatus("error"),
                              { timeout: 8000 }
                            )
                          }}
                        >
                          {geoStatus === "detecting" ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Detecting...</>
                          ) : (
                            <><Locate className="h-4 w-4" /> Use My Current Location</>
                          )}
                        </Button>
                        <div className="relative flex items-center">
                          <div className="flex-1 border-t border-border" />
                          <span className="mx-3 text-xs text-muted-foreground">or select manually</span>
                          <div className="flex-1 border-t border-border" />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium">Country</label>
                          <Select
                            value={selectedCountry}
                            onValueChange={(val) => { setSelectedCountry(val); setSelectedCity(""); setSelectedLocation("") }}
                          >
                            <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                            <SelectContent>
                              {countries.map((country) => (
                                <SelectItem key={country} value={country}>{country}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {selectedCountry && (
                          <div>
                            <label className="mb-2 block text-sm font-medium">City</label>
                            <Select
                              value={selectedCity}
                              onValueChange={(val) => { setSelectedCity(val); setSelectedLocation("") }}
                            >
                              <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                              <SelectContent>
                                {cities.map((city) => (
                                  <SelectItem key={city} value={city}>{city}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {selectedCity && (
                          <div>
                            <label className="mb-2 block text-sm font-medium">Market</label>
                            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                              <SelectTrigger><SelectValue placeholder="Select market" /></SelectTrigger>
                              <SelectContent>
                                {markets.map((market) => (
                                  <SelectItem key={market.id} value={market.id}>{market.market_name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <Button onClick={handleLocationSelect} disabled={!selectedLocation} className="w-full">
                          Apply Filter
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Filters */}
                  <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
                    <DialogTrigger asChild>
                      <button className="w-full flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
                        <Filter className="h-4 w-4" />
                        Filters
                        {(selectedCategory || minPrice || maxPrice) && (
                          <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-[10px]">
                            {[selectedCategory, minPrice, maxPrice].filter(Boolean).length}
                          </Badge>
                        )}
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Filter Products</DialogTitle>
                        <DialogDescription>Refine your search with these filters</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div>
                          <Label className="mb-2">Category</Label>
                          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                            <SelectTrigger>
                              <SelectValue placeholder="All categories" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All categories</SelectItem>
                              {PRODUCT_CATEGORIES.map((category) => (
                                <SelectItem key={category} value={category}>{category}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-3">
                          <Label>Price Range (USD)</Label>
                          <div className="flex gap-2">
                            <Input type="number" placeholder="Min" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} min="0" step="0.01" />
                            <Input type="number" placeholder="Max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} min="0" step="0.01" />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button onClick={() => setFilterDialogOpen(false)} className="flex-1">Apply Filters</Button>
                          <Button variant="outline" onClick={() => { setSelectedCategory(""); setMinPrice(""); setMaxPrice("") }} className="flex-1">Clear</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {activeFiltersCount > 0 && (
                    <>
                      <DropdownMenuSeparator className="-mx-1" />
                      <button
                        onClick={clearAllFilters}
                        className="w-full text-xs text-destructive hover:underline text-center"
                      >
                        Clear all filters
                      </button>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Status Row */}
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Shop Updates
              </p>
            </div>
            <StatusRow
              currentVendorId={currentVendor?.id ?? null}
              currentVendorName={currentVendor?.shop_name ?? null}
              currentVendorIsVerified={currentVendor?.is_verified ?? false}
              currentVendorProfilePic={currentVendor?.profile_picture_url ?? null}
            />
          </div>

          {/* Active Filters */}
          {activeFiltersCount > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {showVerifiedOnly && (
                <Badge variant="secondary" className="gap-2 py-2 pr-2">
                  <BadgeCheck className="h-3 w-3" />
                  Verified Only
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 hover:bg-transparent"
                    onClick={() => setShowVerifiedOnly(false)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {selectedLocationData && (
                <Badge variant="secondary" className="gap-2 py-2 pr-2">
                  <MapPin className="h-3 w-3" />
                  {selectedLocationData.market_name}, {selectedLocationData.city}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 hover:bg-transparent"
                    onClick={clearLocationFilter}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {selectedCategory && (
                <Badge variant="secondary" className="gap-2 py-2 pr-2">
                  {selectedCategory}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 hover:bg-transparent"
                    onClick={() => setSelectedCategory("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {(minPrice || maxPrice) && (
                <Badge variant="secondary" className="gap-2 py-2 pr-2">
                  <DollarSign className="h-3 w-3" />
                  {minPrice && maxPrice
                    ? `$${minPrice} - $${maxPrice}`
                    : minPrice
                      ? `From $${minPrice}`
                      : `Up to $${maxPrice}`}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 hover:bg-transparent"
                    onClick={() => {
                      setMinPrice("")
                      setMaxPrice("")
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-8">
                Clear all
              </Button>
            </div>
          )}

          {/* Products Grid */}
          <div className="mb-4 flex items-end justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <h2 className="font-serif text-3xl italic leading-none text-primary">Explore</h2>
              <span className="text-xs font-medium text-muted-foreground">
                {filteredProducts.length.toLocaleString()} {filteredProducts.length === 1 ? "item" : "items"}
              </span>
            </div>
            <div className="hidden h-px flex-1 bg-border sm:block" />
          </div>

          {filteredProducts.length === 0 ? (
            <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6">
              <div className="max-w-sm text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <PackageOpen className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-base font-semibold text-foreground">
                  {searchQuery || activeFiltersCount > 0 ? "No products found" : "No products available"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchQuery || activeFiltersCount > 0
                    ? "Try adjusting your search or filters to see more results."
                    : "Check back soon — new items are added every day."}
                </p>
                {(searchQuery || activeFiltersCount > 0) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      setSearchQuery("")
                      clearAllFilters()
                    }}
                  >
                    Clear search & filters
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
                  <Card
                    key={product.id}
                    data-product-id={product.id}
                    className="group relative flex flex-col overflow-hidden rounded-xl border-border/60 bg-card p-0 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-xl"
                  >
                    {/* Image */}
                    <div
                      className="relative cursor-pointer overflow-hidden"
                      onClick={() => router.push(`/product/${product.id}`)}
                    >
                      <div className="transition-transform duration-500 ease-out group-hover:scale-[1.04]">
                        <ProductCarousel
                          images={
                            product.image_urls && product.image_urls.length > 0
                              ? product.image_urls
                              : product.image_url
                                ? [product.image_url]
                                : []
                          }
                          productName={product.name}
                          autoSlide={false}
                        />
                      </div>

                      {/* Bottom gradient for price legibility */}
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
                          <Badge variant="destructive" className="h-6 px-2 text-[10px] font-semibold shadow-md">
                            Out of Stock
                          </Badge>
                        )}
                        {isActivelyVerified && product.in_stock && (
                          <Badge className="h-6 gap-1 bg-background/95 px-2 text-[10px] font-semibold text-primary shadow-md backdrop-blur hover:bg-background/95">
                            <BadgeCheck className="h-3 w-3" />
                            Verified
                          </Badge>
                        )}
                      </div>

                      {/* Bottom-left: price pill */}
                      <div className="absolute bottom-2 left-2">
                        <div className="rounded-full bg-background/95 px-3 py-1 text-sm font-bold leading-tight text-primary shadow-lg backdrop-blur">
                          {formattedPrice}
                        </div>
                      </div>
                    </div>

                    {/* Details */}
                    <div
                      className="flex flex-1 flex-col p-3 sm:p-3.5 cursor-pointer"
                      onClick={() => router.push(`/product/${product.id}`)}
                    >
                      <h3 className="mb-1.5 line-clamp-2 min-h-[2.4rem] text-sm font-semibold leading-snug text-foreground group-hover:text-primary">
                        {product.name}
                      </h3>

                      {/* Shop row */}
                      <div className="flex items-center gap-1 text-xs">
                        <span className="truncate font-medium text-foreground/80">
                          {product.vendor.shop_name}
                        </span>
                        {product.vendor.is_verified && (
                          <VerificationBadge
                            isVerified={product.vendor.is_verified}
                            size="xs"
                            showTooltip={false}
                          />
                        )}
                      </div>

                      {/* Location row */}
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {product.vendor.location.market_name}, {product.vendor.location.city}
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
                            className="h-8 w-full text-xs"
                          />
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-muted-foreground">&copy; 2026 ShoppieApp. All rights reserved.</p>
            <div className="flex gap-4">
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
                Terms & Conditions
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}
