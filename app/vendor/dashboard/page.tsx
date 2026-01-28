import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardClient } from "@/components/dashboard-client"
import { SetupShopClient } from "@/components/setup-shop-client"

export default async function VendorDashboardPage() {
  const supabase = await createClient()

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
      whatsapp_number,
      is_open,
      is_verified,
      verification_status,
      verification_expires_at,
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

  let totalViews = 0
  let weeklyViews = 0
  let productCount = 0

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const { data: products } = await supabase.from("products").select("id").eq("vendor_id", vendor.id)

  if (products) {
    productCount = products.length

    if (products.length > 0) {
      const productIds = products.map((p) => p.id)

      const { count: totalCount } = await supabase
        .from("product_views")
        .select("*", { count: "exact", head: true })
        .in("product_id", productIds)

      totalViews = totalCount || 0

      const { count: weeklyCount } = await supabase
        .from("product_views")
        .select("*", { count: "exact", head: true })
        .in("product_id", productIds)
        .gte("viewed_at", weekAgo.toISOString())

      weeklyViews = weeklyCount || 0
    }
  }

  const locationData = vendor.locations as { country: string; city: string; market_name: string } | null
  const locationName = locationData?.market_name || "Unknown Market"
  const cityName = locationData?.city || ""
  const countryName = locationData?.country || "Unknown Country"

  const vendorData = {
    id: vendor.id,
    shop_name: vendor.shop_name,
    shop_description: vendor.shop_description || undefined,
    whatsapp_number: vendor.whatsapp_number || undefined,
    location_id: vendor.location_id,
    is_open: vendor.is_open ?? true,
    is_verified: vendor.is_verified || false,
    verification_status: vendor.verification_status || "unverified",
    verification_expires_at: vendor.verification_expires_at || null,
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
