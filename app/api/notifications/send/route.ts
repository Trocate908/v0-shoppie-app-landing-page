import { dispatchNotification, type DispatchTarget, type NotificationType } from "@/lib/notifications/dispatch"
import { NextResponse, type NextRequest } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * POST /api/notifications/send
 *
 * Authenticated server-to-server endpoint for triggering notifications
 * from your own backend (for example: when a vendor receives a new
 * message, call this with type:"message" and the vendor's user_id).
 *
 * Send `Authorization: Bearer ${NOTIFICATIONS_API_TOKEN}` to authenticate.
 *
 * Body:
 *   {
 *     "target": { "userId": "..." } | { "userIds": ["..."] } | { "deviceId": "..." } | { "audience": "all_shoppers" },
 *     "type":   "message" | "trending" | "product_loved" | "start_posting" | "new_product" | "custom",
 *     "title":  "New message from John",
 *     "body":   "Hi, is this still available?",
 *     "link":   "/messages/123",        // optional
 *     "imageUrl": "https://...",        // optional
 *     "data":   { "anything": "..." },  // optional
 *     "refId":  "msg-123",              // optional dedupe key
 *     "dedupeWindowHours": 1            // optional (default 24)
 *   }
 */
export async function POST(req: NextRequest) {
  const expected = process.env.NOTIFICATIONS_API_TOKEN
  const authz = req.headers.get("authorization")
  if (!expected || authz !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: {
    target?: DispatchTarget
    type?: NotificationType
    title?: string
    body?: string
    link?: string
    imageUrl?: string
    data?: Record<string, string>
    refId?: string
    dedupeWindowHours?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 })
  }

  if (!body.target || !body.type || !body.title || !body.body) {
    return NextResponse.json({ error: "target, type, title and body are required" }, { status: 400 })
  }

  const result = await dispatchNotification(body.target, {
    type: body.type,
    title: body.title,
    body: body.body,
    link: body.link,
    imageUrl: body.imageUrl,
    data: body.data,
    refId: body.refId,
    dedupeWindowHours: body.dedupeWindowHours,
  })

  return NextResponse.json({ ok: true, ...result })
}
