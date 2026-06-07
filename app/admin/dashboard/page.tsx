"use client"

import { useEffect, useState } from "react"
import { Users, Store, Package, Flag, TrendingUp, ClipboardList, Database } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import Link from "next/link"

interface Stats {
  totalUsers: number
  totalVendors: number
  totalProducts: number
  pendingReports: number
  auditLogs: number
  newUsersThisWeek: number
  userGrowth: { created_at: string }[]
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [dbStatus, setDbStatus] = useState<{ table: string; exists: boolean }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats").then(r => r.json()),
      fetch("/api/admin/setup").then(r => r.json()),
    ]).then(([s, setup]) => {
      setStats(s)
      setDbStatus(setup.status ?? [])
      setLoading(false)
    })
  }, [])

  const missingTables = dbStatus.filter(t => !t.exists)

  const chartData = (() => {
    if (!stats?.userGrowth?.length) return []
    const counts: Record<string, number> = {}
    for (const u of stats.userGrowth) {
      const day = u.created_at.slice(0, 10)
      counts[day] = (counts[day] ?? 0) + 1
    }
    return Object.entries(counts).map(([date, users]) => ({ date: date.slice(5), users }))
  })()

  const cards = [
    { label: "Total Users", value: stats?.totalUsers, icon: Users, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30" },
    { label: "Total Vendors", value: stats?.totalVendors, icon: Store, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/30" },
    { label: "Total Products", value: stats?.totalProducts, icon: Package, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
    { label: "Pending Reports", value: stats?.pendingReports, icon: Flag, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30" },
    { label: "New Users (7d)", value: stats?.newUsersThisWeek, icon: TrendingUp, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30" },
    { label: "Audit Events", value: stats?.auditLogs, icon: ClipboardList, color: "text-slate-600", bg: "bg-slate-50 dark:bg-slate-950/30" },
  ]

  if (loading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Platform overview</p>
      </div>

      {missingTables.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <Database className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Database setup required</p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
              Missing tables: {missingTables.map(t => t.table).join(", ")}.{" "}
              <Link href="/admin/setup" className="underline font-medium">Run the migration →</Link>
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-5">
            <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <p className="text-2xl font-bold">{value?.toLocaleString() ?? "—"}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {chartData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4">New Users — Last 7 Days</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="usersGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="users" stroke="#7c3aed" fill="url(#usersGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/admin/users", label: "Manage Users" },
          { href: "/admin/vendors", label: "Manage Vendors" },
          { href: "/admin/products", label: "Moderate Products" },
          { href: "/admin/reports", label: "View Reports" },
          { href: "/admin/notifications", label: "Send Notification" },
          { href: "/admin/announcements", label: "Announcements" },
          { href: "/admin/analytics", label: "Analytics" },
          { href: "/admin/settings", label: "Settings" },
        ].map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="bg-card border border-border rounded-xl px-4 py-3 text-sm font-medium hover:bg-accent transition-colors text-center"
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}
