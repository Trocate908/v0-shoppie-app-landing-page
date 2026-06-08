import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminEmail, logAuditAction } from "@/lib/admin"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = createAdminClient()
  const { data: vendors, error } = await db
    .from("vendors")
    .select(`id, user_id, shop_name, shop_description, is_open, is_verified, verification_status, profile_picture_url, created_at, locations(city, country, market_name)`)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: counts } = await db.from("products").select("vendor_id")
  const productCounts = new Map<string, number>()
  counts?.forEach(p => {
    productCounts.set(p.vendor_id, (productCounts.get(p.vendor_id) ?? 0) + 1)
  })

  const result = vendors?.map(v => ({
    ...v,
    product_count: productCounts.get(v.id) ?? 0,
  })) ?? []

  return NextResponse.json({ vendors: result })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: adminUser } } = await supabase.auth.getUser()
  if (!adminUser || !isAdminEmail(adminUser.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { action, vendorId } = await req.json()
  const db = createAdminClient()

  if (action === "verify") {
    const { error } = await db.from("vendors").update({ is_verified: true, verification_status: "verified" }).eq("id", vendorId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (action === "unverify") {
    const { error } = await db.from("vendors").update({ is_verified: false, verification_status: "unverified" }).eq("id", vendorId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (action === "suspend") {
    const { error } = await db.from("vendors").update({ is_open: false }).eq("id", vendorId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (action === "reopen") {
    const { error } = await db.from("vendors").update({ is_open: true }).eq("id", vendorId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (action === "delete") {
    const { error } = await db.from("vendors").delete().eq("id", vendorId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }

  await logAuditAction({
    adminId: adminUser.id,
    adminEmail: adminUser.email!,
    action: `vendor_${action}`,
    targetType: "vendor",
    targetId: vendorId,
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
