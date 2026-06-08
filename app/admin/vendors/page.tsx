"use client"

import { useEffect, useState } from "react"
import { Search, CheckCircle, XCircle, Pause, Trash2, MoreVertical } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
    const q = query.toLowerCase()
    setFiltered(q ? vendors.filter(v => v.shop_name?.toLowerCase().includes(q)) : vendors)
  }, [query, vendors])

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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Vendor Management</h1>
          <p className="text-muted-foreground text-sm">{vendors.length} total vendors</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search vendors…" className="pl-9" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 h-40 animate-pulse" />
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
                  <p className="text-xs text-muted-foreground">{v.locations?.city ?? "—"}</p>
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
                  <DropdownMenuItem onClick={() => setConfirm({ action: "suspend", vendorId: v.id, label: "Suspend this vendor's shop?" })}>
                    <Pause className="h-4 w-4 mr-2 text-amber-500" />Suspend Shop
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => setConfirm({ action: "delete", vendorId: v.id, label: "Delete this vendor permanently?" })}>
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
              <Badge variant={v.is_open ? "outline" : "secondary"} className="text-xs">
                {v.is_open ? "Open" : "Closed"}
              </Badge>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{v.product_count} products</span>
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
