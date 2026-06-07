import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminEmail } from "@/lib/admin"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = createAdminClient()

  const [users, vendors, products, recentUsers] = await Promise.all([
    db.from("users").select("id", { count: "exact", head: true }),
    db.from("vendors").select("id", { count: "exact", head: true }),
    db.from("products").select("id", { count: "exact", head: true }),
    db.from("users").select("id, created_at").gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
  ])

  const [reports, auditLogs] = await Promise.all([
    db.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending").maybeSingle().then(() =>
      db.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending")
    ),
    db.from("audit_logs").select("id", { count: "exact", head: true }),
  ]).catch(() => [{ count: 0 }, { count: 0 }])

  return NextResponse.json({
    totalUsers: users.count ?? 0,
    totalVendors: vendors.count ?? 0,
    totalProducts: products.count ?? 0,
    pendingReports: (reports as { count: number | null })?.count ?? 0,
    auditLogs: (auditLogs as { count: number | null })?.count ?? 0,
    newUsersThisWeek: recentUsers.data?.length ?? 0,
    userGrowth: recentUsers.data ?? [],
  })
}
