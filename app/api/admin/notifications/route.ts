import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail, logAuditAction } from "@/lib/admin"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: adminUser } } = await supabase.auth.getUser()
  if (!adminUser || !isAdminEmail(adminUser.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { title, message, target, type } = await req.json()
  if (!title || !message) return NextResponse.json({ error: "Title and message required" }, { status: 400 })

  const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID
  const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY

  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    return NextResponse.json({ error: "OneSignal not configured" }, { status: 500 })
  }

  const filters = target === "all"
    ? [{ field: "tag", key: "user_type", relation: "exists" }]
    : target === "vendors"
    ? [{ field: "tag", key: "user_type", relation: "=", value: "vendor" }]
    : target === "buyers"
    ? [{ field: "tag", key: "user_type", relation: "=", value: "buyer" }]
    : [{ field: "tag", key: "verified", relation: "=", value: "true" }]

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    headings: { en: title },
    contents: { en: message },
    included_segments: target === "all" ? ["All"] : undefined,
    filters: target !== "all" ? filters : undefined,
    data: { type, admin_broadcast: true },
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
    return NextResponse.json({ error: onesignalData.errors?.[0] ?? "OneSignal error" }, { status: 500 })
  }

  await logAuditAction({
    adminId: adminUser.id,
    adminEmail: adminUser.email!,
    action: "send_notification",
    targetType: "audience",
    targetId: target,
    details: { title, type, recipients: onesignalData.recipients },
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
  })

  return NextResponse.json({ ok: true, recipients: onesignalData.recipients })
}
