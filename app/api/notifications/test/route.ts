import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { dispatchNotification } from "@/lib/notifications/dispatch"
import { getPushConfigStatus } from "@/lib/push/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/notifications/test?deviceId=...
 *
 * Diagnostic + test endpoint. Works for both:
 *  - Authenticated users: sends a push to the signed-in account
 *  - Anonymous users:     sends a push to the supplied deviceId
 *
 * Returns a JSON dump of the full pipeline state so you can see exactly
 * what's working and what isn't.
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = new URL(req.url)
  const deviceId = url.searchParams.get("deviceId") ?? undefined

  const hints: string[] = []
  const pushCfg = getPushConfigStatus()

  if (!pushCfg.hasPublicKey) {
    hints.push(
      "VAPID_PUBLIC_KEY (and NEXT_PUBLIC_VAPID_PUBLIC_KEY) are missing — browsers cannot subscribe.",
    )
  }
  if (!pushCfg.hasPrivateKey) {
    hints.push(
      "VAPID_PRIVATE_KEY is missing — the server cannot sign push notifications.",
    )
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    hints.push(
      "SUPABASE_SERVICE_ROLE_KEY is missing — cross-user dispatch will silently fail.",
    )
  }

  const admin = createAdminClient()

  // ── Authenticated user test ──────────────────────────────────────────────
  if (user) {
    const { data: tokens } = await admin
      .from("push_tokens")
      .select("token, device_id, user_type, enabled, last_seen_at")
      .eq("user_id", user.id)

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({
        ok: false,
        reason:
          "No push subscription registered for this user yet. " +
          "Tap 'Enable notifications' on /notifications then visit this URL again.",
        userId: user.id,
        pushConfig: pushCfg,
        hints,
      })
    }

    const result = await dispatchNotification(
      { userId: user.id },
      {
        type: "custom",
        title: "ShoppieApp test push 🔔",
        body: "Push notifications are working! You will see these even when the app is closed.",
        link: "/notifications",
        refId: `test-${Date.now()}`,
        dedupeWindowHours: 0,
      },
    )

    return NextResponse.json({
      ok: true,
      mode: "authenticated",
      userId: user.id,
      tokenCount: tokens.length,
      tokens: tokens.map((t) => ({
        device_id: t.device_id,
        user_type: t.user_type,
        enabled: t.enabled,
        last_seen_at: t.last_seen_at,
        tokenPreview: typeof t.token === "string" ? t.token.slice(0, 40) + "..." : null,
      })),
      dispatch: result,
      pushConfig: pushCfg,
      hints,
    })
  }

  // ── Anonymous / device-based test ────────────────────────────────────────
  if (deviceId) {
    const { data: tokens } = await admin
      .from("push_tokens")
      .select("token, device_id, user_type, enabled, last_seen_at")
      .is("user_id", null)
      .eq("device_id", deviceId)

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({
        ok: false,
        reason:
          "No push subscription registered for this device yet. " +
          "Tap 'Enable notifications' then try again.",
        deviceId,
        pushConfig: pushCfg,
        hints,
      })
    }

    const result = await dispatchNotification(
      { deviceId },
      {
        type: "custom",
        title: "ShoppieApp test push 🔔",
        body: "Push notifications are working! You will see these even when the app is closed.",
        link: "/notifications",
        refId: `test-${Date.now()}`,
        dedupeWindowHours: 0,
      },
    )

    return NextResponse.json({
      ok: true,
      mode: "anonymous",
      deviceId,
      tokenCount: tokens.length,
      dispatch: result,
      pushConfig: pushCfg,
      hints,
    })
  }

  // No user or deviceId
  return NextResponse.json({
    ok: false,
    reason: "Sign in, or pass ?deviceId=<your-device-id> to test anonymously.",
    pushConfig: pushCfg,
    hints,
  })
}
