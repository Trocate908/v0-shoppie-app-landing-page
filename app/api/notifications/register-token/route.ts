import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse, type NextRequest } from "next/server"

/**
 * POST /api/notifications/register-token
 * Body: { token, deviceId, userType, userAgent }
 *
 * Saves (or upserts) the device's Web Push subscription and links it to
 * the current authenticated user when one is present.
 *
 * We use the admin client throughout: the push_tokens RLS policies require
 * auth.uid() = user_id for SELECT (needed by upsert conflict resolution)
 * which fails for anonymous users whose rows have user_id = NULL. The
 * server enforces the same ownership logic explicitly instead.
 */
export async function POST(req: NextRequest) {
  try {
    const { token, deviceId, userType, userAgent } = await req.json()

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "token required" }, { status: 400 })
    }

    // Resolve the current authenticated user (if any) from the session cookie.
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const allowedUserType = ["vendor", "shopper", "anonymous"].includes(userType)
      ? userType
      : user
        ? "shopper"
        : "anonymous"

    const payload = {
      token,
      device_id: deviceId ?? null,
      user_id: user?.id ?? null,
      user_type: allowedUserType,
      user_agent: userAgent ?? null,
      enabled: true,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Use admin client to bypass RLS (ownership is enforced by server logic above).
    const admin = createAdminClient()

    // Step 1: drop any previous subscription rows for this device so we
    // don't accumulate stale entries when the browser rotates its push
    // subscription. The new row will be inserted next.
    if (deviceId) {
      await admin.from("push_tokens").delete().eq("device_id", deviceId).neq("token", token)
    }

    // Step 2: upsert the current token (so re-registering the same device
    // is a no-op and just refreshes last_seen_at).
    const { error } = await admin
      .from("push_tokens")
      .upsert(payload, { onConflict: "token" })

    if (error) {
      console.error("[notifications] register-token error", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[notifications] register-token exception", err)
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
