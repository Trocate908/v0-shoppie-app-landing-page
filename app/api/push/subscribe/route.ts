import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/push/subscribe
 * Saves a Web Push subscription to the push_tokens table.
 *
 * Body: { subscription: PushSubscription, deviceId: string, userType: "buyer" | "vendor" }
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { subscription, deviceId, userType = "buyer" } = body as {
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
      deviceId: string
      userType?: string
    }

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription object" }, { status: 400 })
    }

    const userAgent = req.headers.get("user-agent") ?? ""

    // Upsert — one row per device_id per user
    const { error } = await supabase.from("push_tokens").upsert(
      {
        user_id: user.id,
        device_id: deviceId,
        token: JSON.stringify(subscription),
        user_type: userType,
        user_agent: userAgent,
        enabled: true,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,device_id" },
    )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * DELETE /api/push/subscribe
 * Removes (disables) a push subscription for this device.
 *
 * Body: { deviceId: string }
 */
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { deviceId } = (await req.json()) as { deviceId: string }

    const { error } = await supabase
      .from("push_tokens")
      .update({ enabled: false })
      .eq("user_id", user.id)
      .eq("device_id", deviceId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
