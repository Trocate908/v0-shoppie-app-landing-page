import { notFound } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { createServerClient } from "@/lib/supabase/server"
import ShopProfileClient from "@/components/shop-profile-client"

type Props = { params: Promise<{ vendorId: string }> }

export async function generateMetadata({ params }: Props) {
  const { vendorId } = await params
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("vendors")
    .select("shop_name, shop_description, location:locations(city)")
    .eq("id", vendorId)
    .single()

  if (!data) return { title: "Shop — ShoppieApp" }

  const city = (data.location as { city: string } | null)?.city
  return {
    title: `${data.shop_name}${city ? ` · ${city}` : ""} — ShoppieApp`,
    description: data.shop_description ?? `Browse all products from ${data.shop_name} on ShoppieApp`,
  }
}

export default async function ShopPage({ params }: Props) {
  const { vendorId } = await params
  const adminSupabase = createAdminClient()
  const supabase = await createServerClient()

  // Fetch vendor, products, follow count + current user follow status in parallel
  const [
    { data: vendor, error: vendorErr },
    { data: products },
    { count: followerCount },
  ] = await Promise.all([
    adminSupabase
      .from("vendors")
      .select("id, user_id, shop_name, shop_description, profile_picture_url, is_open, is_verified, verification_expires_at, whatsapp_number, location:locations(id, country, city, market_name)")
      .eq("id", vendorId)
      .single(),

    adminSupabase
      .from("products")
      .select("id, name, description, price, category, image_url, image_urls, in_stock, created_at")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false }),

    adminSupabase
      .from("shop_follows")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", vendorId),
  ])

  if (vendorErr || !vendor) notFound()

  // Check if current user follows this shop
  let isFollowing = false
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: follow } = await adminSupabase
      .from("shop_follows")
      .select("id")
      .eq("vendor_id", vendorId)
      .eq("user_id", user.id)
      .maybeSingle()
    isFollowing = !!follow
  }

  return (
    <ShopProfileClient
      vendor={vendor as Parameters<typeof ShopProfileClient>[0]["vendor"]}
      products={(products ?? []) as Parameters<typeof ShopProfileClient>[0]["products"]}
      followerCount={followerCount ?? 0}
      isFollowing={isFollowing}
    />
  )
}
