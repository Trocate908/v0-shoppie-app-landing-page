import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminEmail } from "@/lib/admin"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = createAdminClient()
  const days = 30
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const [usersResult, productsResult, categoriesResult] = await Promise.all([
    db.from("users").select("created_at").gte("created_at", since).order("created_at"),
    db.from("products").select("created_at").gte("created_at", since).order("created_at"),
    db.from("products").select("category"),
  ])

  function groupByDay(rows: { created_at: string }[]) {
    const counts: Record<string, number> = {}
    for (const row of rows ?? []) {
      const day = row.created_at.slice(0, 10)
      counts[day] = (counts[day] ?? 0) + 1
    }
    return Object.entries(counts).map(([date, count]) => ({ date, count }))
  }

  const catCounts: Record<string, number> = {}
  for (const p of categoriesResult.data ?? []) {
    const c = p.category ?? "Other"
    catCounts[c] = (catCounts[c] ?? 0) + 1
  }
  const topCategories = Object.entries(catCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  return NextResponse.json({
    userGrowth: groupByDay(usersResult.data ?? []),
    productGrowth: groupByDay(productsResult.data ?? []),
    topCategories,
  })
}
