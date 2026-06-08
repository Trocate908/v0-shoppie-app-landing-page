import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const body = await req.json()
  const { target_type, target_id, reason, details } = body

  if (!target_type || !target_id || !reason) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const db = createAdminClient()
  const { error } = await db.from("reports").insert({
    reporter_id: user?.id ?? null,
    reporter_email: user?.email ?? null,
    target_type,
    target_id,
    reason,
    details: details ?? null,
    status: "pending",
  })

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json({ error: "Reports table not set up yet. Ask an admin to run DB Setup." }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
