import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminEmail } from "@/lib/admin"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const db = createAdminClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [
    { data: { users } = { users: [] } },
    { count: vendorCount },
    { count: productCount },
    { count: pendingReports },
    { count: productsToday },
  ] = await Promise.all([
    db.auth.admin.listUsers({ perPage: 1000 }),
    db.from("vendors").select("*", { count: "exact", head: true }),
    db.from("products").select("*", { count: "exact", head: true }),
    db.from("reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
    db.from("products").select("*", { count: "exact", head: true }).gte("created_at", today.toISOString()),
  ])

  const totalUsers = users.length
  const activeToday = users.filter(u =>
    u.last_sign_in_at && new Date(u.last_sign_in_at) >= today
  ).length

  const usersToday = users.filter(u =>
    u.created_at && new Date(u.created_at) >= today
  ).length

  // Last 7 days user signups for chart
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    d.setHours(0, 0, 0, 0)
    const next = new Date(d)
    next.setDate(d.getDate() + 1)
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      users: users.filter(u => {
        const c = u.created_at ? new Date(u.created_at) : null
        return c && c >= d && c < next
      }).length,
    }
  })

  return NextResponse.json({
    totalUsers,
    vendorCount: vendorCount ?? 0,
    productCount: productCount ?? 0,
    pendingReports: pendingReports ?? 0,
    activeToday,
    usersToday,
    productsToday: productsToday ?? 0,
    userGrowth: last7,
  })
}
