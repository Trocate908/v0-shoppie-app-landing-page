import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import BrowseProductsClient from "@/components/browse-products-client"
import { Skeleton } from "@/components/ui/skeleton"
import { headers } from "next/headers"

export const metadata = {
  title: "Browse All Products - ShoppieApp",
  description: "Discover products from vendors across all locations",
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
    location: {
      id: string
      country: string
      city: string
      market_name: string
    }
  }
}

async function getVisitorCountry(): Promise<string | null> {
  try {
    const headersList = await headers()
    const forwarded = headersList.get("x-forwarded-for")
    const ip = forwarded ? forwarded.split(",")[0] : headersList.get("x-real-ip") || "8.8.8.8"

    // Use ip-api.com (free, no API key needed)
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=country`, {
      cache: "no-store",
    })

    if (!response.ok) return null

    const data = await response.json()
    return data.country || null
  } catch (error) {
    console.error("[v0] Error detecting visitor country:", error)
    return null
  }
}

async function getAllProducts() {
  const supabase = await createClient()

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
        id,
        shop_name,
        is_open,
        location:locations!inner(
          id,
          country,
          city,
          market_name
        )
      )
    `)
    .eq("in_stock", true)
    .order("name")

  if (error) {
    console.error("[v0] Error fetching products:", error)
    return []
  }

  return (data || []) as unknown as Product[]
}

async function getAllLocations() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("locations")
    .select("id, country, city, market_name")
    .order("country")
    .order("city")
    .order("market_name")

  if (error) {
    console.error("[v0] Error fetching locations:", error)
    return []
  }

  return data || []
}

function ProductsSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-4">
          <Skeleton className="aspect-square w-full rounded-md" />
          <Skeleton className="mt-3 h-5 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/2" />
        </div>
      ))}
    </div>
  )
}

export default async function BrowsePage() {
  const [products, locations, visitorCountry] = await Promise.all([
    getAllProducts(),
    getAllLocations(),
    getVisitorCountry(),
  ])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Suspense fallback={<ProductsSkeleton />}>
        <BrowseProductsClient products={products} locations={locations} visitorCountry={visitorCountry} />
      </Suspense>
    </div>
  )
}
