import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/push/vapid-public
 *
 * Returns the public VAPID key so the browser can subscribe to push.
 * (Public keys are safe to expose — that's the whole point.)
 *
 * Falls back to NEXT_PUBLIC_VAPID_PUBLIC_KEY if the non-public env var
 * is unset, which means the value is also baked into the JS bundle and
 * we don't strictly need this endpoint, but having it lets the client
 * fetch the key dynamically when env vars are added later without a
 * full redeploy.
 */
export async function GET() {
  const publicKey =
    process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""
  if (!publicKey) {
    return NextResponse.json(
      {
        publicKey: null,
        error:
          "VAPID public key is not configured. Hit GET /api/push/generate-vapid once to mint a keypair, then add VAPID_PUBLIC_KEY + NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY + VAPID_SUBJECT to your env vars.",
      },
      { status: 503 },
    )
  }
  return NextResponse.json({ publicKey })
}
