"use client"

import { useEffect, useState } from "react"
import { Flag, CheckCircle, XCircle, RefreshCw, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

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

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  reviewing: "bg-blue-100 text-blue-700 border-blue-200",
  resolved: "bg-green-100 text-green-700 border-green-200",
  dismissed: "bg-muted text-muted-foreground",
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState("pending")
  const [acting, setActing] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ action: string; reportId: string; label: string } | null>(null)
  const { toast } = useToast()

  const counts: Record<string, number> = {}
  async function loadCounts() {
    for (const s of ["pending", "reviewing", "resolved", "dismissed"]) {
      const r = await fetch(`/api/admin/reports?status=${s}`)
      const d = await r.json()
      counts[s] = (d.reports ?? []).length
    }
  }

  const [tabCounts, setTabCounts] = useState<Record<string, number>>({})

  async function load(s: string) {
    setLoading(true)
    const [mainRes, pendingRes, reviewingRes] = await Promise.all([
      fetch(`/api/admin/reports?status=${s}`).then(r => r.json()),
      fetch("/api/admin/reports?status=pending").then(r => r.json()),
      fetch("/api/admin/reports?status=reviewing").then(r => r.json()),
    ])
    setReports(mainRes.reports ?? [])
    setTabCounts(prev => ({
      ...prev,
      pending: (pendingRes.reports ?? []).length,
      reviewing: (reviewingRes.reports ?? []).length,
    }))
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
    setConfirm(null)
  }

  function targetLink(type: string, id: string) {
    if (type === "product") return `/product/${id}`
    if (type === "vendor") return `/shop/${id}`
    return null
  }

  const tabs = ["pending", "reviewing", "resolved", "dismissed"] as const

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Reports & Abuse Center</h1>
          <p className="text-muted-foreground text-sm mt-1">Review and act on user-submitted reports</p>
        </div>
        <button onClick={() => load(status)} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
        </button>
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => { setStatus(tab); load(tab) }}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              status === tab
                ? "border-violet-600 text-violet-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
            {tabCounts[tab] !== undefined && tabCounts[tab] > 0 && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab === "pending" ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"}`}>
                {tabCounts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 h-28 animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Flag className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No {status} reports</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => {
            const link = targetLink(r.target_type, r.target_id)
            return (
              <div key={r.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Badge variant="outline" className="text-xs capitalize">{r.target_type}</Badge>
                      {link ? (
                        <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground font-mono flex items-center gap-0.5 hover:text-violet-600 transition-colors">
                          {r.target_id.slice(0, 10)}… <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground font-mono">{r.target_id.slice(0, 10)}…</span>
                      )}
                      <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="font-semibold">{r.reason}</p>
                    {r.details && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{r.details}</p>}
                    {r.reporter_email && (
                      <p className="text-xs text-muted-foreground mt-2">Reported by: {r.reporter_email}</p>
                    )}
                    {r.resolved_by && (
                      <p className="text-xs text-muted-foreground mt-1">Resolved by: {r.resolved_by}</p>
                    )}
                  </div>
                  {(status === "pending" || status === "reviewing") ? (
                    <div className="flex gap-2 shrink-0 flex-wrap">
                      {status === "pending" && (
                        <button
                          disabled={acting === r.id}
                          onClick={() => setConfirm({ action: "review", reportId: r.id, label: "Mark this report as under review?" })}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                          Mark Reviewing
                        </button>
                      )}
                      <button
                        disabled={acting === r.id}
                        onClick={() => setConfirm({ action: "resolve", reportId: r.id, label: "Mark this report as resolved?" })}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />Resolve
                      </button>
                      <button
                        disabled={acting === r.id}
                        onClick={() => setConfirm({ action: "dismiss", reportId: r.id, label: "Dismiss this report as unfounded?" })}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />Dismiss
                      </button>
                    </div>
                  ) : (
                    <Badge variant="outline" className={`text-xs capitalize ${STATUS_COLORS[r.status] ?? ""}`}>
                      {r.status}
                    </Badge>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={() => setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.label}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirm && doAction(confirm.action, confirm.reportId)}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
