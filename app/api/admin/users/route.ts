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
    .from("users")
    .select("id, email, full_name, avatar_url, is_banned, created_at, phone")
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { action, userId } = await req.json()
  const db = createAdminClient()

  if (action === "ban") {
    const { error } = await db.from("users").update({ is_banned: true }).eq("id", userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logAuditAction({ adminId: user.id, adminEmail: user.email!, action: "ban_user", targetType: "user", targetId: userId })
  } else if (action === "unban") {
    const { error } = await db.from("users").update({ is_banned: false }).eq("id", userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logAuditAction({ adminId: user.id, adminEmail: user.email!, action: "unban_user", targetType: "user", targetId: userId })
  } else if (action === "delete") {
    const { error } = await db.from("users").delete().eq("id", userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logAuditAction({ adminId: user.id, adminEmail: user.email!, action: "delete_user", targetType: "user", targetId: userId })
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
