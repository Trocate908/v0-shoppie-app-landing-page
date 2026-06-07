import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail } from "@/lib/admin"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = (await import("@/lib/supabase/admin")).createAdminClient()

  const checks = await Promise.all([
    db.from("audit_logs").select("id", { count: "exact", head: true }),
    db.from("reports").select("id", { count: "exact", head: true }),
    db.from("platform_settings").select("key", { count: "exact", head: true }),
    db.from("announcements").select("id", { count: "exact", head: true }),
  ])

  const tables = ["audit_logs", "reports", "platform_settings", "announcements"]
  const status = checks.map((r, i) => ({
    table: tables[i],
    exists: r.error?.code !== "42P01",
    error: r.error?.code === "42P01" ? "Table not found" : null,
  }))

  return NextResponse.json({ status })
}
