import "server-only"

const ONESIGNAL_APP_ID     = process.env.ONESIGNAL_APP_ID
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY
const API_URL = "https://onesignal.com/api/v1/notifications"

export interface OneSignalMessage {
  title: string
  body: string
  url?: string
  imageUrl?: string
  data?: Record<string, string>
}

export interface OneSignalResult {
  pushed: number
  errors: number
}

function buildPayload(msg: OneSignalMessage) {
  return {
    app_id: ONESIGNAL_APP_ID,
    headings: { en: msg.title },
    contents: { en: msg.body },

    // ── Android Chrome reliability tuning ─────────────────────────────────
    // priority: 10 = "high" — bypasses Android Doze mode so the push wakes
    // the device immediately instead of being batched. Without this, pushes
    // can be delayed up to 15 minutes (or dropped entirely) on phones in
    // power-save mode.
    priority: 10,
    // ttl: 24 hours — if the device is offline (e.g. phone in airplane
    // mode), the push service will retry for up to a day instead of the
    // default 4 weeks (which causes a flood when the user reconnects).
    ttl: 24 * 60 * 60,
    // chrome_web_badge / chrome_web_icon ensure a visible icon on Android,
    // not the generic Chrome bell which Android collapses with other sites.
    chrome_web_icon: msg.imageUrl ?? "https://shoppieapp.co.zw/logo.png",
    chrome_web_badge: "https://shoppieapp.co.zw/logo.png",
    // Web push needs an explicit url at the top level for Chrome to open
    // the right page when the user taps the notification.
    web_url: msg.url,
    // Don't collapse same-topic pushes on Android — every message should
    // produce its own notification line.
    web_push_topic: msg.data?.tag ?? null,

    ...(msg.url ? { url: msg.url } : {}),
    ...(msg.imageUrl
      ? { big_picture: msg.imageUrl, ios_attachments: { image: msg.imageUrl } }
      : {}),
    ...(msg.data ? { data: msg.data } : {}),
  }
}

async function callApi(payload: Record<string, unknown>): Promise<OneSignalResult> {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.warn("[onesignal] ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY not set — skipping push")
    return { pushed: 0, errors: 0 }
  }
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })
    const json = await res.json() as { recipients?: number; errors?: string[]; id?: string }
    if (!res.ok) {
      console.error("[onesignal] API error", res.status, json)
      return { pushed: 0, errors: 1 }
    }
    return { pushed: json.recipients ?? 0, errors: 0 }
  } catch (err) {
    console.error("[onesignal] fetch error:", err)
    return { pushed: 0, errors: 1 }
  }
}

/**
 * Send a push to specific users identified by their Supabase user ID.
 * OneSignal links a user's device to their user ID via sdk.login(userId)
 * called in the browser hook (use-onesignal.ts).
 */
export async function sendOneSignalToUsers(
  userIds: string[],
  msg: OneSignalMessage,
): Promise<OneSignalResult> {
  if (userIds.length === 0) return { pushed: 0, errors: 0 }

  const BATCH_SIZE = 2000
  let pushed = 0
  let errors = 0

  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE)
    const r = await callApi({
      ...buildPayload(msg),
      include_aliases: { external_id: batch },
      target_channel: "push",
    })
    pushed += r.pushed
    errors += r.errors
  }

  return { pushed, errors }
}

/**
 * Broadcast to ALL subscribed users via OneSignal's built-in "All" segment.
 * Use this for audience-wide notifications (trending products, new products, etc.)
 */
export async function sendOneSignalToAll(msg: OneSignalMessage): Promise<OneSignalResult> {
  return callApi({
    ...buildPayload(msg),
    included_segments: ["All"],
  })
}
