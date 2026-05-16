import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse, type NextRequest } from "next/server"

/**
 * POST /api/notifications/mark-read
 * Body: { id?: string, all?: boolean, deviceId?: string }
 *
 * Marks a single notification or all notifications as read.
 * Authenticated users: regular client (RLS enforced).
 * Anonymous users: admin client (device_id rows have user_id=null,
 *   which would fail the RLS check auth.uid()=user_id).
 */
export async function POST(req: NextRequest) {
  const { id, all, deviceId } = await req.json().catch(() => ({}))
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    // Authenticated: use regular client with RLS
    let q = supabase.from("notifications").update({ read: true }).eq("user_id", user.id)
    if (id) {
      q = q.eq("id", id)
    } else if (!all) {
      return NextResponse.json({ error: "id or all required" }, { status: 400 })
    }
    const { error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (deviceId) {
    // Anonymous: use admin client to bypass RLS
    const admin = createAdminClient()
    let q = admin
      .from("notifications")
      .update({ read: true })
      .is("user_id", null)
      .eq("device_id", deviceId)
    if (id) {
      q = q.eq("id", id)
    } else if (!all) {
      return NextResponse.json({ error: "id or all required" }, { status: 400 })
    }
    const { error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "auth or deviceId required" }, { status: 400 })
}
