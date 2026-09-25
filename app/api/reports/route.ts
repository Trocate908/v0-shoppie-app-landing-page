import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { asAdmin, asUser } from "@/lib/supabase/dynamic"
import {
  MAX_DETAILS_LENGTH,
  MAX_REPORTS_PER_HOUR,
  REPORT_REASONS,
  REPORT_TARGET_TYPES,
  TARGET_TYPES_REQUIRING_ID,
  type ReportTargetType,
} from "@/lib/feedback"

type ReportRow = {
  id: string
  target_type: string
  target_id: string
  reason: string
  details: string | null
  status: string
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

function isMissingTable(error: { code?: string } | null): boolean {
  return !!error && (error.code === "42P01" || error.code === "PGRST205")
}

const NOT_SET_UP =
  "Reporting is not set up yet. Ask an admin to run DB Setup."

/** The caller's own reports, so they can follow what they submitted. */
export async function GET() {
  const supabase = asUser(await createClient())
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ reports: [] })

  const db = asAdmin(createAdminClient())
  const { data, error } = await db
    .from("reports")
    .select("id, target_type, target_id, reason, details, status, resolved_by, resolved_at, created_at")
    .eq("reporter_id", user.id)
    .order("created_at", { ascending: false })
    .limit(25)

  if (isMissingTable(error)) return NextResponse.json({ reports: [] })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ reports: (data ?? []) as ReportRow[] })
}

export async function POST(req: NextRequest) {
  const supabase = asUser(await createClient())
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const body = await req.json().catch(() => ({}))
  const targetType = body.target_type as ReportTargetType
  const targetId = typeof body.target_id === "string" ? body.target_id.trim() : ""
  const reason = typeof body.reason === "string" ? body.reason.trim() : ""
  const details = typeof body.details === "string" ? body.details.trim() : ""
  const contactEmail = typeof body.email === "string" ? body.email.trim().slice(0, 120) : ""

  if (!REPORT_TARGET_TYPES.includes(targetType)) {
    return NextResponse.json({ error: "Pick what you are reporting." }, { status: 400 })
  }

  if (TARGET_TYPES_REQUIRING_ID.includes(targetType) && !targetId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  if (!reason || !REPORT_REASONS.includes(reason as (typeof REPORT_REASONS)[number])) {
    return NextResponse.json({ error: "Please choose a reason." }, { status: 400 })
  }

  if (details.length > MAX_DETAILS_LENGTH) {
    return NextResponse.json(
      { error: `Details must be ${MAX_DETAILS_LENGTH} characters or fewer.` },
      { status: 400 },
    )
  }

  // Guests can leave an email so we can follow up; signed-in users don't need to.
  const reporterEmail = user?.email || contactEmail || null

  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null

  const db = asAdmin(createAdminClient())

  // Spam guard: a handful of reports per hour per person.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  let recentCount = 0

  if (user) {
    const { count } = await db
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("reporter_id", user.id)
      .gte("created_at", oneHourAgo)
    recentCount = count ?? 0
  } else if (ipAddress) {
    const { count } = await db
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("reporter_ip", ipAddress)
      .gte("created_at", oneHourAgo)
    recentCount = count ?? 0
  }

  if (recentCount >= MAX_REPORTS_PER_HOUR) {
    return NextResponse.json(
      { error: "You have sent several reports already. Please try again in an hour." },
      { status: 429 },
    )
  }

  const { error } = await db.from("reports").insert({
    reporter_id: user?.id ?? null,
    reporter_email: reporterEmail,
    reporter_ip: ipAddress,
    target_type: targetType,
    // A general report has no single subject; keep a stable placeholder so the
    // NOT NULL column and the admin "view target" link still behave.
    target_id: targetId || "general",
    reason,
    details: details || null,
    status: "pending",
  })

  if (isMissingTable(error)) {
    return NextResponse.json({ error: NOT_SET_UP }, { status: 503 })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true }, { status: 201 })
}
