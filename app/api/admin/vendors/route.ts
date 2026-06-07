import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminEmail, logAuditAction } from "@/lib/admin"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = createAdminClient()
  const { data, error } = await db
    .from("vendors")
    .select("id, shop_name, shop_description, is_open, is_suspended, verification_status, created_at, user_id, locations(city, country)")
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ vendors: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { action, vendorId } = await req.json()
  const db = createAdminClient()

  if (action === "suspend") {
    const { error } = await db.from("vendors").update({ is_suspended: true }).eq("id", vendorId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logAuditAction({ adminId: user.id, adminEmail: user.email!, action: "suspend_vendor", targetType: "vendor", targetId: vendorId })
  } else if (action === "unsuspend") {
    const { error } = await db.from("vendors").update({ is_suspended: false }).eq("id", vendorId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logAuditAction({ adminId: user.id, adminEmail: user.email!, action: "unsuspend_vendor", targetType: "vendor", targetId: vendorId })
  } else if (action === "verify") {
    const { error } = await db.from("vendors").update({ verification_status: "verified" }).eq("id", vendorId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logAuditAction({ adminId: user.id, adminEmail: user.email!, action: "verify_vendor", targetType: "vendor", targetId: vendorId })
  } else if (action === "unverify") {
    const { error } = await db.from("vendors").update({ verification_status: "unverified" }).eq("id", vendorId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logAuditAction({ adminId: user.id, adminEmail: user.email!, action: "unverify_vendor", targetType: "vendor", targetId: vendorId })
  } else if (action === "delete") {
    const { error } = await db.from("vendors").delete().eq("id", vendorId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logAuditAction({ adminId: user.id, adminEmail: user.email!, action: "delete_vendor", targetType: "vendor", targetId: vendorId })
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
