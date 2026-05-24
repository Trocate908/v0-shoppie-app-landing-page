import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

type Params = { params: Promise<{ vendorId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { vendorId } = await params

  const supabase = await createServerClient()
  const adminSupabase = createAdminClient()

  // Fetch vendor details + location
  const { data: vendor, error: vendorErr } = await adminSupabase
    .from("vendors")
    .select("id, user_id, shop_name, shop_description, profile_picture_url, is_open, is_verified, verification_expires_at, whatsapp_number, location:locations(id, country, city, market_name)")
    .eq("id", vendorId)
    .single()

  if (vendorErr || !vendor) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 })
  }

  // Fetch all vendor products + follower count in parallel
  const [productsResult, followersResult, followResult] = await Promise.all([
    adminSupabase
      .from("products")
      .select("id, name, description, price, category, image_url, image_urls, in_stock, created_at")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false }),

    adminSupabase
      .from("shop_follows")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", vendorId),

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return { data: null }
      return adminSupabase
        .from("shop_follows")
        .select("id")
        .eq("vendor_id", vendorId)
        .eq("user_id", user.id)
        .maybeSingle()
    }),
  ])

  return NextResponse.json({
    vendor,
    products: productsResult.data ?? [],
    followerCount: followersResult.count ?? 0,
    isFollowing: !!(followResult.data),
  })
}
