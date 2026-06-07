"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Store, MapPin, Shield, ChevronRight } from "lucide-react"
import { toSlug } from "@/lib/slug"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AppFooter } from "@/components/app-footer"
import { createBrowserClient } from "@/lib/supabase/client"
import ProfileButton from "@/components/profile-button"
import WhatsAppButton from "@/components/whatsapp-button"
import FavoriteButton from "@/components/favorite-button"
import ShareButton from "@/components/share-button"
import FollowShopButton from "@/components/follow-shop-button"
import { VerificationBadge } from "@/components/verification-badge"
import ProductCarousel from "@/components/product-carousel"
import { useRecentlyViewed } from "@/hooks/use-recently-viewed"
import MessageSellerButton from "@/components/message-seller-button"

interface Location {
  id: string
  country: string
  city: string
  market_name: string
}

interface Vendor {
  id: string
  user_id: string
  shop_name: string
  is_open: boolean
  is_verified?: boolean
  verification_expires_at?: string | null
  whatsapp_number?: string | null
  location?: Location
}

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  category?: string | null
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
  const { addProduct } = useRecentlyViewed()

  // Track product view on mount
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
    // Save to recently viewed for offline access
    addProduct({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      shop_name: product.vendor.shop_name,
    })
  }, [product.id, hasTracked, addProduct, product])

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
            {/* Product Image/Carousel */}
            <ProductCarousel
              images={
                product.image_urls && product.image_urls.length > 0
                  ? product.image_urls
                  : product.image_url
                    ? [product.image_url]
                    : []
              }
              productName={product.name}
              autoSlide={true}
            />

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

              {/* Favorite and Share Buttons */}
              <div className="flex gap-3">
                <FavoriteButton productId={product.id} variant="outline" size="default" showLabel />
                <ShareButton
                  type="product"
                  productId={product.id}
                  productName={product.name}
                  productPrice={product.price}
                  variant="outline"
                  size="default"
                  showLabel
                />
              </div>

              {product.description && (
                <div>
                  <h2 className="mb-2 text-lg font-semibold text-foreground">Description</h2>
                  <p className="text-muted-foreground">{product.description}</p>
                </div>
              )}

              {/* Vendor Info */}
              <Card className="p-4">
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground">Sold by</h3>

                  {/* Shop name — tappable link to shop profile */}
                  <Link
                    href={`/shop/${toSlug(product.vendor.shop_name)}`}
                    className="flex items-center gap-1 group w-fit"
                  >
                    <p className="text-lg font-medium text-primary group-hover:underline">
                      {product.vendor.shop_name}
                    </p>
                    {product.vendor.is_verified && (
                      <VerificationBadge
                        isVerified={product.vendor.is_verified}
                        verificationExpiresAt={product.vendor.verification_expires_at}
                        showProtection
                      />
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors ml-0.5" />
                  </Link>

                  {/* Buyer Protection Notice for Verified Vendors */}
                  {product.vendor.is_verified && (
                    <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                      <Shield className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                      <AlertDescription className="text-sm text-blue-700 dark:text-blue-300">
                        <span className="font-semibold">Buyer Protection:</span> This verified seller is committed to
                        quality service. Issues are resolved with priority support.
                      </AlertDescription>
                    </Alert>
                  )}

                  {product.vendor.location && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        {product.vendor.location.market_name}, {product.vendor.location.city},{" "}
                        {product.vendor.location.country}
                      </span>
                    </div>
                  )}

                  {/* Follow shop */}
                  <FollowShopButton
                    vendorId={product.vendor.id}
                    shopName={product.vendor.shop_name}
                    size="sm"
                    className="pt-1"
                  />

                  {/* Message Seller button */}
                  <div className="pt-1">
                    <MessageSellerButton
                      productId={product.id}
                      vendorId={product.vendor.user_id}
                      variant="default"
                      size="default"
                      className="w-full"
                    />
                  </div>

                  {product.vendor.whatsapp_number && (
                    <div className="pt-2">
                      <WhatsAppButton
                        phoneNumber={product.vendor.whatsapp_number}
                        shopName={product.vendor.shop_name}
                        productName={product.name}
                        className="w-full"
                      />
                    </div>
                  )}

                  {/* Share shop link */}
                  <div className="pt-2">
                    <ShareButton
                      type="shop"
                      vendorId={product.vendor.id}
                      shopName={product.vendor.shop_name}
                      location={
                        product.vendor.location
                          ? `${product.vendor.location.market_name}, ${product.vendor.location.city}`
                          : undefined
                      }
                      variant="outline"
                      size="sm"
                      showLabel
                      className="w-full gap-2"
                    />
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Related Products Section */}
          {relatedProducts.length > 0 && (
            <div className="mt-12">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-foreground">You may also like</h2>
                <Link
                  href={`/shop/${toSlug(product.vendor.shop_name)}`}
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  View shop <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                {relatedProducts.map((relatedProduct) => (
                  <Link key={relatedProduct.id} href={`/product/${relatedProduct.id}`}>
                    <Card className="overflow-hidden transition-shadow hover:shadow-md">
                      <ProductCarousel
                        images={
                          relatedProduct.image_urls && relatedProduct.image_urls.length > 0
                            ? relatedProduct.image_urls
                            : relatedProduct.image_url
                              ? [relatedProduct.image_url]
                              : []
                        }
                        productName={relatedProduct.name}
                        autoSlide={false}
                      />
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

      <AppFooter />
    </>
  )
}
