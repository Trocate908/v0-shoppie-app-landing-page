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
 * NOTE: configure() deliberately does NOT cache its result. This means it
 * re-reads env vars and re-calls webpush.setVapidDetails() on every push.
 * The overhead is negligible (two string reads + one tiny object assign) but
 * the benefit is huge: you can add/rotate VAPID env vars without restarting
 * the server, and there is no risk of a stale "not configured" state from the
 * very first request that arrived before the env vars were available.
 */

function configure(): { ok: boolean; error: string | null } {
  const subject = process.env.VAPID_SUBJECT || "mailto:contact@shoppieapp.co.zw"
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  if (!publicKey) {
    return { ok: false, error: "VAPID_PUBLIC_KEY (or NEXT_PUBLIC_VAPID_PUBLIC_KEY) is missing" }
  }
  if (!privateKey) {
    return { ok: false, error: "VAPID_PRIVATE_KEY is missing" }
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    return { ok: true, error: null }
  } catch (err) {
    return { ok: false, error: `Failed to configure VAPID: ${(err as Error).message}` }
  }
}

export function getPushConfigStatus(): {
  ok: boolean
  error: string | null
  hasPublicKey: boolean
  hasPrivateKey: boolean
  hasSubject: boolean
} {
  const { ok, error } = configure()
  return {
    ok,
    error,
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
  const { ok, error } = configure()
  if (!ok) {
    console.warn("[push] sendWebPushToSubscriptions skipped — not configured:", error)
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
        // Legacy FCM tokens (pre-migration) — not valid Web Push subscriptions.
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
