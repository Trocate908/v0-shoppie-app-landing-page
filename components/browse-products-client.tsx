"use client"

import { useState, useMemo, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Search, MapPin, Store, X } from "lucide-react"
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
import ProfileButton from "@/components/profile-button"

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
  image_url: string | null
  in_stock: boolean
  vendor: {
    id: string
    shop_name: string
    is_open: boolean
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
  visitorCountry,
}: BrowseProductsClientProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCountry, setSelectedCountry] = useState<string>("")
  const [selectedCity, setSelectedCity] = useState<string>("")
  const [selectedLocation, setSelectedLocation] = useState<string>("")
  const [locationDialogOpen, setLocationDialogOpen] = useState(false)
  const [trackedViews, setTrackedViews] = useState<Set<string>>(new Set())

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
        (product) => product.name.toLowerCase().includes(query) || product.description?.toLowerCase().includes(query),
      )
    }

    // Filter by selected location
    if (selectedLocation) {
      filtered = filtered.filter((product) => product.vendor.location.id === selectedLocation)
    }

    return filtered
  }, [sortedProducts, searchQuery, selectedLocation])

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

  const selectedLocationData = locations.find((l) => l.id === selectedLocation)

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
            <ProfileButton />
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
          </div>

          {/* Active Location Filter */}
          {selectedLocationData && (
            <div className="mb-4 flex items-center gap-2">
              <Badge variant="secondary" className="gap-2 py-2 pr-2">
                <MapPin className="h-3 w-3" />
                {selectedLocationData.market_name}, {selectedLocationData.city}, {selectedLocationData.country}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 hover:bg-transparent"
                  onClick={clearLocationFilter}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            </div>
          )}

          {/* Products Grid */}
          {filteredProducts.length === 0 ? (
            <div className="flex min-h-[400px] items-center justify-center">
              <div className="text-center">
                <p className="text-lg font-medium text-muted-foreground">
                  {searchQuery || selectedLocation ? "No products found" : "No products available"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchQuery || selectedLocation
                    ? "Try adjusting your search or filters"
                    : "Check back soon for new items!"}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => (
                <Link key={product.id} href={`/product/${product.id}`}>
                  <Card
                    data-product-id={product.id}
                    className="overflow-hidden transition-shadow hover:shadow-md cursor-pointer"
                  >
                    {/* Product Image */}
                    <div className="relative aspect-square w-full overflow-hidden bg-muted">
                      {product.image_url ? (
                        <Image
                          src={product.image_url || "/placeholder.svg"}
                          alt={product.name}
                          fill
                          className="object-cover"
                          loading="lazy"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <span className="text-sm text-muted-foreground">No image</span>
                        </div>
                      )}
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
                        <p className="text-lg font-bold text-primary">${product.price.toFixed(2)}</p>
                        <Badge variant={product.vendor.is_open ? "default" : "outline"}>
                          {product.vendor.is_open ? "Open" : "Closed"}
                        </Badge>
                      </div>

                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium text-foreground">{product.vendor.shop_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.vendor.location.market_name}, {product.vendor.location.city}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
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
