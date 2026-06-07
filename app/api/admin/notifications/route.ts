import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail, logAuditAction } from "@/lib/admin"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { title, message, audience, imageUrl } = await req.json()
  if (!title || !message) return NextResponse.json({ error: "title and message are required" }, { status: 400 })

  const appId = process.env.ONESIGNAL_APP_ID
  const apiKey = process.env.ONESIGNAL_REST_API_KEY
  if (!appId || !apiKey) return NextResponse.json({ error: "OneSignal not configured" }, { status: 500 })

  const filters = audience === "vendors"
    ? [{ field: "tag", key: "role", relation: "=", value: "vendor" }]
    : audience === "buyers"
    ? [{ field: "tag", key: "role", relation: "!=", value: "vendor" }]
    : audience === "verified"
    ? [{ field: "tag", key: "verified", relation: "=", value: "true" }]
    : undefined

  const body: Record<string, unknown> = {
    app_id: appId,
    headings: { en: title },
    contents: { en: message },
    ...(filters ? { filters } : { included_segments: ["All"] }),
    ...(imageUrl ? { big_picture: imageUrl } : {}),
  }

  const res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${apiKey}` },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!res.ok) return NextResponse.json({ error: data.errors?.[0] ?? "Failed to send" }, { status: 500 })

  await logAuditAction({
    adminId: user.id, adminEmail: user.email!,
    action: "send_notification",
    details: { title, audience, recipients: data.recipients },
  })

  return NextResponse.json({ ok: true, recipients: data.recipients })
}
