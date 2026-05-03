import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import ProductsClient from "@/components/products-client"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, MapPin, Store, ShoppingBag, Tag, Users } from "lucide-react"
import Link from "next/link"
import ProfileButton from "@/components/profile-button"
import Image from "next/image"
import { AppFooter } from "@/components/app-footer"

export const metadata = {
  title: "Products - ShoppieApp",
  description: "Browse products from local vendors",
  alternates: {
    canonical: "https://shoppieapp.co.zw/products",
  },
  robots: {
    index: false,
    follow: true,
  },
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
  created_at: string
  vendor: {
    shop_name: string
    is_open: boolean
    is_verified: boolean
    verification_expires_at?: string | null
  }
}

async function getProducts(locationId: string) {
  const supabase = await createClient()

  const { data: vendors, error: vendorsError } = await supabase
    .from("vendors")
    .select("id, shop_name")
    .eq("location_id", locationId)

  if (vendorsError || !vendors || vendors.length === 0) return []

  const vendorIds = vendors.map((v) => v.id)

  const { data, error } = await supabase
    .from("products")
    .select(`
      id,
      name,
      description,
      price,
      category,
      image_url,
      image_urls,
      in_stock,
      created_at,
      vendor:vendors!inner(
        shop_name,
        is_open,
        is_verified,
        verification_expires_at
      )
    `)
    .in("vendor_id", vendorIds)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching products:", error)
    return []
  }

  return (data || []) as unknown as Product[]
}

async function getTrendingIds(): Promise<string[]> {
  const supabase = await createClient()
  try {
    const { data, error } = await supabase.rpc("get_trending_products", { limit_count: 50 })
    if (error || !Array.isArray(data)) return []
    return data
      .map((row: { product_id?: string }) => row.product_id)
      .filter((v): v is string => typeof v === "string")
  } catch {
    return []
  }
}

async function getLocationName(locationId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("locations")
    .select("country, city, market_name")
    .eq("id", locationId)
    .single()
  if (error) return null
  return data
}

function ProductsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-3 overflow-hidden">
        {[...Array(7)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-28 shrink-0 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
            <Skeleton className="aspect-[4/3] w-full" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-5 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>
}) {
  const params = await searchParams
  const locationId = params.location

  if (!locationId) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 bg-background">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 text-center shadow-md">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <MapPin className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">No Location Selected</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Please select a location to browse local products and vendors.
          </p>
          <Link
            href="/locations"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow transition-opacity hover:opacity-90"
          >
            <ArrowLeft className="h-4 w-4" />
            Pick a location
          </Link>
        </div>
      </div>
    )
  }

  const [products, location, trendingIds] = await Promise.all([
    getProducts(locationId),
    getLocationName(locationId),
    getTrendingIds(),
  ])

  const vendorCount = new Set(products.map((p) => p.vendor.shop_name)).size
  const inStockCount = products.filter((p) => p.in_stock).length
  const categoryCount = new Set(products.map((p) => p.category).filter(Boolean)).size

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ── Top nav ── */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative h-8 w-8 overflow-hidden rounded-xl ring-1 ring-border shadow-sm">
              <Image src="/logo.png" alt="ShoppieApp" fill className="object-cover" />
            </div>
            <span className="text-lg font-extrabold tracking-tight text-foreground">ShoppieApp</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/locations"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Change location</span>
              <span className="sm:hidden">Change</span>
            </Link>
            <ProfileButton />
          </div>
        </div>
      </header>

      {/* ── Hero / Market banner ── */}
      {location && (
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-primary/15 via-primary/5 to-background">
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-primary/8 blur-2xl" />

          <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                {/* Location pill */}
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
                  <MapPin className="h-3.5 w-3.5" />
                  {location.city}, {location.country}
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                  {location.market_name}
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Your local marketplace — browse fresh listings from nearby vendors
                </p>
              </div>

              {/* Stats row */}
              <div className="flex gap-3 sm:shrink-0">
                <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card/80 px-4 py-3 shadow-sm backdrop-blur min-w-[72px]">
                  <ShoppingBag className="mb-1 h-4 w-4 text-primary" />
                  <p className="text-lg font-extrabold text-foreground leading-none">{products.length}</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Products</p>
                </div>
                <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card/80 px-4 py-3 shadow-sm backdrop-blur min-w-[72px]">
                  <Users className="mb-1 h-4 w-4 text-primary" />
                  <p className="text-lg font-extrabold text-foreground leading-none">{vendorCount}</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Vendors</p>
                </div>
                <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card/80 px-4 py-3 shadow-sm backdrop-blur min-w-[72px]">
                  <Tag className="mb-1 h-4 w-4 text-primary" />
                  <p className="text-lg font-extrabold text-foreground leading-none">{categoryCount}</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Categories</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Suspense fallback={<ProductsSkeleton />}>
            <ProductsClient products={products} trendingIds={trendingIds} />
          </Suspense>
        </div>
      </main>

      <AppFooter />
    </div>
  )
}
