"use client"

import { useEffect, useState } from "react"
import { Search, CheckCircle, XCircle, Pause, Trash2, MoreVertical, RefreshCw, Play } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Image from "next/image"

interface Vendor {
  id: string
  shop_name: string
  is_verified: boolean
  is_open: boolean
  verification_status: string
  profile_picture_url: string | null
  product_count: number
  created_at: string
  locations: { city: string; country: string; market_name: string } | null
}

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [filtered, setFiltered] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [confirm, setConfirm] = useState<{ action: string; vendorId: string; label: string } | null>(null)
  const { toast } = useToast()

  async function load() {
    setLoading(true)
    const r = await fetch("/api/admin/vendors")
    const d = await r.json()
    setVendors(d.vendors ?? [])
    setFiltered(d.vendors ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    let result = vendors
    if (query) {
      const q = query.toLowerCase()
      result = result.filter(v => v.shop_name?.toLowerCase().includes(q))
    }
    if (statusFilter === "verified") result = result.filter(v => v.is_verified)
    if (statusFilter === "unverified") result = result.filter(v => !v.is_verified)
    if (statusFilter === "open") result = result.filter(v => v.is_open)
    if (statusFilter === "closed") result = result.filter(v => !v.is_open)
    setFiltered(result)
  }, [query, statusFilter, vendors])

  async function doAction(action: string, vendorId: string) {
    const r = await fetch("/api/admin/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, vendorId }),
    })
    const d = await r.json()
    if (!r.ok) toast({ title: "Error", description: d.error, variant: "destructive" })
    else { toast({ title: "Done", description: `Vendor ${action}d successfully` }); load() }
    setConfirm(null)
  }

  const statsBar = [
    { label: "Total", value: vendors.length, color: "text-blue-600" },
    { label: "Verified", value: vendors.filter(v => v.is_verified).length, color: "text-green-600" },
    { label: "Open", value: vendors.filter(v => v.is_open).length, color: "text-emerald-600" },
    { label: "Closed", value: vendors.filter(v => !v.is_open).length, color: "text-red-600" },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Vendor Management</h1>
          <div className="flex gap-4 mt-1">
            {statsBar.map(s => (
              <span key={s.label} className="text-xs text-muted-foreground">
                {s.label}: <span className={`font-semibold ${s.color}`}>{s.value}</span>
              </span>
            ))}
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search vendors…" className="pl-9" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Filter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vendors</SelectItem>
            <SelectItem value="verified">Verified Only</SelectItem>
            <SelectItem value="unverified">Unverified Only</SelectItem>
            <SelectItem value="open">Open Shops</SelectItem>
            <SelectItem value="closed">Closed Shops</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} vendor{filtered.length !== 1 ? "s" : ""} shown</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 h-44 animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-muted-foreground">No vendors found</div>
        ) : filtered.map(v => (
          <div key={v.id} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                {v.profile_picture_url ? (
                  <Image src={v.profile_picture_url} alt={v.shop_name} width={40} height={40} className="rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 text-lg">🏪</div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold truncate">{v.shop_name}</p>
                  <p className="text-xs text-muted-foreground">{v.locations?.city ?? "—"}{v.locations?.country ? `, ${v.locations.country}` : ""}</p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger className="p-1.5 rounded hover:bg-accent shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {v.is_verified ? (
                    <DropdownMenuItem onClick={() => setConfirm({ action: "unverify", vendorId: v.id, label: "Remove verified badge from this vendor?" })}>
                      <XCircle className="h-4 w-4 mr-2 text-orange-500" />Remove Verification
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => setConfirm({ action: "verify", vendorId: v.id, label: "Grant verified badge to this vendor?" })}>
                      <CheckCircle className="h-4 w-4 mr-2 text-green-500" />Verify Vendor
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {v.is_open ? (
                    <DropdownMenuItem onClick={() => setConfirm({ action: "suspend", vendorId: v.id, label: "Suspend this vendor's shop? It will appear closed to buyers." })}>
                      <Pause className="h-4 w-4 mr-2 text-amber-500" />Suspend Shop
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => setConfirm({ action: "reopen", vendorId: v.id, label: "Re-open this vendor's shop?" })}>
                      <Play className="h-4 w-4 mr-2 text-green-500" />Re-open Shop
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => setConfirm({ action: "delete", vendorId: v.id, label: "Delete this vendor and all their data permanently?" })}>
                    <Trash2 className="h-4 w-4 mr-2" />Delete Vendor
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {v.is_verified && (
                <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" />Verified
                </Badge>
              )}
              <Badge variant={v.is_open ? "outline" : "secondary"} className={`text-xs ${v.is_open ? "text-green-600 border-green-200" : ""}`}>
                {v.is_open ? "Open" : "Closed"}
              </Badge>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-2">
              <span>{v.product_count} product{v.product_count !== 1 ? "s" : ""}</span>
              <span>Since {new Date(v.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>

      <AlertDialog open={!!confirm} onOpenChange={() => setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.label}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirm && doAction(confirm.action, confirm.vendorId)}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
