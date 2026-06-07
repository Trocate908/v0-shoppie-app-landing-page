"use client"

import { useEffect, useState } from "react"
import { CheckCircle, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Report {
  id: string
  reporter_email: string | null
  target_type: string
  target_id: string
  reason: string
  details: string | null
  status: string
  created_at: string
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [tab, setTab] = useState("pending")
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  function load() {
    setLoading(true)
    fetch(`/api/admin/reports?status=${tab}`).then(r => r.json()).then(d => {
      setReports(d.reports ?? [])
      setLoading(false)
    })
  }

  useEffect(load, [tab])

  async function action(reportId: string, act: "resolve" | "dismiss") {
    const r = await fetch("/api/admin/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: act, reportId }),
    })
    if (!r.ok) { const d = await r.json(); toast({ variant: "destructive", title: "Error", description: d.error }); return }
    toast({ title: act === "resolve" ? "Resolved" : "Dismissed" })
    load()
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">User-submitted content reports</p>
      </div>

      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {["pending", "resolved", "dismissed"].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">No {tab} reports</div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{r.reason}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.target_type} · {r.reporter_email ?? "Anonymous"} · {new Date(r.created_at).toLocaleDateString()}
                  </p>
                  {r.details && <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{r.details}</p>}
                </div>
                {tab === "pending" && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => action(r.id, "resolve")}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />Resolve
                    </button>
                    <button
                      onClick={() => action(r.id, "dismiss")}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />Dismiss
                    </button>
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
