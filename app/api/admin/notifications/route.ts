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
    .from("notifications_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    if (error.code === "42P01") return NextResponse.json({ logs: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ logs: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: adminUser } } = await supabase.auth.getUser()
  if (!adminUser || !isAdminEmail(adminUser.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { title, message, target, type, url } = await req.json()
  if (!title || !message) return NextResponse.json({ error: "Title and message required" }, { status: 400 })

  const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID
  const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY

  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    return NextResponse.json({ error: "OneSignal not configured — ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY must be set" }, { status: 500 })
  }

  // Build OneSignal payload
  const payload: Record<string, unknown> = {
    app_id: ONESIGNAL_APP_ID,
    headings: { en: title },
    contents: { en: message },
    data: { type: type ?? "admin_broadcast", admin_broadcast: true },
  }

  if (url) payload.url = url

  // Target segments or filters
  if (target === "all") {
    payload.included_segments = ["All"]
  } else if (target === "vendors") {
    payload.filters = [{ field: "tag", key: "user_type", relation: "=", value: "vendor" }]
  } else if (target === "buyers") {
    payload.filters = [{ field: "tag", key: "user_type", relation: "=", value: "buyer" }]
  } else if (target === "verified_vendors") {
    payload.filters = [
      { field: "tag", key: "user_type", relation: "=", value: "vendor" },
      { operator: "AND" },
      { field: "tag", key: "verified", relation: "=", value: "true" },
    ]
  } else {
    payload.included_segments = ["All"]
  }

  const onesignalRes = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
    },
    body: JSON.stringify(payload),
  })

  const onesignalData = await onesignalRes.json()

  if (!onesignalRes.ok) {
    const errMsg = Array.isArray(onesignalData.errors)
      ? onesignalData.errors.join(", ")
      : onesignalData.errors ?? "OneSignal API error"
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }

  const recipients = onesignalData.recipients ?? 0

  // Store in notifications log
  const db = createAdminClient()
  await db.from("notifications_log").insert({
    title,
    message,
    target_audience: target ?? "all",
    notification_type: type ?? "admin_broadcast",
    recipients,
    onesignal_id: onesignalData.id ?? null,
    sent_by: adminUser.email,
    url: url ?? null,
  }).catch(() => {})

  await logAuditAction({
    adminId: adminUser.id,
    adminEmail: adminUser.email!,
    action: "send_notification",
    targetType: "audience",
    targetId: target ?? "all",
    details: { title, type, recipients, onesignal_id: onesignalData.id },
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
  })

  return NextResponse.json({ ok: true, recipients, onesignal_id: onesignalData.id })
}
