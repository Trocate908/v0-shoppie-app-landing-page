import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"

/**
 * POST /api/notifications/register-token
 * Body: { token, deviceId, userType, userAgent }
 *
 * Saves (or upserts) the device's FCM token and links it to the current
 * authenticated user when one is present. Anonymous shoppers are tracked
 * by deviceId (a uuid stored in localStorage).
 */
export async function POST(req: NextRequest) {
  try {
    const { token, deviceId, userType, userAgent } = await req.json()

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "token required" }, { status: 400 })
    }

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

    const { error } = await supabase
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
