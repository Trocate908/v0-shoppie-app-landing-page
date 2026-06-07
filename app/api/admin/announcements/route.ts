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
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100)

  if (error?.code === "42P01") return NextResponse.json({ announcements: [] })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ announcements: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const db = createAdminClient()

  if (body.action === "delete") {
    const { error } = await db.from("announcements").delete().eq("id", body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === "toggle") {
    const { error } = await db.from("announcements").update({ is_active: body.is_active }).eq("id", body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const { title, message, target_audience, expires_at } = body
  const { error } = await db.from("announcements").insert({
    title, message, target_audience: target_audience ?? "all",
    expires_at: expires_at || null,
    created_by: user.id,
    is_active: true,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAuditAction({ adminId: user.id, adminEmail: user.email!, action: "create_announcement", targetType: "announcement", details: { title } })
  return NextResponse.json({ ok: true })
}
