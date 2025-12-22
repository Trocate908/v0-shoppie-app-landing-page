import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import ProductsClient from "@/components/products-client"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Store } from "lucide-react"
import Link from "next/link"
import ProfileButton from "@/components/profile-button"

export const metadata = {
  title: "Products - ShoppieApp",
  description: "Browse products from local vendors",
}

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
      image_url,
      in_stock,
      vendor:vendors!inner(
        shop_name,
        is_open
      )
    `)
    .in("vendor_id", vendorIds)
    .order("name")

  if (error) {
    console.error("Error fetching products:", error)
    return []
  }

  return (data || []) as unknown as Product[]
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-4">
          <Skeleton className="aspect-square w-full rounded-md" />
          <Skeleton className="mt-3 h-5 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/2" />
        </div>
      ))}
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

  const [products, location] = await Promise.all([getProducts(locationId), getLocationName(locationId)])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Store className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">ShoppieApp</h1>
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href="/locations"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Change Location</span>
              </Link>
              <ProfileButton />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {location && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">{location.market_name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {location.city}, {location.country}
              </p>
            </div>
          )}

          <Suspense fallback={<ProductsSkeleton />}>
            <ProductsClient products={products} />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
