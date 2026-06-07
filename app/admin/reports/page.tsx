"use client"

import { useEffect, useState } from "react"
import { Flag, CheckCircle, XCircle, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Report {
  id: string
  target_type: string
  target_id: string
  reason: string
  details: string | null
  reporter_email: string | null
  status: string
  resolved_by: string | null
  created_at: string
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState("pending")
  const [acting, setActing] = useState<string | null>(null)
  const { toast } = useToast()

  async function load(s: string) {
    setLoading(true)
    const r = await fetch(`/api/admin/reports?status=${s}`)
    const d = await r.json()
    setReports(d.reports ?? [])
    setLoading(false)
  }

  useEffect(() => { load(status) }, [status])

  async function doAction(action: string, reportId: string) {
    setActing(reportId)
    const r = await fetch("/api/admin/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reportId }),
    })
    const d = await r.json()
    if (!r.ok) toast({ title: "Error", description: d.error, variant: "destructive" })
    else { toast({ title: "Done", description: `Report ${action}d` }); load(status) }
    setActing(null)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Reports & Abuse Center</h1>
          <p className="text-muted-foreground text-sm">{reports.length} {status} reports</p>
        </div>
        <Select value={status} onValueChange={s => { setStatus(s); load(s) }}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reviewing">Reviewing</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 h-24 animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Flag className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No {status} reports</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline" className="text-xs capitalize">{r.target_type}</Badge>
                    <span className="text-xs text-muted-foreground font-mono">{r.target_id.slice(0, 8)}…</span>
                    <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="font-medium">{r.reason}</p>
                  {r.details && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{r.details}</p>}
                  {r.reporter_email && (
                    <p className="text-xs text-muted-foreground mt-2">Reported by: {r.reporter_email}</p>
                  )}
                </div>
                {status === "pending" || status === "reviewing" ? (
                  <div className="flex gap-2 shrink-0">
                    <button
                      disabled={acting === r.id}
                      onClick={() => doAction("resolve", r.id)}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />Resolve
                    </button>
                    <button
                      disabled={acting === r.id}
                      onClick={() => doAction("dismiss", r.id)}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />Dismiss
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {r.status === "resolved" ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4" />}
                    {r.status} by {r.resolved_by ?? "—"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
