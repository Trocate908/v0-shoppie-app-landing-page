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

  for (const chunk of chunks) {
    const response = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: {
        title: msg.title,
        body: msg.body,
        imageUrl: msg.imageUrl,
      },
      data: {
        link: msg.link ?? "/",
        ...(msg.data ?? {}),
      },
      webpush: {
        fcmOptions: msg.link ? { link: msg.link } : undefined,
        notification: {
          icon: "/logo.png",
          badge: "/logo.png",
          ...(msg.imageUrl ? { image: msg.imageUrl } : {}),
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
