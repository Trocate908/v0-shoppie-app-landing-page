import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse, type NextRequest } from "next/server"

/**
 * GET /api/notifications/list?deviceId=...
 * Returns up to 30 most-recent notifications for the current user OR for
 * the supplied anonymous device id.
 *
 * Authenticated users: queried via the regular server client (respects RLS).
 * Anonymous users: queried via the admin client so device_id rows (which
 * have user_id=null) are returned even though RLS only allows auth.uid()=user_id.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = new URL(req.url)
  const deviceId = url.searchParams.get("deviceId")

  if (user) {
    // Authenticated: use regular client with RLS
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, image_url, metadata, read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const unread = (data ?? []).filter((n) => !n.read).length
    return NextResponse.json({ notifications: data ?? [], unread })
  }

  if (deviceId) {
    // Anonymous: use admin client to bypass RLS for device_id rows
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("notifications")
      .select("id, type, title, body, link, image_url, metadata, read, created_at")
      .is("user_id", null)
      .eq("device_id", deviceId)
      .order("created_at", { ascending: false })
      .limit(30)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const unread = (data ?? []).filter((n) => !n.read).length
    return NextResponse.json({ notifications: data ?? [], unread })
  }

  return NextResponse.json({ notifications: [], unread: 0 })
}
