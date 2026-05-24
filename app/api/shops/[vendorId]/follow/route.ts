import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
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
