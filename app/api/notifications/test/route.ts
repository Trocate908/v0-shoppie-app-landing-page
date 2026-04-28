import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { dispatchNotification } from "@/lib/notifications/dispatch"

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
 *   - how many push tokens are registered for you
 *   - what the dispatch reported (pushed / persisted / pruned)
 *   - hints if anything is misconfigured
 */
export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const hints: string[] = []
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    hints.push("FIREBASE_SERVICE_ACCOUNT_KEY is missing — pushes won't go out (in-app rows will still save).")
  }
  if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) {
    hints.push("NEXT_PUBLIC_FIREBASE_VAPID_KEY is missing — the browser cannot register a token.")
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    hints.push("SUPABASE_SERVICE_ROLE_KEY is missing — the dispatcher cannot read other users' tokens.")
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
        "No push token registered for this user yet. Click 'Turn on notifications' in the soft prompt, " +
        "or accept the browser's native permission prompt. Then revisit this URL.",
      userId: user.id,
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
      tokenPreview: typeof t.token === "string" ? t.token.slice(0, 20) + "..." : null,
    })),
    dispatch: result,
    hints,
  })
}
