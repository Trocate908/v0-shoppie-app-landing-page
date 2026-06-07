import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminEmail, logAuditAction } from "@/lib/admin"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = createAdminClient()
  const { data, error } = await db.from("platform_settings").select("*")

  if (error?.code === "42P01") return NextResponse.json({ settings: [] })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { key, value } = await req.json()
  const db = createAdminClient()

  const { error } = await db.from("platform_settings").upsert({
    key, value, updated_by: user.email, updated_at: new Date().toISOString(),
  }, { onConflict: "key" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAuditAction({ adminId: user.id, adminEmail: user.email!, action: "update_setting", targetType: "setting", targetId: key, details: { value } })
  return NextResponse.json({ ok: true })
}
