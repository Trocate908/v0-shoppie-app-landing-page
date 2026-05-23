import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { Skeleton } from "@/components/ui/skeleton"
import AppShell from "@/components/app-shell"

export const revalidate = 120

export const metadata = {
  title: "ShoppieApp - Find Local Products Near You",
  description: "Connect with local vendors and discover products in your area",
  alternates: {
    canonical: "https://shoppieapp.co.zw",
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
  created_at: string | null
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
      id, name, description, price, category, image_url, image_urls, in_stock, created_at,
      vendor:vendors!inner(
        id, shop_name, is_open, is_verified, verification_expires_at, whatsapp_number,
        location:locations!inner(id, country, city, market_name)
      )
    `)
    .eq("in_stock", true)
    .order("created_at", { ascending: false })
    .limit(60)

  if (error) return []
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

  if (error) return []
  return data || []
}

function StoreSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 p-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-3">
          <Skeleton className="aspect-square w-full rounded-md" />
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

export default async function RootPage() {
  const [products, locations] = await Promise.all([getAllProducts(), getAllLocations()])

  return (
    <Suspense fallback={<StoreSkeleton />}>
      <AppShell products={products} locations={locations} />
    </Suspense>
  )
}
