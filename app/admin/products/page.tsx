"use client"

import { useEffect, useState } from "react"
import { Search, Eye, EyeOff, Star, Trash2, MoreVertical } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Image from "next/image"

interface Product {
  id: string
  name: string
  price: number
  category: string
  image_url: string | null
  in_stock: boolean
  is_hidden: boolean
  is_featured: boolean
  created_at: string
  vendor_id: string
  vendors: { shop_name: string } | null
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [filtered, setFiltered] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [confirm, setConfirm] = useState<{ action: string; productId: string; label: string } | null>(null)
  const { toast } = useToast()

  async function load(status?: string) {
    setLoading(true)
    const params = status && status !== "all" ? `?status=${status}` : ""
    const r = await fetch(`/api/admin/products${params}`)
    const d = await r.json()
    setProducts(d.products ?? [])
    setFiltered(d.products ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const q = query.toLowerCase()
    setFiltered(q ? products.filter(p => p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q) || (p.vendors as any)?.shop_name?.toLowerCase().includes(q)) : products)
  }, [query, products])

  function handleStatusFilter(v: string) {
    setStatusFilter(v)
    load(v)
  }

  async function doAction(action: string, productId: string) {
    const r = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, productId }),
    })
    const d = await r.json()
    if (!r.ok) toast({ title: "Error", description: d.error, variant: "destructive" })
    else { toast({ title: "Done", description: `Product ${action}d` }); load(statusFilter) }
    setConfirm(null)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Product Moderation</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} products shown</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={handleStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              <SelectItem value="hidden">Hidden</SelectItem>
              <SelectItem value="featured">Featured</SelectItem>
              <SelectItem value="out_of_stock">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products…" className="pl-9" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Product</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Vendor</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Category</th>
                <th className="text-left px-4 py-3 font-medium">Price</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No products found</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.image_url ? (
                        <Image src={p.image_url} alt={p.name} width={40} height={40} className="rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">📦</div>
                      )}
                      <span className="font-medium truncate max-w-[150px]">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                    {(p.vendors as any)?.shop_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{p.category}</td>
                  <td className="px-4 py-3 font-medium">ZWL {p.price}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {p.is_hidden && <Badge variant="destructive" className="text-xs">Hidden</Badge>}
                      {p.is_featured && <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Featured</Badge>}
                      {!p.in_stock && <Badge variant="secondary" className="text-xs">Out of Stock</Badge>}
                      {!p.is_hidden && p.in_stock && !p.is_featured && <Badge variant="outline" className="text-green-600 border-green-200 text-xs">Active</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="p-1.5 rounded hover:bg-accent">
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {p.is_hidden ? (
                          <DropdownMenuItem onClick={() => setConfirm({ action: "restore", productId: p.id, label: "Restore and make this product visible?" })}>
                            <Eye className="h-4 w-4 mr-2 text-green-500" />Restore
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => setConfirm({ action: "hide", productId: p.id, label: "Hide this product from the platform?" })}>
                            <EyeOff className="h-4 w-4 mr-2 text-orange-500" />Hide Product
                          </DropdownMenuItem>
                        )}
                        {p.is_featured ? (
                          <DropdownMenuItem onClick={() => setConfirm({ action: "unfeature", productId: p.id, label: "Remove featured status?" })}>
                            <Star className="h-4 w-4 mr-2" />Remove Featured
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => setConfirm({ action: "feature", productId: p.id, label: "Feature this product on the platform?" })}>
                            <Star className="h-4 w-4 mr-2 text-amber-500" />Feature Product
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-destructive" onClick={() => setConfirm({ action: "delete", productId: p.id, label: "Permanently delete this product?" })}>
                          <Trash2 className="h-4 w-4 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={() => setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.label}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirm && doAction(confirm.action, confirm.productId)}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
