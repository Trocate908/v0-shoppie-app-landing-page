import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminEmail, logAuditAction } from "@/lib/admin"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = createAdminClient()
  const { data: settings, error } = await db.from("platform_settings").select("*").order("key")
  if (error) {
    if (error.code === "42P01") return NextResponse.json({ settings: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ settings: settings ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: adminUser } } = await supabase.auth.getUser()
  if (!adminUser || !isAdminEmail(adminUser.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { key, value } = await req.json()
  if (!key) return NextResponse.json({ error: "Key is required" }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db.from("platform_settings").upsert({
    key,
    value: String(value),
    updated_by: adminUser.email,
    updated_at: new Date().toISOString(),
  }, { onConflict: "key" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditAction({
    adminId: adminUser.id,
    adminEmail: adminUser.email!,
    action: "update_setting",
    targetType: "setting",
    targetId: key,
    details: { value },
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
