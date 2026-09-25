import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { asAdmin, asUser } from "@/lib/supabase/dynamic"
import { isAdminEmail, logAuditAction } from "@/lib/admin"
import { SUGGESTION_STATUS_VALUES } from "@/lib/feedback"

function isMissingTable(error: { code?: string } | null): boolean {
  return !!error && (error.code === "42P01" || error.code === "PGRST205")
}

async function requireAdminUser() {
  const supabase = asUser(await createClient())
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user && isAdminEmail(user.email) ? user : null
}

export async function GET(req: NextRequest) {
  const adminUser = await requireAdminUser()
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = asAdmin(createAdminClient())
  const { searchParams } = new URL(req.url)

  // Sidebar badge only needs the tallies.
  if (searchParams.get("counts") === "1") {
    const counts: Record<string, number> = {}
    for (const status of SUGGESTION_STATUS_VALUES) {
      const { count } = await db
        .from("suggestions")
        .select("id", { count: "exact", head: true })
        .eq("status", status)
      counts[status] = count ?? 0
    }
    return NextResponse.json({ counts })
  }

  const status = searchParams.get("status")
  let query = db.from("suggestions").select("*")

  if (status && status !== "all" && SUGGESTION_STATUS_VALUES.includes(status)) {
    query = query.eq("status", status)
  }

  const { data, error } = await query
    .order("votes", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200)

  if (isMissingTable(error)) return NextResponse.json({ suggestions: [] })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ suggestions: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const adminUser = await requireAdminUser()
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { id, action } = body
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }

  const db = asAdmin(createAdminClient())
  const ipAddress = req.headers.get("x-forwarded-for") ?? undefined

  if (action === "delete") {
    const { error } = await db.from("suggestions").delete().eq("id", id)
    if (isMissingTable(error)) return NextResponse.json({ ok: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAuditAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email!,
      action: "delete_suggestion",
      targetType: "suggestion",
      targetId: id,
      ipAddress,
    })
    return NextResponse.json({ ok: true })
  }

  if (action === "status") {
    const status = body.status
    if (typeof status !== "string" || !SUGGESTION_STATUS_VALUES.includes(status)) {
      return NextResponse.json({ error: "Unknown status" }, { status: 400 })
    }

    const { error } = await db
      .from("suggestions")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (isMissingTable(error)) return NextResponse.json({ error: "Suggestions table not set up yet." }, { status: 503 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAuditAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email!,
      action: "suggestion_status",
      targetType: "suggestion",
      targetId: id,
      details: { status },
      ipAddress,
    })
    return NextResponse.json({ ok: true, status })
  }

  if (action === "note") {
    const note = typeof body.adminNote === "string" ? body.adminNote.trim().slice(0, 1000) : ""

    const { error } = await db
      .from("suggestions")
      .update({ admin_note: note || null, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (isMissingTable(error)) return NextResponse.json({ error: "Suggestions table not set up yet." }, { status: 503 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAuditAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email!,
      action: "suggestion_note",
      targetType: "suggestion",
      targetId: id,
      ipAddress,
    })
    return NextResponse.json({ ok: true, adminNote: note })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
