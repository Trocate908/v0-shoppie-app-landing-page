"use client"

import { useEffect, useState } from "react"
import { ClipboardList, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface AuditLog {
  id: string
  admin_email: string
  action: string
  target_type: string | null
  target_id: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

const ACTION_COLORS: Record<string, string> = {
  ban_user: "bg-red-100 text-red-700",
  unban_user: "bg-green-100 text-green-700",
  delete_user: "bg-red-100 text-red-700",
  verify_email: "bg-blue-100 text-blue-700",
  reset_password: "bg-amber-100 text-amber-700",
  vendor_verify: "bg-green-100 text-green-700",
  vendor_suspend: "bg-orange-100 text-orange-700",
  vendor_delete: "bg-red-100 text-red-700",
  product_hide: "bg-orange-100 text-orange-700",
  product_restore: "bg-green-100 text-green-700",
  product_delete: "bg-red-100 text-red-700",
  product_feature: "bg-amber-100 text-amber-700",
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const r = await fetch("/api/admin/audit")
    const d = await r.json()
    setLogs(d.logs ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground text-sm">{logs.length} recent actions</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="px-4 py-3 h-14 animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No audit logs yet</p>
            <p className="text-xs mt-1">Actions you take will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Time</th>
                  <th className="text-left px-4 py-3 font-medium">Admin</th>
                  <th className="text-left px-4 py-3 font-medium">Action</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Target</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map(l => (
                  <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 truncate max-w-[140px]">{l.admin_email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[l.action] ?? "bg-muted text-muted-foreground"}`}>
                        {l.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground text-xs">
                      {l.target_type && <span className="capitalize">{l.target_type}</span>}
                      {l.target_id && <span className="ml-1 font-mono">{l.target_id.slice(0, 8)}…</span>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">{l.ip_address ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
