import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import BrowseProductsClient from "@/components/browse-products-client"
import { Skeleton } from "@/components/ui/skeleton"

// Enable static generation with revalidation
export const revalidate = 60 // Revalidate every 60 seconds

export const metadata = {
  title: "Browse All Products - ShoppieApp",
  description: "Discover products from vendors across all locations",
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
  vendor: {
    id: string
    shop_name: string
    is_open: boolean
    is_verified?: boolean
    verification_expires_at?: string | null
    whatsapp_number?: string | null
    location: {
      id: string
      country: string
      city: string
      market_name: string
    }
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
      category,
      image_url,
      image_urls,
      in_stock,
      vendor:vendors!inner(
        id,
        shop_name,
        is_open,
        is_verified,
        verification_expires_at,
        whatsapp_number,
        location:locations!inner(
          id,
          country,
          city,
          market_name
        )
      )
    `)
    .eq("in_stock", true)
    .order("created_at", { ascending: false })
    .limit(200) // Optimized limit for better performance

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
  const [products, locations] = await Promise.all([
    getAllProducts(),
    getAllLocations(),
  ])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Suspense fallback={<ProductsSkeleton />}>
        <BrowseProductsClient products={products} locations={locations} visitorCountry={null} />
      </Suspense>
    </div>
  )
}
