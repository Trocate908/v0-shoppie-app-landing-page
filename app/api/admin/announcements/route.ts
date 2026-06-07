import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminEmail, logAuditAction } from "@/lib/admin"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = createAdminClient()
  const { data, error } = await db
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    if (error.code === "42P01") return NextResponse.json({ announcements: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ announcements: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: adminUser } } = await supabase.auth.getUser()
  if (!adminUser || !isAdminEmail(adminUser.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const db = createAdminClient()

  if (body.action === "create") {
    const { title, message, target_audience, expires_at } = body
    if (!title || !message) return NextResponse.json({ error: "Title and message required" }, { status: 400 })

    const { data, error } = await db.from("announcements").insert({
      title,
      message,
      target_audience: target_audience ?? "all",
      expires_at: expires_at || null,
      created_by: adminUser.id,
      is_active: true,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAuditAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email!,
      action: "create_announcement",
      targetType: "announcement",
      targetId: data?.id,
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    })
    return NextResponse.json({ ok: true, announcement: data })
  }

  if (body.action === "delete") {
    const { error } = await db.from("announcements").delete().eq("id", body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logAuditAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email!,
      action: "delete_announcement",
      targetType: "announcement",
      targetId: body.id,
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
