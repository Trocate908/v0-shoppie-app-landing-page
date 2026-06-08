"use client"

import { useEffect, useState } from "react"
import { Users, Store, Package, Flag, Activity, TrendingUp, ShieldCheck, Clock, RefreshCw, Bell, Megaphone, ClipboardList } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import Link from "next/link"

interface Stats {
  totalUsers: number
  vendorCount: number
  productCount: number
  pendingReports: number
  activeToday: number
  usersToday: number
  productsToday: number
  userGrowth: { date: string; users: number }[]
}

interface AuditLog {
  id: string
  admin_email: string
  action: string
  created_at: string
}

function StatCard({ icon: Icon, label, value, sub, color, href }: {
  icon: typeof Users; label: string; value: number | string; sub?: string; color: string; href?: string
}) {
  const inner = (
    <div className={`bg-card border border-border rounded-xl p-5 flex items-start gap-4 transition-colors ${href ? "hover:bg-accent cursor-pointer" : ""}`}>
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function loadAll() {
    setRefreshing(true)
    const [statsRes, logsRes] = await Promise.allSettled([
      fetch("/api/admin/stats").then(r => r.json()),
      fetch("/api/admin/audit").then(r => r.json()),
    ])
    if (statsRes.status === "fulfilled") setStats(statsRes.value)
    if (logsRes.status === "fulfilled") setRecentLogs((logsRes.value.logs ?? []).slice(0, 6))
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { loadAll() }, [])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-violet-600" />Admin Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Platform overview and key metrics</p>
        </div>
        <button
          onClick={loadAll}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total Users" value={stats?.totalUsers ?? 0} color="bg-blue-500" href="/admin/users" />
          <StatCard icon={Store} label="Total Vendors" value={stats?.vendorCount ?? 0} color="bg-green-500" href="/admin/vendors" />
          <StatCard icon={Package} label="Total Products" value={stats?.productCount ?? 0} color="bg-orange-500" href="/admin/products" />
          <StatCard icon={Flag} label="Pending Reports" value={stats?.pendingReports ?? 0} color="bg-red-500" href="/admin/reports" sub={stats?.pendingReports ? "⚠ Action needed" : undefined} />
          <StatCard icon={Activity} label="Active Today" value={stats?.activeToday ?? 0} sub="Logged in today" color="bg-violet-500" />
          <StatCard icon={TrendingUp} label="New Users Today" value={stats?.usersToday ?? 0} color="bg-indigo-500" />
          <StatCard icon={Package} label="Products Today" value={stats?.productsToday ?? 0} sub="Listed today" color="bg-amber-500" />
          <StatCard icon={Clock} label="Status" value="Live" sub="All systems operational" color="bg-emerald-500" />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold mb-4">User Signups — Last 7 Days</h2>
          {stats?.userGrowth && stats.userGrowth.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={stats.userGrowth}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="users" stroke="#7c3aed" fill="url(#colorUsers)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              {loading ? "Loading chart…" : "No signup data yet"}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />Recent Admin Actions
          </h2>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No recent actions</p>
          ) : (
            <div className="space-y-2">
              {recentLogs.map(l => (
                <div key={l.id} className="text-xs">
                  <p className="font-medium capitalize">{l.action.replace(/_/g, " ")}</p>
                  <p className="text-muted-foreground">{l.admin_email} · {new Date(l.created_at).toLocaleTimeString()}</p>
                </div>
              ))}
              <Link href="/admin/audit-logs" className="text-xs text-violet-600 hover:underline block mt-2">
                View all audit logs →
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-semibold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { href: "/admin/users", label: "Manage Users", icon: "👥" },
            { href: "/admin/vendors", label: "Manage Vendors", icon: "🏪" },
            { href: "/admin/products", label: "Products", icon: "📦" },
            { href: "/admin/reports", label: "View Reports", icon: "🚨" },
            { href: "/admin/notifications", label: "Send Push", icon: "🔔" },
            { href: "/admin/announcements", label: "Announcements", icon: "📢" },
            { href: "/admin/analytics", label: "Analytics", icon: "📊" },
            { href: "/admin/audit-logs", label: "Audit Logs", icon: "📋" },
            { href: "/admin/settings", label: "Settings", icon: "⚙️" },
            { href: "/admin/setup", label: "DB Setup", icon: "🗄️" },
          ].map(({ href, label, icon }) => (
            <Link key={href} href={href} className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border hover:bg-accent transition-colors text-center">
              <span className="text-2xl">{icon}</span>
              <span className="text-xs font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
