import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminEmail, logAuditAction } from "@/lib/admin"
import { dispatchNotification, type DispatchTarget } from "@/lib/notifications/dispatch"
import { getPushConfigStatus } from "@/lib/push/server"

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

  return NextResponse.json({ logs: data ?? [], pushConfig: getPushConfigStatus() })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: adminUser } } = await supabase.auth.getUser()
  if (!adminUser || !isAdminEmail(adminUser.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null) as {
    title?: string
    message?: string
    target?: "all" | "vendors" | "buyers" | "verified_vendors"
    type?: string
    url?: string
  } | null

  if (!body?.title?.trim() || !body.message?.trim()) {
    return NextResponse.json({ error: "Title and message required" }, { status: 400 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_KEY) {
    return NextResponse.json(
      { error: "Supabase service-role credentials are required for cross-user notification dispatch." },
      { status: 500 },
    )
  }

  const pushConfig = getPushConfigStatus()
  if (!pushConfig.hasPublicKey || !pushConfig.hasPrivateKey) {
    return NextResponse.json(
      { error: "Web Push is not configured. VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are required." },
      { status: 500 },
    )
  }

  const allowedTargets = ["all", "vendors", "buyers", "verified_vendors"] as const
  const target = body.target ?? "all"
  if (!allowedTargets.includes(target)) {
    return NextResponse.json({ error: "Invalid target audience" }, { status: 400 })
  }

  const dispatchTarget: DispatchTarget =
    target === "vendors"
      ? { audience: "all_vendors" }
      : target === "buyers"
        ? { audience: "all_shoppers" }
        : target === "verified_vendors"
          ? { audience: "all_vendors_verified" }
          : { audience: "all" }

  const title = body.title.trim()
  const message = body.message.trim()
  const url = body.url?.trim() || undefined
  const result = await dispatchNotification(dispatchTarget, {
    type: "custom",
    title,
    body: message,
    link: url,
    data: {
      notification_type: body.type ?? "admin_broadcast",
      admin_broadcast: "true",
    },
    dedupeWindowHours: 0,
  })

  const db = createAdminClient()
  const logEntry = {
    title,
    message,
    target_audience: target,
    notification_type: body.type ?? "admin_broadcast",
    recipients: result.pushed,
    sent_by: adminUser.email!,
    url: url ?? null,
  }
  const { error: logError } = await db
    .from("notifications_log")
    .insert(logEntry as never)

  if (logError) {
    console.error("[admin notifications] failed to log dispatch", logError)
  }

  await logAuditAction({
    adminId: adminUser.id,
    adminEmail: adminUser.email!,
    action: "send_notification",
    targetType: "audience",
    targetId: target,
    details: { title, type: body.type ?? "admin_broadcast", ...result },
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
  })

  return NextResponse.json({ ok: true, ...result })
}
