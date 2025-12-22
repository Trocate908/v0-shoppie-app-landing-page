"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ArrowLeft, Edit, Trash2, Eye, Loader2 } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"

type Product = {
  id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  in_stock: boolean
  view_count: number
}

type ManageProductsClientProps = {
  products: Product[]
  shopName: string
}

export function ManageProductsClient({ products: initialProducts, shopName }: ManageProductsClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [products, setProducts] = useState(initialProducts)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeleteingProduct] = useState<Product | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    inStock: true,
  })

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      description: product.description || "",
      price: product.price.toString(),
      inStock: product.in_stock,
    })
  }

  const handleUpdate = async () => {
    if (!editingProduct) return

    setIsSubmitting(true)
    const supabase = createClient()

    const { error } = await supabase
      .from("products")
      .update({
        name: formData.name,
        description: formData.description,
        price: Number.parseFloat(formData.price),
        in_stock: formData.inStock,
      })
      .eq("id", editingProduct.id)

    if (error) {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update product",
        variant: "destructive",
      })
    } else {
      // Update local state
      setProducts(
        products.map((p) =>
          p.id === editingProduct.id
            ? {
                ...p,
                name: formData.name,
                description: formData.description,
                price: Number.parseFloat(formData.price),
                in_stock: formData.inStock,
              }
            : p,
        ),
      )
      setEditingProduct(null)
      toast({
        title: "Product updated",
        description: "Your product has been updated successfully",
      })
      router.refresh()
    }

    setIsSubmitting(false)
  }

  const handleToggleStock = async (productId: string, currentStock: boolean) => {
    const supabase = createClient()

    const { error } = await supabase.from("products").update({ in_stock: !currentStock }).eq("id", productId)

    if (error) {
      toast({
        title: "Update failed",
        description: error.message || "Failed to toggle stock status",
        variant: "destructive",
      })
    } else {
      // Update local state
      setProducts(products.map((p) => (p.id === productId ? { ...p, in_stock: !currentStock } : p)))
      toast({
        title: "Stock updated",
        description: `Product marked as ${!currentStock ? "in stock" : "out of stock"}`,
      })
      router.refresh()
    }
  }

  const handleDelete = async () => {
    if (!deletingProduct) return

    setIsSubmitting(true)
    const supabase = createClient()

    try {
      // Delete image from storage if exists
      if (deletingProduct.image_url) {
        const path = deletingProduct.image_url.split("/product-images/")[1]
        if (path) {
          await supabase.storage.from("product-images").remove([path])
        }
      }

      // Delete product from database (cascade will delete views)
      const { error } = await supabase.from("products").delete().eq("id", deletingProduct.id)

      if (error) {
        toast({
          title: "Delete failed",
          description: error.message || "Failed to delete product",
          variant: "destructive",
        })
      } else {
        // Update local state
        setProducts(products.filter((p) => p.id !== deletingProduct.id))
        setDeleteingProduct(null)
        toast({
          title: "Product deleted",
          description: "Your product has been deleted successfully",
        })
        router.refresh()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }

    setIsSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/vendor/dashboard">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Manage Products</h1>
                <p className="text-sm text-muted-foreground">{shopName}</p>
              </div>
            </div>
            <Button asChild>
              <Link href="/vendor/products/add">Add Product</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {products.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">No products yet</p>
              <Button asChild>
                <Link href="/vendor/products/add">Add Your First Product</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <Card key={product.id}>
                <CardHeader className="p-0">
                  {product.image_url ? (
                    <div className="relative h-48 w-full overflow-hidden rounded-t-lg">
                      <Image
                        src={product.image_url || "/placeholder.svg"}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                      />
                    </div>
                  ) : (
                    <div className="flex h-48 items-center justify-center rounded-t-lg bg-muted">
                      <span className="text-muted-foreground">No image</span>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{product.name}</h3>
                      <p className="text-lg font-bold text-primary">${product.price.toFixed(2)}</p>
                    </div>
                    <Badge variant={product.in_stock ? "default" : "secondary"} className="shrink-0">
                      {product.in_stock ? "In Stock" : "Out"}
                    </Badge>
                  </div>

                  {product.description && (
                    <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
                  )}

                  <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    <span>{product.view_count} views</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(product)}
                      className="flex-1 min-w-[80px]"
                    >
                      <Edit className="mr-1 h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStock(product.id, product.in_stock)}
                      className="flex-1 min-w-[80px]"
                    >
                      {product.in_stock ? "Mark Out" : "Mark In"}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setDeleteingProduct(product)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Edit Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update product details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Product Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-price">Price</Label>
              <Input
                id="edit-price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-stock">In Stock</Label>
              <Switch
                id="edit-stock"
                checked={formData.inStock}
                onCheckedChange={(checked) => setFormData({ ...formData, inStock: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProduct(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeleteingProduct(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingProduct?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteingProduct(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
