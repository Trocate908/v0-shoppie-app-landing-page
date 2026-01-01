"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Store, MapPin } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import ProfileButton from "@/components/profile-button"
import WhatsAppButton from "@/components/whatsapp-button"
import ProductCarousel from "@/components/product-carousel"

interface Location {
  id: string
  country: string
  city: string
  market_name: string
}

interface Vendor {
  id: string
  shop_name: string
  is_open: boolean
  whatsapp_number?: string | null
  location?: Location
}

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  image_urls?: string[] | null
  in_stock: boolean
  vendor: Vendor
}

interface ProductDetailClientProps {
  product: Product
  relatedProducts: Product[]
}

export default function ProductDetailClient({ product, relatedProducts }: ProductDetailClientProps) {
  const router = useRouter()
  const [hasTracked, setHasTracked] = useState(false)

  useEffect(() => {
    if (!hasTracked) {
      const trackView = async () => {
        try {
          const supabase = createBrowserClient()
          await supabase.from("product_views").insert({ product_id: product.id })
          setHasTracked(true)
        } catch (error) {
          console.error("Error tracking view:", error)
        }
      }
      trackView()
    }
  }, [product.id, hasTracked])

  const getProductImages = (p: Product): string[] => {
    if (p.image_urls && p.image_urls.length > 0) {
      return p.image_urls
    }
    if (p.image_url) {
      return [p.image_url]
    }
    return []
  }

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Link href="/" className="flex items-center gap-2">
                <Store className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold text-foreground">ShoppieApp</h1>
              </Link>
            </div>
            <ProfileButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Product Detail Section */}
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="overflow-hidden rounded-lg">
              <ProductCarousel
                images={getProductImages(product)}
                productName={product.name}
                aspectRatio="square"
                showArrows={true}
                autoPlay={true}
                autoPlayInterval={5000}
              />
            </div>

            {/* Product Info */}
            <div className="space-y-6">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant={product.in_stock ? "default" : "secondary"}>
                    {product.in_stock ? "In Stock" : "Out of Stock"}
                  </Badge>
                  <Badge variant={product.vendor.is_open ? "default" : "outline"}>
                    {product.vendor.is_open ? "Shop Open" : "Shop Closed"}
                  </Badge>
                </div>
                <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{product.name}</h1>
              </div>

              <div>
                <p className="text-3xl font-bold text-primary">${product.price.toFixed(2)}</p>
              </div>

              {product.description && (
                <div>
                  <h2 className="mb-2 text-lg font-semibold text-foreground">Description</h2>
                  <p className="text-muted-foreground">{product.description}</p>
                </div>
              )}

              {/* Vendor Info */}
              <Card className="p-4">
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">Sold by</h3>
                  <p className="text-lg font-medium text-primary">{product.vendor.shop_name}</p>
                  {product.vendor.location && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        {product.vendor.location.market_name}, {product.vendor.location.city},{" "}
                        {product.vendor.location.country}
                      </span>
                    </div>
                  )}
                  {product.vendor.whatsapp_number && (
                    <div className="pt-3">
                      <WhatsAppButton
                        phoneNumber={product.vendor.whatsapp_number}
                        shopName={product.vendor.shop_name}
                        productName={product.name}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>

          {/* Related Products Section */}
          {relatedProducts.length > 0 && (
            <div className="mt-12">
              <h2 className="mb-6 text-2xl font-bold text-foreground">More from {product.vendor.shop_name}</h2>
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                {relatedProducts.map((relatedProduct) => (
                  <Link key={relatedProduct.id} href={`/product/${relatedProduct.id}`}>
                    <Card className="overflow-hidden transition-shadow hover:shadow-md">
                      <ProductCarousel
                        images={getProductImages(relatedProduct)}
                        productName={relatedProduct.name}
                        aspectRatio="square"
                        showArrows={false}
                        autoPlay={false}
                      />

                      {/* Product Details */}
                      <div className="p-3">
                        <h3 className="mb-1 line-clamp-2 text-sm font-semibold text-foreground">
                          {relatedProduct.name}
                        </h3>
                        <p className="text-base font-bold text-primary">${relatedProduct.price.toFixed(2)}</p>
                        <Badge variant={relatedProduct.in_stock ? "default" : "secondary"} className="mt-2 text-xs">
                          {relatedProduct.in_stock ? "In Stock" : "Out of Stock"}
                        </Badge>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
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
