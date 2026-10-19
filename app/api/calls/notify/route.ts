import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendWebPushToSubscriptions, type WebPushMessage } from "@/lib/push/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST /api/calls/notify — { callId, kind?: "ring" | "missed" }
//
// The caller's browser asks us to push a notification to the callee's devices.
// It is only sent when the callee is NOT actively in the app: their client
// heartbeats public.user_presence every 30s while visible, and a fresh beat
// means the in-app ring overlay is already on screen (see
// components/call-provider.tsx and supabase/migrations/add_user_presence.sql).
//
//   kind "ring"   → "Incoming call from X" with a short TTL, because an
//                   undelivered ring is worthless after the 60s ring window.
//   kind "missed" → replaces the ring notification once the ring times out or
//                   is cancelled, so the callee's shade never shows a call
//                   that is no longer live.
//
// Only the caller of record may trigger either push, and each is sent at most
// once per call (deduped through notification_sends). Failures here never
// affect call setup — the caller fires this best-effort.

type AdminClient = Omit<ReturnType<typeof createAdminClient>, "from"> & {
  from: (table: string) => any
}

type CallRow = {
  id: string
  conversation_id: string
  caller_id: string
  callee_id: string
  status: string
  created_at: string
}

const SITE_URL = "https://shoppieapp.co.zw"
/** Heartbeat cadence is 30s; anything fresher than this counts as "in app". */
const IN_APP_WINDOW_MS = 45_000
/** Mirrors the 60s server-side ring guard, plus delivery slack. */
const RING_TTL_SECONDS = 90
/** A missed call stays informative for a while after the ring dies. */
const MISSED_TTL_SECONDS = 3_600
/** Statuses from which a "missed call" update is worth sending. */
const UNANSWERED_STATUSES = new Set(["missed", "cancelled", "failed"])

async function wasRecentlyInApp(
  admin: AdminClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("user_presence")
    .select("last_seen_at")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) {
    // Fail open: until supabase/migrations/add_user_presence.sql is applied
    // the callee should still be notified rather than silently missed.
    const missingTable =
      error.code === "42P01" || String(error.message).includes("user_presence")
    if (!missingTable) {
      console.warn("[calls/notify] presence lookup failed:", error.message)
    }
    return false
  }
  const lastSeen = data ? Date.parse(data.last_seen_at as string) : NaN
  return Number.isFinite(lastSeen) && Date.now() - lastSeen < IN_APP_WINDOW_MS
}

async function resolveCallerName(
  admin: AdminClient,
  callerId: string,
): Promise<string> {
  // Same identity ladder the chat UI uses: shop name, then profile, then email.
  const { data: vendor } = await admin
    .from("vendors")
    .select("shop_name")
    .eq("user_id", callerId)
    .maybeSingle()
  if (vendor?.shop_name) return vendor.shop_name as string

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, username")
    .eq("id", callerId)
    .maybeSingle()
  const profileName = profile?.full_name ?? profile?.username
  if (profileName) return profileName as string

  try {
    const { data: auth } = await admin.auth.admin.getUserById(callerId)
    const email = auth?.user?.email
    if (email) return email.split("@")[0]
  } catch {
    // fall through
  }
  return "Someone"
}

async function alreadySent(
  admin: AdminClient,
  type: string,
  callId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 10 * 60_000).toISOString()
  const { data } = await admin
    .from("notification_sends")
    .select("id")
    .eq("type", type)
    .eq("ref_id", callId)
    .gte("sent_at", since)
    .limit(1)
  return (data ?? []).length > 0
}

async function markSent(
  admin: AdminClient,
  type: string,
  callId: string,
  userId: string,
): Promise<void> {
  const { error } = await admin.from("notification_sends").insert({
    user_id: userId,
    device_id: null,
    type,
    ref_id: callId,
  })
  if (error) {
    console.warn("[calls/notify] could not record send:", error.message)
  }
}

async function pushToCallee(
  admin: AdminClient,
  calleeId: string,
  msg: WebPushMessage,
): Promise<number> {
  const { data: rows, error } = await admin
    .from("push_tokens")
    .select("token")
    .eq("user_id", calleeId)
    .eq("enabled", true)
  if (error) {
    console.error("[calls/notify] token lookup failed:", error.message)
    return 0
  }
  const tokens = ((rows ?? []) as Array<{ token: string }>).map((row) => row.token)
  if (tokens.length === 0) return 0

  const { successCount, invalidTokens } = await sendWebPushToSubscriptions(
    tokens,
    msg,
  )
  if (invalidTokens.length > 0) {
    await admin.from("push_tokens").delete().in("token", invalidTokens)
  }
  return successCount
}

function skipped(reason: string) {
  return NextResponse.json({ sent: false, reason })
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    callId?: unknown
    kind?: unknown
  } | null
  const callId = typeof body?.callId === "string" ? body.callId : ""
  const kind = body?.kind ?? "ring"
  if (!callId || (kind !== "ring" && kind !== "missed")) {
    return NextResponse.json(
      { error: "callId and kind (ring|missed) are required" },
      { status: 400 },
    )
  }

  const admin = createAdminClient() as AdminClient
  const { data, error: callError } = await admin
    .from("calls")
    .select("id, conversation_id, caller_id, callee_id, status, created_at")
    .eq("id", callId)
    .maybeSingle()
  if (callError) {
    console.error("[calls/notify] call lookup failed:", callError.message)
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
  const call = data as CallRow | null
  if (!call) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  // Pushes flow caller → callee only; nobody else may trigger them.
  if (call.caller_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (kind === "ring") {
    if (call.status !== "ringing") return skipped("not_ringing")
    if (Date.now() - Date.parse(call.created_at) > 60_000) {
      return skipped("expired")
    }
    if (await wasRecentlyInApp(admin, call.callee_id)) return skipped("in_app")
    if (await alreadySent(admin, "call_ring", callId)) {
      return skipped("already_sent")
    }

    const name = await resolveCallerName(admin, call.caller_id)
    const pushed = await pushToCallee(admin, call.callee_id, {
      title: `Incoming call from ${name}`,
      body: "Open ShoppieApp to answer.",
      link: `${SITE_URL}/?tab=messages&cid=${call.conversation_id}`,
      data: {
        tag: `call-${callId}`,
        callId,
        conversationId: call.conversation_id,
      },
      ttlSeconds: RING_TTL_SECONDS,
    })
    if (pushed > 0) await markSent(admin, "call_ring", callId, call.callee_id)
    return NextResponse.json({ sent: pushed > 0, pushed })
  }

  // kind === "missed": replace the callee's stale ring notification.
  if (!UNANSWERED_STATUSES.has(call.status)) return skipped("still_live")
  if (await wasRecentlyInApp(admin, call.callee_id)) return skipped("in_app")
  if (await alreadySent(admin, "call_missed", callId)) {
    return skipped("already_sent")
  }

  const name = await resolveCallerName(admin, call.caller_id)
  const pushed = await pushToCallee(admin, call.callee_id, {
    title: `Missed call from ${name}`,
    body: "You missed a ShoppieApp voice call.",
    link: `${SITE_URL}/?tab=messages&cid=${call.conversation_id}`,
    data: {
      tag: `call-${callId}`,
      callId,
      conversationId: call.conversation_id,
    },
    ttlSeconds: MISSED_TTL_SECONDS,
  })
  if (pushed > 0) await markSent(admin, "call_missed", callId, call.callee_id)
  return NextResponse.json({ sent: pushed > 0, pushed })
}
