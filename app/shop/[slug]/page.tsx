import { notFound, redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { createServerClient } from "@/lib/supabase/server"
import { toSlug, isUUID } from "@/lib/slug"
import ShopProfileClient from "@/components/shop-profile-client"

export const revalidate = 60

interface Props {
  params: Promise<{ slug: string }>
}

async function resolveVendorId(slug: string): Promise<{ id: string; redirectToSlug?: string } | null> {
  const admin = createAdminClient()

  if (isUUID(slug)) {
    const { data } = await admin
      .from("vendors")
      .select("id, shop_name")
      .eq("id", slug)
      .single()
    if (!data) return null
    return { id: data.id, redirectToSlug: toSlug(data.shop_name) }
  }

  const { data: vendors } = await admin.from("vendors").select("id, shop_name")
  if (!vendors || vendors.length === 0) return null
  const match = vendors.find((v) => toSlug(v.shop_name) === slug)
  if (!match) return null
  return { id: match.id }
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const resolved = await resolveVendorId(slug)
  if (!resolved) return { title: "Shop not found — ShoppieApp" }

  const admin = createAdminClient()
  const { data } = await admin
    .from("vendors")
    .select("shop_name, shop_description, location:locations(city)")
    .eq("id", resolved.id)
    .single()

  if (!data) return { title: "Shop — ShoppieApp" }
  const city = (data.location as { city: string } | null)?.city
  return {
    title: `${data.shop_name}${city ? ` · ${city}` : ""} — ShoppieApp`,
    description: data.shop_description ?? `Browse all products from ${data.shop_name} on ShoppieApp`,
  }
}

export default async function ShopPage({ params }: Props) {
  const { slug } = await params
  const resolved = await resolveVendorId(slug)

  if (!resolved) notFound()
  if (resolved.redirectToSlug) redirect(`/shop/${resolved.redirectToSlug}`)

  const vendorId = resolved.id
  const admin = createAdminClient()
  const supabase = await createServerClient()

  const [
    { data: vendor, error: vendorErr },
    { data: products },
    { count: followerCount },
  ] = await Promise.all([
    admin
      .from("vendors")
      .select(`
        id, user_id, shop_name, shop_description, profile_picture_url,
        is_open, is_verified, verification_expires_at, whatsapp_number,
        location:locations(id, country, city, market_name)
      `)
      .eq("id", vendorId)
      .single(),

    admin
      .from("products")
      .select("id, name, description, price, category, image_url, image_urls, in_stock, created_at")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false }),

    admin
      .from("shop_follows")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", vendorId),
  ])

  if (vendorErr || !vendor) notFound()

  let isFollowing = false
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: follow } = await admin
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
      slug={slug}
    />
  )
}
