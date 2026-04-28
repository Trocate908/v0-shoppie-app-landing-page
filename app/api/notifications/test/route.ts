import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { dispatchNotification } from "@/lib/notifications/dispatch"
import { getPushConfigStatus } from "@/lib/push/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/notifications/test
 *
 * Diagnostic endpoint — sends a push to the currently-logged-in user
 * and returns a JSON dump of what happened so you can debug. Open this
 * in the same browser tab where you're testing.
 *
 * The response includes:
 *   - whether you have a logged-in session
 *   - how many push subscriptions are registered for you
 *   - what the dispatch reported (pushed / persisted / pruned)
 *   - hints if anything is misconfigured
 */
export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const hints: string[] = []
  const pushCfg = getPushConfigStatus()
  if (!pushCfg.hasPublicKey) {
    hints.push(
      "VAPID_PUBLIC_KEY (and NEXT_PUBLIC_VAPID_PUBLIC_KEY) are missing — browsers cannot subscribe. " +
        "Hit GET /api/push/generate-vapid once to mint a keypair, then add the four env vars it returns.",
    )
  }
  if (!pushCfg.hasPrivateKey) {
    hints.push(
      "VAPID_PRIVATE_KEY is missing — the server cannot sign push notifications, so nothing will deliver.",
    )
  }
  if (!pushCfg.hasSubject) {
    hints.push(
      "VAPID_SUBJECT is missing (defaulting to mailto:contact@shoppieapp.co.zw) — push services prefer a real contact mailto:.",
    )
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    hints.push(
      "SUPABASE_SERVICE_ROLE_KEY is missing — the dispatcher cannot read other users' subscriptions, so cross-user pushes will silently fail.",
    )
  }

  if (!user) {
    return NextResponse.json({
      ok: false,
      reason: "Not logged in. Sign in, then visit this URL again.",
      hints,
    })
  }

  // Use the admin client so we can see what the dispatcher will see.
  const admin = createAdminClient()
  const { data: tokens } = await admin
    .from("push_tokens")
    .select("token, device_id, user_type, enabled, last_seen_at")
    .eq("user_id", user.id)

  if (!tokens || tokens.length === 0) {
    return NextResponse.json({
      ok: false,
      reason:
        "No push subscription registered for this user yet. Tap 'Enable notifications' on /notifications/debug, " +
        "or accept the browser's permission prompt — then revisit this URL.",
      userId: user.id,
      pushConfig: pushCfg,
      hints,
    })
  }

  const result = await dispatchNotification(
    { userId: user.id },
    {
      type: "custom",
      title: "ShoppieApp test push",
      body: "If you can see this, your notification pipeline is working.",
      link: "/notifications",
      refId: `test-${Date.now()}`,
      dedupeWindowHours: 0,
    },
  )

  return NextResponse.json({
    ok: true,
    userId: user.id,
    tokenCount: tokens.length,
    tokens: tokens.map((t) => ({
      device_id: t.device_id,
      user_type: t.user_type,
      enabled: t.enabled,
      tokenPreview: typeof t.token === "string" ? t.token.slice(0, 32) + "..." : null,
    })),
    dispatch: result,
    pushConfig: pushCfg,
    hints,
  })
}
