import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import ProductsClient from "@/components/products-client"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, MapPin, Store } from "lucide-react"
import Link from "next/link"
import ProfileButton from "@/components/profile-button"
import Image from "next/image"

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

  if (vendorsError || !vendors || vendors.length === 0) {
    return []
  }

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
  // The RPC was created in scripts/001_notifications_setup.sql.
  // It returns top-viewed product IDs over the last 7 days. If anything
  // goes wrong we just degrade gracefully — trending becomes "no results".
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

  if (error) {
    return null
  }

  return data
}

function ProductsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
            <Skeleton className="aspect-square w-full" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-5 w-1/3" />
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
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-foreground">No Location Selected</h1>
          <p className="mt-2 text-sm text-muted-foreground">Please select a location to view products.</p>
          <Link
            href="/locations"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Select Location
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="relative h-8 w-8 overflow-hidden rounded-lg ring-1 ring-border">
              <Image src="/logo.png" alt="ShoppieApp" fill className="object-cover" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">ShoppieApp</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/locations"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Change location</span>
              <span className="sm:hidden">Change</span>
            </Link>
            <ProfileButton />
          </div>
        </div>
      </header>

      {/* Hero / location banner */}
      <section className="border-b border-border bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {location && (
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                  <MapPin className="h-3 w-3" />
                  {location.city}, {location.country}
                </div>
                <h1 className="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {location.market_name}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {products.length}{" "}
                  {products.length === 1 ? "product" : "products"} from local vendors
                </p>
              </div>
              <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                <Store className="h-6 w-6 text-primary" />
              </div>
            </div>
          )}
        </div>
      </section>

      <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Suspense fallback={<ProductsSkeleton />}>
            <ProductsClient products={products} trendingIds={trendingIds} />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
