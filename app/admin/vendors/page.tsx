"use client"

import { useEffect, useState } from "react"
import { Search, ShieldCheck, ShieldOff, Pause, Play, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Vendor {
  id: string
  shop_name: string
  shop_description: string | null
  is_open: boolean
  is_suspended: boolean | null
  verification_status: string | null
  created_at: string
  locations: { city: string; country: string } | null
}

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  function load() {
    fetch("/api/admin/vendors").then(r => r.json()).then(d => {
      setVendors(d.vendors ?? [])
      setLoading(false)
    })
  }

  useEffect(load, [])

  async function action(vendorId: string, act: string) {
    const r = await fetch("/api/admin/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: act, vendorId }),
    })
    const d = await r.json()
    if (!r.ok) { toast({ variant: "destructive", title: "Error", description: d.error }); return }
    toast({ title: "Done" })
    load()
  }

  const filtered = vendors.filter(v =>
    v.shop_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Vendors</h1>
        <p className="text-sm text-muted-foreground">{vendors.length} registered vendors — all have instant access, no approval required</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search shops…"
          className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg bg-card text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(v => (
            <div key={v.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold truncate">{v.shop_name}</p>
                    {v.verification_status === "verified" && (
                      <ShieldCheck className="h-4 w-4 text-blue-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {v.locations?.city}, {v.locations?.country} · {new Date(v.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {v.is_suspended ? (
                    <span className="text-xs bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 px-2 py-0.5 rounded-full">Suspended</span>
                  ) : (
                    <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 px-2 py-0.5 rounded-full">Active</span>
                  )}
                </div>
              </div>
              {v.shop_description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{v.shop_description}</p>
              )}
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => action(v.id, v.verification_status === "verified" ? "unverify" : "verify")}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
                >
                  {v.verification_status === "verified" ? <><ShieldOff className="h-3.5 w-3.5" />Unverify</> : <><ShieldCheck className="h-3.5 w-3.5" />Verify</>}
                </button>
                <button
                  onClick={() => action(v.id, v.is_suspended ? "unsuspend" : "suspend")}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
                >
                  {v.is_suspended ? <><Play className="h-3.5 w-3.5" />Restore</> : <><Pause className="h-3.5 w-3.5" />Suspend</>}
                </button>
                <button
                  onClick={() => action(v.id, "delete")}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />Delete
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-2 text-center py-10">No vendors found</p>
          )}
        </div>
      )}
    </div>
  )
}
