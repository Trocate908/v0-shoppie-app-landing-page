"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Upload, Loader2 } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"

type AddProductFormProps = {
  vendorId: string
  shopName: string
}

export function AddProductForm({ vendorId, shopName }: AddProductFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    inStock: true,
  })

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image under 5MB",
          variant: "destructive",
        })
        return
      }

      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const supabase = createClient()

    try {
      let imageUrl = null

      // Upload image to Supabase Storage if provided
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop()
        const fileName = `${vendorId}/${Date.now()}.${fileExt}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(fileName, imageFile, {
            cacheControl: "3600",
            upsert: false,
          })

        if (uploadError) {
          toast({
            title: "Upload failed",
            description: uploadError.message || "Failed to upload image. Please try again.",
            variant: "destructive",
          })
          setIsSubmitting(false)
          return
        }

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from("product-images").getPublicUrl(uploadData.path)

        imageUrl = publicUrl
      }

      // Insert product into database
      const { error: insertError } = await supabase.from("products").insert({
        vendor_id: vendorId,
        name: formData.name,
        description: formData.description,
        price: Number.parseFloat(formData.price),
        image_url: imageUrl,
        in_stock: formData.inStock,
      })

      if (insertError) {
        toast({
          title: "Failed to create product",
          description: insertError.message || "Please try again.",
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      toast({
        title: "Product added",
        description: "Your product has been added successfully",
      })

      // Success - redirect to manage products page
      router.push("/vendor/products")
      router.refresh()
    } catch (error) {
      toast({
        title: "Unexpected error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/vendor/dashboard">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Add Product</h1>
              <p className="text-sm text-muted-foreground">{shopName}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
              <CardDescription>Add a new product to your shop</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Product Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter product name"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter product description"
                  rows={4}
                />
              </div>

              {/* Price */}
              <div className="space-y-2">
                <Label htmlFor="price">Price *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label htmlFor="image">Product Image</Label>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Button type="button" variant="outline" onClick={() => document.getElementById("image")?.click()}>
                      <Upload className="mr-2 h-4 w-4" />
                      Choose Image
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {imageFile ? imageFile.name : "No file chosen"}
                    </span>
                  </div>
                  <Input id="image" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  {imagePreview && (
                    <div className="relative h-48 w-48 overflow-hidden rounded-lg border border-border">
                      <Image src={imagePreview || "/placeholder.svg"} alt="Preview" fill className="object-cover" />
                    </div>
                  )}
                </div>
              </div>

              {/* In Stock Toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="in-stock">In Stock</Label>
                  <p className="text-sm text-muted-foreground">Product is available for purchase</p>
                </div>
                <Switch
                  id="in-stock"
                  checked={formData.inStock}
                  onCheckedChange={(checked) => setFormData({ ...formData, inStock: checked })}
                />
              </div>

              {/* Submit Button */}
              <div className="flex gap-4">
                <Button type="submit" disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding Product...
                    </>
                  ) : (
                    "Add Product"
                  )}
                </Button>
                <Button type="button" variant="outline" asChild disabled={isSubmitting}>
                  <Link href="/vendor/products">Cancel</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </main>
    </div>
  )
}
