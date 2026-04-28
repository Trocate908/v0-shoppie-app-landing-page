import "server-only"
import webpush from "web-push"

// Mirror the shape that web-push expects so we don't take a hard dep on
// @types/web-push in case it isn't auto-installed on first push.
type WebPushSubscription = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

/**
 * Native Web Push server helpers.
 *
 * Why we replaced FCM:
 *  - FCM Web is just a thin wrapper around the W3C Web Push protocol.
 *  - It requires a service-account JSON, a separate /firebase-messaging-sw.js,
 *    and the Firebase Web SDK on the client. Any one of those silently
 *    breaks the chain (and ours did, repeatedly).
 *  - Native Web Push needs ONLY two env vars: a VAPID public/private key
 *    pair we generate ourselves. That's it.
 *
 * Setup:
 *   1. Hit GET /api/push/generate-vapid (admin) once, copy the keys it returns
 *   2. Add VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY,
 *      VAPID_SUBJECT to your Vercel project env vars
 *   3. Done — every browser that subscribes will receive pushes
 */

let configured = false
let configError: string | null = null

function configure(): boolean {
  if (configured) return true
  const subject = process.env.VAPID_SUBJECT || "mailto:contact@shoppieapp.co.zw"
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    configError = !publicKey
      ? "VAPID_PUBLIC_KEY (or NEXT_PUBLIC_VAPID_PUBLIC_KEY) is missing"
      : "VAPID_PRIVATE_KEY is missing"
    return false
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    configured = true
    return true
  } catch (err) {
    configError = `Failed to configure VAPID details: ${(err as Error).message}`
    return false
  }
}

export function getPushConfigStatus(): {
  ok: boolean
  error: string | null
  hasPublicKey: boolean
  hasPrivateKey: boolean
  hasSubject: boolean
} {
  // Trigger configure to fill error.
  configure()
  return {
    ok: configured,
    error: configError,
    hasPublicKey: !!(process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    hasPrivateKey: !!process.env.VAPID_PRIVATE_KEY,
    hasSubject: !!process.env.VAPID_SUBJECT,
  }
}

export type WebPushMessage = {
  title: string
  body: string
  link?: string
  imageUrl?: string
  data?: Record<string, string>
}

/**
 * Send the given payload to a list of subscriptions. Each subscription is
 * stored in the database as a JSON-stringified PushSubscription object.
 *
 * Returns successCount, failureCount, and a list of *invalid* tokens so
 * the caller can prune them (404/410 means the subscription is dead).
 */
export async function sendWebPushToSubscriptions(
  subscriptionStrings: string[],
  msg: WebPushMessage,
): Promise<{ successCount: number; failureCount: number; invalidTokens: string[] }> {
  if (!configure()) {
    console.warn("[push] sendWebPushToSubscriptions skipped — not configured:", configError)
    return { successCount: 0, failureCount: 0, invalidTokens: [] }
  }

  // The SW expects { title, body, link, image, data, tag } at the top level.
  const payload = JSON.stringify({
    title: msg.title,
    body: msg.body,
    link: msg.link ?? "/",
    image: msg.imageUrl ?? null,
    data: msg.data ?? {},
    tag: msg.data?.tag ?? `shoppie-${Date.now()}`,
  })

  let successCount = 0
  let failureCount = 0
  const invalidTokens: string[] = []

  await Promise.all(
    subscriptionStrings.map(async (raw) => {
      let parsed: WebPushSubscription
      try {
        parsed = JSON.parse(raw) as WebPushSubscription
        if (!parsed || typeof parsed.endpoint !== "string" || !parsed.keys) {
          invalidTokens.push(raw)
          failureCount++
          return
        }
      } catch {
        // Legacy FCM tokens (pre-migration) live in the same column as plain
        // strings — they are not valid Web Push subscriptions, prune them.
        invalidTokens.push(raw)
        failureCount++
        return
      }
      try {
        await webpush.sendNotification(parsed, payload, {
          TTL: 86400,
          urgency: "high",
        })
        successCount++
      } catch (err) {
        failureCount++
        const status = (err as { statusCode?: number }).statusCode
        // 404 / 410 -> subscription gone, 400 -> malformed (also dead)
        if (status === 404 || status === 410 || status === 400) {
          invalidTokens.push(raw)
        } else {
          console.error("[push] sendNotification failed:", status, (err as Error).message)
        }
      }
    }),
  )

  return { successCount, failureCount, invalidTokens }
}

/** Generate a brand-new VAPID keypair. */
export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  return webpush.generateVAPIDKeys()
}
