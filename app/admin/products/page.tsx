"use client"

import { useEffect, useState } from "react"
import { Search, EyeOff, Eye, Star, StarOff, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
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
  vendors: { shop_name: string } | null
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  function load() {
    fetch("/api/admin/products").then(r => r.json()).then(d => {
      setProducts(d.products ?? [])
      setLoading(false)
    })
  }

  useEffect(load, [])

  async function action(productId: string, act: string) {
    const r = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: act, productId }),
    })
    const d = await r.json()
    if (!r.ok) { toast({ variant: "destructive", title: "Error", description: d.error }); return }
    toast({ title: "Done" })
    load()
  }

  const filtered = products
    .filter(p => {
      if (filter === "hidden") return p.is_hidden
      if (filter === "featured") return p.is_featured
      if (filter === "out_of_stock") return !p.in_stock
      return true
    })
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Products</h1>
        <p className="text-sm text-muted-foreground">{products.length} total products</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg bg-card text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="px-3 py-2.5 border border-border rounded-lg bg-card text-sm focus:outline-none"
        >
          <option value="all">All</option>
          <option value="hidden">Hidden</option>
          <option value="featured">Featured</option>
          <option value="out_of_stock">Out of stock</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {filtered.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              {p.image_url ? (
                <Image src={p.image_url} alt={p.name} width={48} height={48} className="rounded-lg object-cover w-12 h-12 shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-muted shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">${p.price} · {p.vendors?.shop_name ?? "—"} · {p.category}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {p.is_hidden && <span className="text-xs bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 px-2 py-0.5 rounded-full">Hidden</span>}
                {p.is_featured && <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 px-2 py-0.5 rounded-full">Featured</span>}
                <button onClick={() => action(p.id, p.is_hidden ? "unhide" : "hide")} title={p.is_hidden ? "Show" : "Hide"} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground">
                  {p.is_hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button onClick={() => action(p.id, p.is_featured ? "unfeature" : "feature")} title={p.is_featured ? "Unfeature" : "Feature"} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground">
                  {p.is_featured ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                </button>
                <button onClick={() => action(p.id, "delete")} title="Delete" className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">No products found</p>
          )}
        </div>
      )}
    </div>
  )
}
