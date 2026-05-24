"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, MapPin, Store, Package, Users, QrCode } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VerificationBadge } from "@/components/verification-badge"
import FollowShopButton from "@/components/follow-shop-button"
import ProductCarousel from "@/components/product-carousel"
import FavoriteButton from "@/components/favorite-button"
import ShopQRModal from "@/components/shop-qr-modal"

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
  shop_description: string | null
  profile_picture_url: string | null
  is_open: boolean
  is_verified: boolean | null
  verification_expires_at: string | null
  whatsapp_number: string | null
  location: Location | null
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
  created_at: string | null
}

interface ShopProfileClientProps {
  vendor: Vendor
  products: Product[]
  followerCount: number
  isFollowing: boolean
  slug: string
}

export default function ShopProfileClient({
  vendor,
  products,
  followerCount,
  isFollowing,
  slug,
}: ShopProfileClientProps) {
  const router = useRouter()
  const [qrOpen, setQrOpen] = useState(false)

  const shopUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/shop/${slug}`
      : `https://shoppieapp.co.zw/shop/${slug}`

  const isActivelyVerified =
    !!vendor.is_verified &&
    (!vendor.verification_expires_at ||
      new Date(vendor.verification_expires_at).getTime() >= Date.now())

  const location = vendor.location

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9 shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Link href="/" className="flex items-center gap-2 mr-auto">
            <Store className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground">ShoppieApp</span>
          </Link>

          <Button
            onClick={() => setQrOpen(true)}
            className="gap-2 rounded-full bg-gradient-to-r from-pink-500 to-violet-600 text-white hover:from-pink-600 hover:to-violet-700 shadow-md"
            size="sm"
          >
            <QrCode className="h-4 w-4" />
            Share Shop
          </Button>
        </div>
      </header>

      {/* Shop Hero */}
      <div className="relative border-b border-border bg-muted/30 px-4 py-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start gap-4">
            {/* Profile picture */}
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-border bg-background shadow-sm">
              {vendor.profile_picture_url ? (
                <Image
                  src={vendor.profile_picture_url}
                  alt={vendor.shop_name}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary/10">
                  <Store className="h-8 w-8 text-primary" />
                </div>
              )}
            </div>

            {/* Shop info */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-foreground leading-tight">
                  {vendor.shop_name}
                </h1>
                {isActivelyVerified && (
                  <VerificationBadge
                    isVerified={true}
                    verificationExpiresAt={vendor.verification_expires_at}
                    showProtection={false}
                  />
                )}
              </div>

              {/* Location + City */}
              {location && (
                <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium text-foreground">{location.city}</span>
                  <span className="text-muted-foreground">·</span>
                  <span>{location.market_name}</span>
                </div>
              )}

              {/* Status badges */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={vendor.is_open ? "default" : "outline"} className="text-[10px]">
                  {vendor.is_open ? "Open Now" : "Closed"}
                </Badge>
                {isActivelyVerified && (
                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-[10px] border-0">
                    Verified Seller
                  </Badge>
                )}
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {followerCount.toLocaleString()} {followerCount === 1 ? "follower" : "followers"}
                </span>
              </div>
            </div>
          </div>

          {/* Shop description */}
          {vendor.shop_description && (
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              {vendor.shop_description}
            </p>
          )}

          {/* Follow button */}
          <div className="mt-4">
            <FollowShopButton
              vendorId={vendor.id}
              shopName={vendor.shop_name}
              initialIsFollowing={isFollowing}
              initialFollowerCount={followerCount}
              showCount={false}
            />
          </div>
        </div>
      </div>

      {/* Products section */}
      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              All Products
              <span className="text-sm font-normal text-muted-foreground">
                ({products.length})
              </span>
            </h2>
          </div>

          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No products listed yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Check back soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product, index) => (
                <Link key={product.id} href={`/product/${product.id}`}>
                  <div className="group relative flex flex-col overflow-hidden rounded-xl bg-card cursor-pointer">
                    {/* Image */}
                    <div className="relative overflow-hidden rounded-xl">
                      <div className="transition-transform duration-500 ease-out group-hover:scale-[1.03]">
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
                          priority={index < 4}
                          aspectClass="aspect-[3/4]"
                        />
                      </div>

                      {/* Badges */}
                      <div className="absolute left-1.5 top-1.5 flex flex-col items-start gap-1">
                        {!product.in_stock && (
                          <span className="rounded-sm bg-black/75 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                            Sold Out
                          </span>
                        )}
                      </div>

                      {/* Wishlist heart */}
                      <div
                        className="absolute right-1.5 top-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FavoriteButton productId={product.id} variant="ghost" />
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="flex flex-col gap-0.5 px-1 pt-2 pb-2.5">
                      <p className="text-sm font-bold text-primary leading-tight">
                        ${product.price.toFixed(2)}
                      </p>
                      <h3 className="line-clamp-2 text-[12px] leading-snug text-foreground/90 group-hover:text-primary transition-colors">
                        {product.name}
                      </h3>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <ShopQRModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        shopUrl={shopUrl}
        shopName={vendor.shop_name}
      />
    </div>
  )
}
