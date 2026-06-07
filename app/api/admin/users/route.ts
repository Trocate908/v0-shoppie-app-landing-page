import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminEmail, logAuditAction } from "@/lib/admin"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = createAdminClient()
  const { data: { users }, error } = await db.auth.admin.listUsers({ perPage: 1000 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get vendor info for each user
  const { data: vendors } = await db.from("vendors").select("user_id, shop_name, is_verified, verification_status")
  const vendorMap = new Map(vendors?.map(v => [v.user_id, v]) ?? [])

  const result = users.map(u => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    email_confirmed_at: u.email_confirmed_at,
    banned_until: u.banned_until,
    user_metadata: u.user_metadata,
    vendor: vendorMap.get(u.id) ?? null,
    is_admin: isAdminEmail(u.email),
  }))

  return NextResponse.json({ users: result })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: adminUser } } = await supabase.auth.getUser()
  if (!adminUser || !isAdminEmail(adminUser.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { action, userId, value } = await req.json()
  const db = createAdminClient()

  let result: Record<string, unknown> = {}
  let actionDesc = action

  if (action === "ban") {
    const banUntil = new Date()
    banUntil.setFullYear(banUntil.getFullYear() + 100)
    const { error } = await db.auth.admin.updateUserById(userId, { ban_duration: "876000h" })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    actionDesc = "ban_user"
  } else if (action === "unban") {
    const { error } = await db.auth.admin.updateUserById(userId, { ban_duration: "none" })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    actionDesc = "unban_user"
  } else if (action === "delete") {
    const { error } = await db.auth.admin.deleteUser(userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    actionDesc = "delete_user"
  } else if (action === "verify_email") {
    const { error } = await db.auth.admin.updateUserById(userId, { email_confirm: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    actionDesc = "verify_email"
  } else if (action === "reset_password") {
    const { data: targetUser } = await db.auth.admin.getUserById(userId)
    if (!targetUser?.user?.email) return NextResponse.json({ error: "User not found" }, { status: 404 })
    const { error } = await supabase.auth.resetPasswordForEmail(targetUser.user.email)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    actionDesc = "reset_password"
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }

  await logAuditAction({
    adminId: adminUser.id,
    adminEmail: adminUser.email!,
    action: actionDesc,
    targetType: "user",
    targetId: userId,
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
  })

  return NextResponse.json({ ok: true, ...result })
}
