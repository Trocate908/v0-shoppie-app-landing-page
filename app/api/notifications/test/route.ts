import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { dispatchNotification } from "@/lib/notifications/dispatch"
import { isOneSignalConfigured } from "@/lib/push/onesignal"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/notifications/test
 *
 * Sends a real push notification to the currently signed-in user via OneSignal.
 * Use this to verify the end-to-end pipeline after setting up OneSignal.
 *
 * Requirements:
 *  1. NEXT_PUBLIC_ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY env vars are set
 *  2. The user is signed in
 *  3. The user has allowed notifications in their browser (on the real site URL)
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const configured = isOneSignalConfigured()
  const hints: string[] = []

  if (!process.env.ONESIGNAL_APP_ID) {
    hints.push("ONESIGNAL_APP_ID is not set. Add it in Replit Secrets.")
  }
  if (!process.env.ONESIGNAL_REST_API_KEY) {
    hints.push("ONESIGNAL_REST_API_KEY is not set. Add it in Replit Secrets.")
  }
  if (!process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID) {
    hints.push("NEXT_PUBLIC_ONESIGNAL_APP_ID is not set (browser SDK won't init).")
  }

  if (!configured) {
    return NextResponse.json({
      ok: false,
      reason: "OneSignal is not configured. Set ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY in Replit Secrets.",
      hints,
      setupUrl: "https://onesignal.com",
    })
  }

  if (!user) {
    return NextResponse.json({
      ok: false,
      reason: "Not signed in. Sign in first then visit this URL.",
      hints,
    })
  }

  const result = await dispatchNotification(
    { userId: user.id },
    {
      type: "custom",
      title: "ShoppieApp ✅",
      body: "Push notifications are working! You will see this even when the app is closed.",
      link: "/?tab=messages",
      refId: `test-${Date.now()}`,
      dedupeWindowHours: 0,
    },
  )

  return NextResponse.json({
    ok: true,
    userId: user.id,
    dispatch: result,
    hints,
    note: result.pushed === 0
      ? "Notification persisted but 0 devices received a push. Make sure you have opened the app in your real browser (not this iframe), allowed notifications, and are signed in there."
      : `Push delivered to ${result.pushed} device(s). Check your browser/phone for the notification.`,
  })
}
