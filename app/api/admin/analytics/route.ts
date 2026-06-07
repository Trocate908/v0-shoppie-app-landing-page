import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminEmail } from "@/lib/admin"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = createAdminClient()

  const [
    { data: { users } = { users: [] } },
    { count: totalProducts },
    { count: vendorCount },
    { data: products },
    { data: recentProducts },
  ] = await Promise.all([
    db.auth.admin.listUsers({ perPage: 1000 }),
    db.from("products").select("*", { count: "exact", head: true }),
    db.from("vendors").select("*", { count: "exact", head: true }),
    db.from("products").select("category").not("category", "is", null),
    db.from("products").select("created_at").gte("created_at", (() => { const d = new Date(); d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); return d.toISOString() })()),
  ])

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    d.setHours(0, 0, 0, 0)
    const next = new Date(d)
    next.setDate(d.getDate() + 1)
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      users: users.filter(u => { const c = u.created_at ? new Date(u.created_at) : null; return c && c >= d && c < next }).length,
      products: (recentProducts ?? []).filter(p => { const c = new Date(p.created_at); return c >= d && c < next }).length,
    }
  })

  // Category counts
  const catMap = new Map<string, number>()
  products?.forEach(p => { if (p.category) catMap.set(p.category, (catMap.get(p.category) ?? 0) + 1) })
  const topCategories = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category, count]) => ({ category, count }))

  return NextResponse.json({
    totalUsers: users.length,
    totalProducts: totalProducts ?? 0,
    vendorCount: vendorCount ?? 0,
    userGrowth: last7.map(d => ({ date: d.date, users: d.users })),
    productGrowth: last7.map(d => ({ date: d.date, products: d.products })),
    topCategories,
  })
}
