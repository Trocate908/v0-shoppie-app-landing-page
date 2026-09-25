import { notFound, redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { createServerClient } from "@/lib/supabase/server"
import { toSlug, isUUID } from "@/lib/slug"
import ShopProfileClient from "@/components/shop-profile-client"

export const revalidate = 60

interface Props {
  params: Promise<{ slug: string }>
}

async function resolveVendor(param: string) {
  const admin = createAdminClient()

  // Legacy UUID URL
  if (isUUID(param)) {
    const { data } = await admin
      .from("vendors")
      .select(`
        id,
        slug,
        user_id,
        shop_name,
        shop_description,
        profile_picture_url,
        is_open,
        is_verified,
        verification_expires_at,
        whatsapp_number,
        location:locations(
          id,
          country,
          city,
          market_name
        )
      `)
      .eq("id", param)
      .single()

    return data ?? null
  }

  // Preferred short slug URL
  const { data } = await admin
    .from("vendors")
    .select(`
      id,
      slug,
      user_id,
      shop_name,
      shop_description,
      profile_picture_url,
      is_open,
      is_verified,
      verification_expires_at,
      whatsapp_number,
      location:locations(
        id,
        country,
        city,
        market_name
      )
    `)
    .eq("slug", param)
    .single()

  // Backwards compatibility for vendors whose slug has not yet
  // been populated in the database.
  if (!data) {
    const { data: vendors } = await admin
      .from("vendors")
      .select(`
        id,
        slug,
        user_id,
        shop_name,
        shop_description,
        profile_picture_url,
        is_open,
        is_verified,
        verification_expires_at,
        whatsapp_number,
        location:locations(
          id,
          country,
          city,
          market_name
        )
      `)

    const match = vendors?.find(
      (vendor) => toSlug(vendor.shop_name) === param
    )

    return match ?? null
  }

  return data
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const vendor = await resolveVendor(slug)

  if (!vendor) {
    return {
      title: "Shop not found — ShoppieApp",
    }
  }

  const city = (
    vendor.location as { city: string } | null
  )?.city

  return {
    title: `${vendor.shop_name}${city ? ` · ${city}` : ""} — ShoppieApp`,
    description:
      vendor.shop_description ??
      `Browse all products from ${vendor.shop_name} on ShoppieApp`,
    alternates: {
      canonical: `https://shoppieapp.co.zw/shop/${vendor.slug ?? toSlug(vendor.shop_name)}`,
    },
  }
}

export default async function ShopPage({ params }: Props) {
  const { slug } = await params
  const vendor = await resolveVendor(slug)

  if (!vendor) {
    notFound()
  }

  // If someone uses an old UUID URL, redirect to the clean slug URL.
  if (isUUID(slug)) {
    const cleanSlug = vendor.slug ?? toSlug(vendor.shop_name)

    if (cleanSlug && cleanSlug !== slug) {
      redirect(`/shop/${cleanSlug}`)
    }
  }

  const admin = createAdminClient()
  const supabase = await createServerClient()

  const [
    { data: products },
    { count: followerCount },
  ] = await Promise.all([
    admin
      .from("products")
      // `*` so the optional discount columns flow through once
      // supabase/migrations/add_product_discounts.sql has been applied.
      .select("*")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false }),

    admin
      .from("shop_follows")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", vendor.id),
  ])

  // Check whether the current user follows this shop.
  let isFollowing = false

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: follow } = await admin
      .from("shop_follows")
      .select("id")
      .eq("vendor_id", vendor.id)
      .eq("user_id", user.id)
      .maybeSingle()

    isFollowing = !!follow
  }

  const cleanSlug = vendor.slug ?? toSlug(vendor.shop_name)

  return (
    <ShopProfileClient
      vendor={
        vendor as Parameters<typeof ShopProfileClient>[0]["vendor"]
      }
      products={
        (products ?? []) as Parameters<
          typeof ShopProfileClient
        >[0]["products"]
      }
      followerCount={followerCount ?? 0}
      isFollowing={isFollowing}
      slug={cleanSlug}
    />
  )
}