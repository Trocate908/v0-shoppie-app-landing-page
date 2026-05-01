import { NextResponse } from "next/server"
import { generateVapidKeys } from "@/lib/push/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/push/generate-vapid
 *
 * Generates a fresh VAPID keypair and returns it. Run this ONCE during
 * setup, then paste the values into your project environment variables.
 *
 * IMPORTANT: regenerating keys after users have subscribed will invalidate
 * all existing subscriptions, so don't do it.
 *
 * This endpoint is disabled once VAPID keys are already configured to
 * prevent accidental key rotation.
 */
export async function GET() {
  // Refuse to regenerate if keys are already set — doing so would
  // invalidate every existing push subscription.
  if (process.env.VAPID_PRIVATE_KEY || process.env.VAPID_PUBLIC_KEY) {
    return NextResponse.json(
      {
        error:
          "VAPID keys are already configured. Regenerating would invalidate all existing push subscriptions. Remove the VAPID_* environment variables first if you truly need to rotate keys.",
      },
      { status: 403 },
    )
  }

  const keys = generateVapidKeys()
  return NextResponse.json({
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    envBlock: [
      `VAPID_PUBLIC_KEY=${keys.publicKey}`,
      `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`,
      `VAPID_PRIVATE_KEY=${keys.privateKey}`,
      `VAPID_SUBJECT=mailto:contact@shoppieapp.co.zw`,
    ].join("\n"),
    instructions: [
      "1. Copy ALL FOUR lines from `envBlock` above.",
      "2. Open your project Vars panel (top-right gear icon → Vars).",
      "3. Paste them in. Save.",
      "4. Reload your app. The notification system is now wired up.",
      "5. NEVER call this endpoint again — it would invalidate every existing subscription.",
    ],
  })
}
