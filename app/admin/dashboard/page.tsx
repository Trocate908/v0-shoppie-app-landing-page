"use client"

import { useEffect, useState } from "react"
import { Users, Store, Package, Flag, Activity, TrendingUp, ShieldCheck, Clock } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

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

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: typeof Users; label: string; value: number | string; sub?: string; color: string
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-start gap-4">
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
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/stats").then(r => r.json()).then(d => {
      setStats(d)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-violet-600" />
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Platform overview and key metrics</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total Users" value={stats?.totalUsers ?? 0} color="bg-blue-500" />
          <StatCard icon={Store} label="Total Vendors" value={stats?.vendorCount ?? 0} color="bg-green-500" />
          <StatCard icon={Package} label="Total Products" value={stats?.productCount ?? 0} color="bg-orange-500" />
          <StatCard icon={Flag} label="Pending Reports" value={stats?.pendingReports ?? 0} color="bg-red-500" />
          <StatCard icon={Activity} label="Active Today" value={stats?.activeToday ?? 0} sub="Users logged in today" color="bg-violet-500" />
          <StatCard icon={TrendingUp} label="New Users Today" value={stats?.usersToday ?? 0} color="bg-indigo-500" />
          <StatCard icon={Package} label="Products Today" value={stats?.productsToday ?? 0} sub="Listed today" color="bg-amber-500" />
          <StatCard icon={Clock} label="Platform Status" value="Live" sub="All systems operational" color="bg-emerald-500" />
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-6">
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
            {loading ? "Loading chart…" : "No signup data available"}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-semibold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: "/admin/users", label: "Manage Users", icon: "👥" },
            { href: "/admin/vendors", label: "Manage Vendors", icon: "🏪" },
            { href: "/admin/reports", label: "View Reports", icon: "🚨" },
            { href: "/admin/audit-logs", label: "Audit Logs", icon: "📋" },
          ].map(({ href, label, icon }) => (
            <a key={href} href={href} className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:bg-accent transition-colors text-center">
              <span className="text-2xl">{icon}</span>
              <span className="text-sm font-medium">{label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
