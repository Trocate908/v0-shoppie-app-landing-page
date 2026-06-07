import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminEmail, logAuditAction } from "@/lib/admin"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const status = new URL(req.url).searchParams.get("status") ?? "pending"
  const db = createAdminClient()

  const { data, error } = await db
    .from("reports")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error?.code === "42P01") return NextResponse.json({ reports: [] })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { action, reportId } = await req.json()
  const db = createAdminClient()
  const newStatus = action === "resolve" ? "resolved" : "dismissed"

  const { error } = await db.from("reports").update({
    status: newStatus,
    resolved_by: user.email,
    resolved_at: new Date().toISOString(),
  }).eq("id", reportId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAuditAction({ adminId: user.id, adminEmail: user.email!, action: `${newStatus}_report`, targetType: "report", targetId: reportId })
  return NextResponse.json({ ok: true })
}
