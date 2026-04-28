import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"

/**
 * GET /api/notifications/list?deviceId=...
 * Returns up to 30 most-recent notifications for the current user OR for
 * the supplied anonymous device id.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = new URL(req.url)
  const deviceId = url.searchParams.get("deviceId")

  let query = supabase
    .from("notifications")
    .select("id, type, title, body, link, image_url, metadata, read, created_at")
    .order("created_at", { ascending: false })
    .limit(30)

  if (user) {
    query = query.eq("user_id", user.id)
  } else if (deviceId) {
    query = query.is("user_id", null).eq("device_id", deviceId)
  } else {
    return NextResponse.json({ notifications: [], unread: 0 })
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const unread = (data ?? []).filter((n) => !n.read).length
  return NextResponse.json({ notifications: data ?? [], unread })
}
