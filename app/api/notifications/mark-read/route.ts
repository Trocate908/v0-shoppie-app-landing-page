import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"

/**
 * POST /api/notifications/mark-read
 * Body: { id?: string, all?: boolean, deviceId?: string }
 *
 * Marks a single notification or all notifications as read for the current
 * user (or anonymous device).
 */
export async function POST(req: NextRequest) {
  const { id, all, deviceId } = await req.json().catch(() => ({}))
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let q = supabase.from("notifications").update({ read: true })

  if (id) {
    q = q.eq("id", id)
  } else if (!all) {
    return NextResponse.json({ error: "id or all required" }, { status: 400 })
  }

  if (user) {
    q = q.eq("user_id", user.id)
  } else if (deviceId) {
    q = q.is("user_id", null).eq("device_id", deviceId)
  } else {
    return NextResponse.json({ error: "auth or deviceId required" }, { status: 400 })
  }

  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
