"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Store, MapPin, Heart } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import ProfileButton from "@/components/profile-button"
import FavoriteButton from "@/components/favorite-button"
import ShareButton from "@/components/share-button"
import WhatsAppButton from "@/components/whatsapp-button"

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
  location: Location
}

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  category: string | null
  image_url: string | null
  in_stock: boolean
  vendor: Vendor
}

interface WishlistClientProps {
  products: Product[]
}

export default function WishlistClient({ products }: WishlistClientProps) {
  const router = useRouter()

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
              <Button variant="ghost" size="sm" onClick={() => router.push("/browse")}>
                Browse
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
          <div className="mb-6 flex items-center gap-3">
            <Heart className="h-8 w-8 text-red-500" />
            <div>
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">My Wishlist</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {products.length} {products.length === 1 ? "item" : "items"} saved
              </p>
            </div>
          </div>

          {/* Products Grid */}
          {products.length === 0 ? (
            <div className="flex min-h-[400px] items-center justify-center">
              <div className="text-center">
                <Heart className="mx-auto h-16 w-16 text-muted-foreground/50" />
                <p className="mt-4 text-lg font-medium text-muted-foreground">Your wishlist is empty</p>
                <p className="mt-1 text-sm text-muted-foreground">Start adding products you love!</p>
                <Button variant="default" className="mt-4" onClick={() => router.push("/browse")}>
                  Browse Products
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <Card key={product.id} className="group relative overflow-hidden transition-shadow hover:shadow-lg">
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

                      {/* Action Buttons */}
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
                      <div className="mb-2 flex flex-wrap gap-1">
                        <Badge variant={product.in_stock ? "default" : "secondary"} className="text-xs">
                          {product.in_stock ? "In Stock" : "Out of Stock"}
                        </Badge>
                        {product.category && (
                          <Badge variant="outline" className="text-xs">
                            {product.category}
                          </Badge>
                        )}
                      </div>

                      <h3 className="mb-2 line-clamp-2 text-base font-semibold text-foreground">{product.name}</h3>

                      {product.description && (
                        <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
                      )}

                      <p className="mb-3 text-lg font-bold text-primary">${product.price.toFixed(2)}</p>

                      {/* Vendor Info */}
                      <div className="space-y-2 border-t border-border pt-3">
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">{product.vendor.shop_name}</span>
                          <Badge variant={product.vendor.is_open ? "default" : "outline"} className="ml-auto text-xs">
                            {product.vendor.is_open ? "Open" : "Closed"}
                          </Badge>
                        </div>
                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                          <span>
                            {product.vendor.location.market_name}, {product.vendor.location.city}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>

                  {/* WhatsApp Button */}
                  {product.vendor.whatsapp_number && (
                    <div className="border-t border-border p-3">
                      <WhatsAppButton
                        phoneNumber={product.vendor.whatsapp_number}
                        shopName={product.vendor.shop_name}
                        productName={product.name}
                        size="sm"
                        className="w-full"
                      />
                    </div>
                  )}
                </Card>
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
