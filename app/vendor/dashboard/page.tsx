import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardClient } from "@/components/dashboard-client"
import { SetupShopClient } from "@/components/setup-shop-client"

export default async function VendorDashboardPage() {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/vendor/login")
  }

  const { data: vendor, error: vendorError } = await supabase
    .from("vendors")
    .select(`
      id,
      shop_name,
      shop_description,
      is_open,
      location_id,
      locations (
        id,
        country,
        city,
        market_name
      )
    `)
    .eq("user_id", user.id)
    .maybeSingle()

  if (vendorError || !vendor) {
    return <SetupShopClient userId={user.id} userEmail={user.email || ""} />
  }

  // Calculate stats
  let totalViews = 0
  let weeklyViews = 0
  let productCount = 0

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  // Get products count
  const { data: products } = await supabase.from("products").select("id").eq("vendor_id", vendor.id)

  if (products) {
    productCount = products.length

    if (products.length > 0) {
      const productIds = products.map((p) => p.id)

      // Get total views
      const { count: totalCount } = await supabase
        .from("product_views")
        .select("*", { count: "exact", head: true })
        .in("product_id", productIds)

      totalViews = totalCount || 0

      // Get weekly views
      const { count: weeklyCount } = await supabase
        .from("product_views")
        .select("*", { count: "exact", head: true })
        .in("product_id", productIds)
        .gte("viewed_at", weekAgo.toISOString())

      weeklyViews = weeklyCount || 0
    }
  }

  // Format vendor data for client
  const locationData = vendor.locations as { country: string; city: string; market_name: string } | null
  const locationName = locationData?.market_name || "Unknown Market"
  const cityName = locationData?.city || ""
  const countryName = locationData?.country || "Unknown Country"

  const vendorData = {
    id: vendor.id,
    shop_name: vendor.shop_name,
    shop_description: vendor.shop_description || undefined,
    location_id: vendor.location_id,
    is_open: vendor.is_open ?? true,
    location: {
      name: locationName,
      city: cityName,
      country: countryName,
    },
  }

  return (
    <DashboardClient
      vendor={vendorData}
      totalViews={totalViews}
      weeklyViews={weeklyViews}
      productCount={productCount}
    />
  )
}
