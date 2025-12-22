"use client"

import { useState, useMemo, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Search } from "lucide-react"
import Image from "next/image"
import { createBrowserClient } from "@/lib/supabase/client"

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  in_stock: boolean
  vendor: {
    shop_name: string
    is_open: boolean
  }
}

interface ProductsClientProps {
  products: Product[]
}

export default function ProductsClient({ products }: ProductsClientProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [trackedViews, setTrackedViews] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  // Filter products based on search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products

    const query = searchQuery.toLowerCase()
    return products.filter((product) => product.name.toLowerCase().includes(query))
  }, [products, searchQuery])

  // Track product views
  const trackProductView = async (productId: string) => {
    // Only track once per session
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

  // Track views when products come into view
  useEffect(() => {
    try {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const productId = entry.target.getAttribute("data-product-id")
              if (productId) {
                trackProductView(productId)
              }
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

  if (products.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-muted-foreground">No products available in this market yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Check back soon for new items!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <p className="text-muted-foreground">No products found matching "{searchQuery}"</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              data-product-id={product.id}
              className="overflow-hidden transition-shadow hover:shadow-md"
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

                <p className="mt-2 text-xs text-muted-foreground">{product.vendor.shop_name}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
