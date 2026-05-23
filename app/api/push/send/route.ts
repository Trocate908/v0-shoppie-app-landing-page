import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { configureWebPush, webPush } from "@/lib/web-push"

/**
 * POST /api/push/send
 * Sends a Web Push notification to all enabled devices for a given user.
 *
 * Body: {
 *   userId: string        – recipient's auth user id
 *   title: string
 *   body: string
 *   url?: string          – deep-link target (defaults to /?tab=messages)
 *   tag?: string          – deduplication tag for the OS notification tray
 *   icon?: string
 * }
 *
 * This route is called server-side only (from realtime edge function or from
 * app-shell's server action).  For security, callers must be authenticated —
 * the sender's session is validated before the push is dispatched.
 */
export async function POST(req: Request) {
  try {
    configureWebPush()

    const supabase = await createClient()
    const {
      data: { user: caller },
    } = await supabase.auth.getUser()

    // Allow unauthenticated calls only from service-role (internal) — checked
    // via the presence of the internal header set by app-shell server actions.
    const internalKey = req.headers.get("x-internal-key")
    const isInternal = internalKey === process.env.INTERNAL_API_KEY

    if (!caller && !isInternal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { userId, title, body: msgBody, url, tag, icon } = body as {
      userId: string
      title: string
      body: string
      url?: string
      tag?: string
      icon?: string
    }

    if (!userId || !title || !msgBody) {
      return NextResponse.json({ error: "userId, title and body are required" }, { status: 400 })
    }

    // Fetch all enabled push subscriptions for this user
    const { data: tokens, error: tokensError } = await supabase
      .from("push_tokens")
      .select("id, token, device_id")
      .eq("user_id", userId)
      .eq("enabled", true)

    if (tokensError) {
      return NextResponse.json({ error: tokensError.message }, { status: 500 })
    }

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ sent: 0, message: "No active push subscriptions for this user" })
    }

    const payload = JSON.stringify({
      title,
      body: msgBody,
      icon: icon ?? "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      url: url ?? "/?tab=messages",
      tag: tag ?? "shoppie-msg",
    })

    const results = await Promise.allSettled(
      tokens.map(async (row) => {
        let subscription: webPush.PushSubscription
        try {
          subscription = JSON.parse(row.token) as webPush.PushSubscription
        } catch {
          return // malformed token — skip silently
        }

        try {
          await webPush.sendNotification(subscription, payload)
        } catch (err: unknown) {
          // 410 Gone or 404 = subscription expired / unsubscribed on the device
          const status = (err as { statusCode?: number }).statusCode
          if (status === 410 || status === 404) {
            // Disable the stale token so we stop trying
            await supabase
              .from("push_tokens")
              .update({ enabled: false })
              .eq("id", row.id)
          }
          throw err
        }
      }),
    )

    const sent = results.filter((r) => r.status === "fulfilled").length
    const failed = results.filter((r) => r.status === "rejected").length

    return NextResponse.json({ sent, failed })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
