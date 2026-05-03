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

  if (userError || !user) redirect("/vendor/login")

  const { data: vendor, error: vendorError } = await supabase
    .from("vendors")
    .select(`
      id, shop_name, shop_description, whatsapp_number,
      is_open, is_verified, verification_status, verification_expires_at,
      location_id, profile_picture_url,
      locations ( id, country, city, market_name )
    `)
    .eq("user_id", user.id)
    .maybeSingle()

  if (vendorError || !vendor) {
    const signupData = user.user_metadata || {}
    return (
      <SetupShopClient
        userId={user.id}
        userEmail={user.email || ""}
        initialData={{
          shopName: signupData.shop_name || "",
          shopDescription: signupData.shop_description || "",
          country: signupData.country || "",
          city: signupData.city || "",
          marketName: signupData.market_name || "",
        }}
      />
    )
  }

  // ── Fetch products ─────────────────────────────────────────────────────────
  const { data: products } = await supabase
    .from("products")
    .select("id, name, image_url, in_stock, price, created_at")
    .eq("vendor_id", vendor.id)

  const productIds = (products || []).map((p) => p.id)
  const productCount = productIds.length
  const inStockCount = (products || []).filter((p) => p.in_stock).length

  // ── View stats ─────────────────────────────────────────────────────────────
  const now = new Date()
  const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7)
  const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(now.getDate() - 14)

  let totalViews = 0
  let weeklyViews = 0
  let prevWeekViews = 0
  let dailyViews: { date: string; count: number }[] = []
  let topProduct: { id: string; name: string; image_url: string | null; views: number } | null = null

  if (productIds.length > 0) {
    // Total views
    const { count: tc } = await supabase
      .from("product_views").select("*", { count: "exact", head: true })
      .in("product_id", productIds)
    totalViews = tc ?? 0

    // This week views
    const { count: wc } = await supabase
      .from("product_views").select("*", { count: "exact", head: true })
      .in("product_id", productIds)
      .gte("viewed_at", weekAgo.toISOString())
    weeklyViews = wc ?? 0

    // Previous week views (for trend)
    const { count: pwc } = await supabase
      .from("product_views").select("*", { count: "exact", head: true })
      .in("product_id", productIds)
      .gte("viewed_at", twoWeeksAgo.toISOString())
      .lt("viewed_at", weekAgo.toISOString())
    prevWeekViews = pwc ?? 0

    // Daily views for last 7 days
    const { data: rawViews } = await supabase
      .from("product_views")
      .select("viewed_at")
      .in("product_id", productIds)
      .gte("viewed_at", weekAgo.toISOString())

    // Build daily buckets
    const buckets: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      buckets[d.toISOString().slice(0, 10)] = 0
    }
    for (const row of rawViews ?? []) {
      const day = row.viewed_at.slice(0, 10)
      if (day in buckets) buckets[day]++
    }
    dailyViews = Object.entries(buckets).map(([date, count]) => ({ date, count }))

    // Per-product view counts for top product
    const viewsPerProduct: Record<string, number> = {}
    for (const p of products ?? []) viewsPerProduct[p.id] = 0
    const { data: allPvRows } = await supabase
      .from("product_views").select("product_id")
      .in("product_id", productIds)
    for (const row of allPvRows ?? []) {
      viewsPerProduct[row.product_id] = (viewsPerProduct[row.product_id] ?? 0) + 1
    }
    const topId = Object.entries(viewsPerProduct).sort((a, b) => b[1] - a[1])[0]
    if (topId && topId[1] > 0) {
      const p = (products ?? []).find((x) => x.id === topId[0])
      if (p) topProduct = { id: p.id, name: p.name, image_url: p.image_url, views: topId[1] }
    }
  }

  // ── Conversation count ─────────────────────────────────────────────────────
  let conversationCount = 0
  {
    const { count } = await supabase
      .from("conversations").select("*", { count: "exact", head: true })
      .eq("vendor_id", user.id)
    conversationCount = count ?? 0
  }

  // ── Favorites count (across vendor's products) ─────────────────────────────
  let favoritesCount = 0
  if (productIds.length > 0) {
    const { count } = await supabase
      .from("favorites").select("*", { count: "exact", head: true })
      .in("product_id", productIds)
    favoritesCount = count ?? 0
  }

  // ── Build vendor object ───────────────────────────────────────────────────
  const locationData = vendor.locations as { country: string; city: string; market_name: string } | null

  return (
    <DashboardClient
      vendor={{
        id: vendor.id,
        shop_name: vendor.shop_name,
        shop_description: vendor.shop_description || undefined,
        whatsapp_number: vendor.whatsapp_number || undefined,
        location_id: vendor.location_id,
        is_open: vendor.is_open ?? true,
        is_verified: vendor.is_verified || false,
        verification_status: vendor.verification_status || "unverified",
        verification_expires_at: vendor.verification_expires_at || null,
        profile_picture_url: vendor.profile_picture_url || undefined,
        location: {
          name: locationData?.market_name || "Unknown Market",
          city: locationData?.city || "",
          country: locationData?.country || "Unknown",
        },
      }}
      stats={{
        totalViews,
        weeklyViews,
        prevWeekViews,
        productCount,
        inStockCount,
        conversationCount,
        favoritesCount,
        dailyViews,
        topProduct,
      }}
      userId={user.id}
    />
  )
}
