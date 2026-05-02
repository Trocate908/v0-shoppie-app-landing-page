import "server-only"

const API_URL = "https://onesignal.com/api/v1/notifications"
const BASE = "https://shoppieapp.co.zw"

function config(): { appId: string; apiKey: string } | null {
  const appId  = process.env.ONESIGNAL_APP_ID
  const apiKey = process.env.ONESIGNAL_REST_API_KEY
  if (!appId || !apiKey) return null
  return { appId, apiKey }
}

export function isOneSignalConfigured(): boolean {
  return config() !== null
}

/**
 * Send a push notification to one or more users identified by their
 * Supabase user IDs (stored as OneSignal external_id after login()).
 */
export async function sendOneSignalToUsers(
  externalIds: string[],
  payload: {
    title: string
    body: string
    url?: string
    imageUrl?: string
  },
): Promise<{ ok: boolean; notified: number; error?: string }> {
  if (externalIds.length === 0) return { ok: true, notified: 0 }

  const cfg = config()
  if (!cfg) {
    console.warn("[onesignal] ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY not set — push skipped")
    return { ok: false, notified: 0, error: "OneSignal not configured" }
  }

  // Deduplicate IDs before sending
  const ids = Array.from(new Set(externalIds))

  const body: Record<string, unknown> = {
    app_id: cfg.appId,
    target_channel: "push",
    include_aliases: { external_id: ids },
    contents: { en: payload.body },
    headings: { en: payload.title },
    url: payload.url ? new URL(payload.url, BASE).href : BASE,
    chrome_web_icon: `${BASE}/logo.png`,
    firefox_icon: `${BASE}/logo.png`,
    web_push_topic: "shoppie-message",
  }
  if (payload.imageUrl) body.big_picture = payload.imageUrl

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const json = await res.json()

    if (!res.ok) {
      const msg = (json.errors ?? []).join(", ") || `HTTP ${res.status}`
      console.error("[onesignal] API error:", msg)
      return { ok: false, notified: 0, error: msg }
    }

    return { ok: true, notified: json.recipients ?? 0 }
  } catch (err) {
    console.error("[onesignal] fetch error:", err)
    return { ok: false, notified: 0, error: (err as Error).message }
  }
}
