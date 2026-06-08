import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminEmail, logAuditAction } from "@/lib/admin"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = createAdminClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") ?? "pending"

  const { data: reports, error } = await db
    .from("reports")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    if (error.code === "42P01") return NextResponse.json({ reports: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reports: reports ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: adminUser } } = await supabase.auth.getUser()
  if (!adminUser || !isAdminEmail(adminUser.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { action, reportId } = body
  const db = createAdminClient()

  if (action === "create") {
    const { target_type, target_id, reason, details, reporter_email } = body
    const { data, error } = await db.from("reports").insert({
      target_type, target_id, reason, details,
      reporter_email,
      reporter_id: adminUser.id,
      status: "pending",
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, report: data })
  }

  const newStatus = action === "resolve" ? "resolved" : action === "dismiss" ? "dismissed" : "reviewing"
  const { error } = await db.from("reports").update({
    status: newStatus,
    resolved_by: adminUser.email,
    resolved_at: new Date().toISOString(),
  }).eq("id", reportId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditAction({
    adminId: adminUser.id,
    adminEmail: adminUser.email!,
    action: `report_${action}`,
    targetType: "report",
    targetId: reportId,
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
