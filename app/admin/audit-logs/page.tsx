"use client"

import { useEffect, useState } from "react"
import { ClipboardList } from "lucide-react"

interface Log {
  id: string
  admin_email: string
  action: string
  target_type: string | null
  target_id: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    fetch("/api/admin/audit?limit=200").then(r => r.json()).then(d => {
      if (d.error) setMissing(true)
      setLogs(d.logs ?? [])
      setLoading(false)
    })
  }, [])

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">All admin actions are recorded here</p>
      </div>

      {missing && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
          The <code>audit_logs</code> table doesn't exist yet. Run the migration from <a href="/admin/setup" className="underline">DB Setup</a>.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : logs.length === 0 && !missing ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No audit events yet</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {logs.map(log => (
            <div key={log.id} className="px-4 py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{log.action.replace(/_/g, " ")}</p>
                <p className="text-xs text-muted-foreground">
                  {log.admin_email}
                  {log.target_type ? ` · ${log.target_type}` : ""}
                  {log.ip_address ? ` · ${log.ip_address}` : ""}
                </p>
              </div>
              <p className="text-xs text-muted-foreground shrink-0">{new Date(log.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
