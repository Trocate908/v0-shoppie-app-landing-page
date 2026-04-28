import "server-only"
import { cert, getApps, initializeApp, type App } from "firebase-admin/app"
import { getMessaging, type Messaging } from "firebase-admin/messaging"

let cachedApp: App | null = null
let cachedMessaging: Messaging | null = null

/**
 * Lazily build the Firebase Admin SDK app. The service account JSON should
 * be set on FIREBASE_SERVICE_ACCOUNT_KEY as a single-line JSON string
 * (Vercel encodes it for you when you paste a JSON document).
 */
function buildApp(): App | null {
  if (cachedApp) return cachedApp
  if (getApps().length > 0) {
    cachedApp = getApps()[0]!
    return cachedApp
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (!raw) {
    console.warn("[FCM Admin] FIREBASE_SERVICE_ACCOUNT_KEY is not set")
    return null
  }

  let parsed: { project_id: string; client_email: string; private_key: string }
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    console.error("[FCM Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY", err)
    return null
  }

  // private_key in env vars usually has literal \n that must be re-expanded.
  const privateKey = parsed.private_key.includes("\\n")
    ? parsed.private_key.replace(/\\n/g, "\n")
    : parsed.private_key

  cachedApp = initializeApp({
    credential: cert({
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey,
    }),
  })
  return cachedApp
}

export function getAdminMessaging(): Messaging | null {
  if (cachedMessaging) return cachedMessaging
  const app = buildApp()
  if (!app) return null
  cachedMessaging = getMessaging(app)
  return cachedMessaging
}

export type FcmMessageInput = {
  title: string
  body: string
  link?: string
  imageUrl?: string
  data?: Record<string, string>
}

/**
 * Send a notification to one or more FCM tokens. Returns the list of tokens
 * that proved invalid so callers can prune them from the database.
 */
export async function sendFcmToTokens(
  tokens: string[],
  msg: FcmMessageInput,
): Promise<{ successCount: number; failureCount: number; invalidTokens: string[] }> {
  const messaging = getAdminMessaging()
  if (!messaging || tokens.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] }
  }

  const invalidTokens: string[] = []
  let successCount = 0
  let failureCount = 0

  // FCM sendEachForMulticast supports max 500 tokens per call — chunk to be safe.
  const chunks: string[][] = []
  for (let i = 0; i < tokens.length; i += 400) {
    chunks.push(tokens.slice(i, i + 400))
  }

  // FCM data fields must all be strings — coerce extras safely.
  const extraData: Record<string, string> = {}
  if (msg.data) {
    for (const [k, v] of Object.entries(msg.data)) {
      if (v === undefined || v === null) continue
      extraData[k] = typeof v === "string" ? v : String(v)
    }
  }

  for (const chunk of chunks) {
    // IMPORTANT: We deliberately omit the top-level `notification` field and
    // instead put title/body into `data`. With a `notification` payload Chrome
    // displays the toast itself and our service worker can't customise it
    // (no requireInteraction, no vibration, no sound control). Data-only
    // messages always invoke `onBackgroundMessage` / `push` event so we can
    // render a rich, Facebook-style persistent notification ourselves.
    const response = await messaging.sendEachForMulticast({
      tokens: chunk,
      data: {
        title: msg.title,
        body: msg.body,
        link: msg.link ?? "/",
        ...(msg.imageUrl ? { image: msg.imageUrl } : {}),
        ...extraData,
      },
      webpush: {
        // Maximum priority so the OS wakes the device immediately.
        headers: {
          Urgency: "high",
          TTL: "86400",
        },
        fcmOptions: msg.link ? { link: msg.link } : undefined,
      },
      android: {
        priority: "high",
      },
      apns: {
        headers: {
          "apns-priority": "10",
        },
      },
    })

    successCount += response.successCount
    failureCount += response.failureCount

    response.responses.forEach((res, idx) => {
      if (!res.success) {
        const code = res.error?.code ?? ""
        if (
          code.includes("registration-token-not-registered") ||
          code.includes("invalid-registration-token") ||
          code.includes("invalid-argument")
        ) {
          invalidTokens.push(chunk[idx])
        }
      }
    })
  }

  return { successCount, failureCount, invalidTokens }
}
