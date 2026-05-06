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
    ...(msg.url
      ? { url: msg.url }
      : {}),
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
