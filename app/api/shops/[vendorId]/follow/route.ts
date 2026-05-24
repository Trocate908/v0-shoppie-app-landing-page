import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { dispatchNotification } from "@/lib/notifications/dispatch"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

type Params = { params: Promise<{ vendorId: string }> }

// GET — check follow status + count
export async function GET(_req: Request, { params }: Params) {
  const { vendorId } = await params
  const supabase = await createServerClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [countResult, followResult] = await Promise.all([
    adminSupabase
      .from("shop_follows")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", vendorId),
    user
      ? adminSupabase
          .from("shop_follows")
          .select("id")
          .eq("vendor_id", vendorId)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return NextResponse.json({
    isFollowing: !!(followResult.data),
    followerCount: countResult.count ?? 0,
  })
}

// POST — follow a shop
export async function POST(_req: Request, { params }: Params) {
  const { vendorId } = await params
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const adminSupabase = createAdminClient()

  const { error } = await adminSupabase
    .from("shop_follows")
    .upsert({ user_id: user.id, vendor_id: vendorId }, { onConflict: "user_id,vendor_id" })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { count } = await adminSupabase
    .from("shop_follows")
    .select("id", { count: "exact", head: true })
    .eq("vendor_id", vendorId)

  // Notify the shop owner in the background — don't block the response
  Promise.all([
    // Get the vendor's user_id and shop name
    adminSupabase
      .from("vendors")
      .select("user_id, shop_name")
      .eq("id", vendorId)
      .single(),
    // Get the follower's display name
    adminSupabase
      .from("profiles")
      .select("full_name, username")
      .eq("id", user.id)
      .maybeSingle(),
  ]).then(([{ data: vendor }, { data: profile }]) => {
    if (!vendor?.user_id) return

    const followerName =
      profile?.full_name ??
      profile?.username ??
      user.email?.split("@")[0] ??
      "Someone"

    const newCount = count ?? 0
    const followerLabel = newCount === 1 ? "1 follower" : `${newCount.toLocaleString()} followers`

    return dispatchNotification(
      { userId: vendor.user_id },
      {
        type: "custom",
        refId: `shop-follow-${vendorId}-${user.id}`,
        dedupeWindowHours: 0,
        title: `${followerName} followed your shop!`,
        body: `You now have ${followerLabel}. Keep posting great products!`,
        link: `/?tab=settings`,
      },
    )
  }).catch((err) => console.error("[shop-follow] vendor notify failed:", err))

  return NextResponse.json({ isFollowing: true, followerCount: count ?? 0 })
}

// DELETE — unfollow a shop
export async function DELETE(_req: Request, { params }: Params) {
  const { vendorId } = await params
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const adminSupabase = createAdminClient()

  await adminSupabase
    .from("shop_follows")
    .delete()
    .eq("vendor_id", vendorId)
    .eq("user_id", user.id)

  const { count } = await adminSupabase
    .from("shop_follows")
    .select("id", { count: "exact", head: true })
    .eq("vendor_id", vendorId)

  return NextResponse.json({ isFollowing: false, followerCount: count ?? 0 })
}
