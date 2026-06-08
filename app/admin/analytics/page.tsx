"use client"

import { useEffect, useState } from "react"
import { BarChart2 } from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area,
} from "recharts"

interface AnalyticsData {
  userGrowth: { date: string; users: number }[]
  productGrowth: { date: string; products: number }[]
  topCategories: { category: string; count: number }[]
  totalUsers: number
  totalProducts: number
  vendorCount: number
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const skeleton = <div className="bg-card border border-border rounded-xl p-6 h-64 animate-pulse" />

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart2 className="h-6 w-6 text-violet-600" />
          Analytics Center
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Platform growth and engagement metrics</p>
      </div>

      {loading ? (
        <div className="grid lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <div key={i}>{skeleton}</div>)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Users", value: data?.totalUsers ?? 0, color: "text-blue-600" },
              { label: "Total Products", value: data?.totalProducts ?? 0, color: "text-green-600" },
              { label: "Total Vendors", value: data?.vendorCount ?? 0, color: "text-violet-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-5 text-center">
                <p className={`text-3xl font-bold tabular-nums ${color}`}>{value}</p>
                <p className="text-sm text-muted-foreground mt-1">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-semibold mb-4">User Signups — Last 7 Days</h2>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data?.userGrowth ?? []}>
                  <defs>
                    <linearGradient id="ug" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="users" stroke="#7c3aed" fill="url(#ug)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-semibold mb-4">Products Listed — Last 7 Days</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data?.productGrowth ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="products" stroke="#16a34a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 lg:col-span-2">
              <h2 className="font-semibold mb-4">Top Categories by Product Count</h2>
              {data?.topCategories && data.topCategories.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.topCategories}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No category data available</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
