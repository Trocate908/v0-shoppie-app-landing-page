"use client"

import { useState, useMemo, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Search, MapPin, Store, X, Filter, DollarSign, Heart } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { createBrowserClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import ProfileButton from "@/components/profile-button"
import WhatsAppButton from "@/components/whatsapp-button"
import FavoriteButton from "@/components/favorite-button"
import ShareButton from "@/components/share-button"
import { getCurrencyForCountry, convertPrice, formatPrice, CURRENCIES, type Currency } from "@/lib/currency"
import { useRouter } from "next/navigation"
import { VerificationBadge } from "@/components/verification-badge"

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
  in_stock: boolean
  vendor: {
    id: string
    shop_name: string
    is_open: boolean
    is_verified?: boolean
    whatsapp_number?: string | null
    location: Location
  }
}

interface BrowseProductsClientProps {
  products: Product[]
  locations: Location[]
  visitorCountry: string | null
}

const PRODUCT_CATEGORIES = [
  "Electronics",
  "Fashion",
  "Food & Beverages",
  "Home & Garden",
  "Health & Beauty",
  "Sports & Outdoors",
  "Toys & Games",
  "Books & Media",
  "Automotive",
  "Services",
  "Other",
]

export default function BrowseProductsClient({
  products: initialProducts,
  locations,
  visitorCountry,
}: BrowseProductsClientProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCountry, setSelectedCountry] = useState<string>("")
  const [selectedCity, setSelectedCity] = useState<string>("")
  const [selectedLocation, setSelectedLocation] = useState<string>("")
  const [locationDialogOpen, setLocationDialogOpen] = useState(false)
  const [trackedViews, setTrackedViews] = useState<Set<string>>(new Set())

  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [sortBy, setSortBy] = useState<string>("name")
  const [minPrice, setMinPrice] = useState<string>("")
  const [maxPrice, setMaxPrice] = useState<string>("")
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)

  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(
    visitorCountry ? getCurrencyForCountry(visitorCountry) : CURRENCIES.USD,
  )

  const sortedProducts = useMemo(() => {
    if (!visitorCountry) return initialProducts

    const fromVisitorCountry: Product[] = []
    const fromOtherCountries: Product[] = []

    initialProducts.forEach((product) => {
      if (product.vendor.location.country === visitorCountry) {
        fromVisitorCountry.push(product)
      } else {
        fromOtherCountries.push(product)
      }
    })

    return [...fromVisitorCountry, ...fromOtherCountries]
  }, [initialProducts, visitorCountry])

  const filteredProducts = useMemo(() => {
    let filtered = sortedProducts

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
      case "price-low":
        sorted.sort((a, b) => a.price - b.price)
        break
      case "price-high":
        sorted.sort((a, b) => b.price - a.price)
        break
      case "name":
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
    }

    return sorted
  }, [sortedProducts, searchQuery, selectedCategory, selectedLocation, minPrice, maxPrice, sortBy])

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
    clearLocationFilter()
  }

  const selectedLocationData = locations.find((l) => l.id === selectedLocation)
  const activeFiltersCount = [selectedCategory, selectedLocation, minPrice, maxPrice].filter(Boolean).length

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Store className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">ShoppieApp</h1>
            </Link>
            <div className="flex items-center gap-3">
              <Select value={selectedCurrency.code} onValueChange={(code) => setSelectedCurrency(CURRENCIES[code])}>
                <SelectTrigger className="w-24">
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
              <Button variant="ghost" size="sm" className="gap-2" onClick={() => router.push("/wishlist")}>
                <Heart className="h-5 w-5" />
                <span className="hidden sm:inline">Wishlist</span>
              </Button>
              <ProfileButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Page Title */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Browse All Products</h2>
            {visitorCountry && (
              <p className="mt-1 text-sm text-muted-foreground">Showing products from {visitorCountry} first</p>
            )}
          </div>

          {/* Search and Filter Bar */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name (A-Z)</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>

            {/* Location Filter Button */}
            <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 bg-transparent">
                  <MapPin className="h-4 w-4" />
                  {selectedLocationData ? "Change Location" : "Nearby Products"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Select Your Location</DialogTitle>
                  <DialogDescription>Choose your country, city, and market to see nearby products</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Country</label>
                    <Select
                      value={selectedCountry}
                      onValueChange={(val) => {
                        setSelectedCountry(val)
                        setSelectedCity("")
                        setSelectedLocation("")
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map((country) => (
                          <SelectItem key={country} value={country}>
                            {country}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedCountry && (
                    <div>
                      <label className="mb-2 block text-sm font-medium">City</label>
                      <Select
                        value={selectedCity}
                        onValueChange={(val) => {
                          setSelectedCity(val)
                          setSelectedLocation("")
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select city" />
                        </SelectTrigger>
                        <SelectContent>
                          {cities.map((city) => (
                            <SelectItem key={city} value={city}>
                              {city}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {selectedCity && (
                    <div>
                      <label className="mb-2 block text-sm font-medium">Market</label>
                      <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select market" />
                        </SelectTrigger>
                        <SelectContent>
                          {markets.map((market) => (
                            <SelectItem key={market.id} value={market.id}>
                              {market.market_name}
                            </SelectItem>
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

            <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 bg-transparent relative">
                  <Filter className="h-4 w-4" />
                  Filters
                  {activeFiltersCount > 0 && (
                    <Badge variant="destructive" className="absolute -right-2 -top-2 h-5 w-5 rounded-full p-0 text-xs">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Filter Products</DialogTitle>
                  <DialogDescription>Refine your search with these filters</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  {/* Category Filter */}
                  <div>
                    <Label className="mb-2">Category</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All categories</SelectItem>
                        {PRODUCT_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Price Range */}
                  <div className="space-y-3">
                    <Label>Price Range (USD)</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={minPrice}
                          onChange={(e) => setMinPrice(e.target.value)}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          type="number"
                          placeholder="Max"
                          value={maxPrice}
                          onChange={(e) => setMaxPrice(e.target.value)}
                          min="0"
                          step="0.01"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button onClick={() => setFilterDialogOpen(false)} className="flex-1">
                      Apply Filters
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedCategory("")
                        setMinPrice("")
                        setMaxPrice("")
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Active Filters */}
          {activeFiltersCount > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
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
          {filteredProducts.length === 0 ? (
            <div className="flex min-h-[400px] items-center justify-center">
              <div className="text-center">
                <p className="text-lg font-medium text-muted-foreground">
                  {searchQuery || activeFiltersCount > 0 ? "No products found" : "No products available"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchQuery || activeFiltersCount > 0
                    ? "Try adjusting your search or filters"
                    : "Check back soon for new items!"}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => {
                const convertedPrice = convertPrice(product.price, selectedCurrency.code)
                const formattedPrice = formatPrice(convertedPrice, selectedCurrency)

                return (
                  <Card
                    key={product.id}
                    data-product-id={product.id}
                    className="group relative overflow-hidden transition-shadow hover:shadow-lg"
                  >
                    <Link href={`/product/${product.id}`}>
                      {/* Product Image */}
                      <div className="relative aspect-square w-full overflow-hidden bg-muted">
                        {product.image_url ? (
                          <Image
                            src={product.image_url || "/placeholder.svg"}
                            alt={product.name}
                            fill
                            className="object-cover transition-transform group-hover:scale-105"
                            loading="lazy"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <span className="text-sm text-muted-foreground">No image</span>
                          </div>
                        )}

                        <div className="absolute right-2 top-2 flex gap-2">
                          <FavoriteButton productId={product.id} variant="outline" />
                          <ShareButton
                            productId={product.id}
                            productName={product.name}
                            productPrice={product.price}
                            variant="outline"
                          />
                        </div>
                      </div>

                      {/* Product Details */}
                      <div className="p-4">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <h3 className="line-clamp-2 font-semibold text-foreground">{product.name}</h3>
                          <Badge variant={product.in_stock ? "default" : "secondary"} className="shrink-0">
                            {product.in_stock ? "In Stock" : "Out of Stock"}
                          </Badge>
                        </div>

                        {product.description && (
                          <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
                        )}

                        <div className="flex items-center justify-between">
                          <p className="text-lg font-bold text-primary">{formattedPrice}</p>
                          <Badge variant={product.vendor.is_open ? "default" : "outline"}>
                            {product.vendor.is_open ? "Open" : "Closed"}
                          </Badge>
                        </div>

                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-foreground">{product.vendor.shop_name}</p>
                            <VerificationBadge isVerified={product.vendor.is_verified || false} size="sm" />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {product.vendor.location.market_name}, {product.vendor.location.city}
                          </p>
                        </div>

                        {product.vendor.whatsapp_number && (
                          <div className="mt-3" onClick={(e) => e.preventDefault()}>
                            <WhatsAppButton
                              phoneNumber={product.vendor.whatsapp_number}
                              shopName={product.vendor.shop_name}
                              productName={product.name}
                              variant="outline"
                              size="sm"
                              className="w-full"
                            />
                          </div>
                        )}
                      </div>
                    </Link>
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
            <p className="text-sm text-muted-foreground">&copy; 2025 ShoppieApp. All rights reserved.</p>
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
