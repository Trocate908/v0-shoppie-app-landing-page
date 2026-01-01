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
import { ArrowLeft, Upload, Loader2, X } from "lucide-react"
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
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    inStock: true,
  })

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])

    if (imageFiles.length + files.length > 3) {
      toast({
        title: "Too many images",
        description: "You can upload a maximum of 3 images per product",
        variant: "destructive",
      })
      return
    }

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} is over 5MB. Please select smaller images.`,
          variant: "destructive",
        })
        return
      }
    }

    const newFiles = [...imageFiles, ...files]
    setImageFiles(newFiles)

    files.forEach((file) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreviews((prev) => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
  }

  const handleRemoveImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
    setImagePreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const supabase = createClient()

    try {
      const imageUrls: { url: string; alt: string }[] = []

      for (const file of imageFiles) {
        const formDataCloudinary = new FormData()
        formDataCloudinary.append("file", file)
        formDataCloudinary.append("upload_preset", "shoppieapp_products")
        formDataCloudinary.append("folder", `vendors/${vendorId}`)

        const cloudinaryResponse = await fetch("https://api.cloudinary.com/v1_1/dibqpzu1j/image/upload", {
          method: "POST",
          body: formDataCloudinary,
        })

        if (!cloudinaryResponse.ok) {
          toast({
            title: "Upload failed",
            description: `Failed to upload ${file.name}. Please try again.`,
            variant: "destructive",
          })
          setIsSubmitting(false)
          return
        }

        const cloudinaryData = await cloudinaryResponse.json()
        imageUrls.push({
          url: cloudinaryData.secure_url,
          alt: formData.name,
        })
      }

      const { error: insertError } = await supabase.from("products").insert({
        vendor_id: vendorId,
        name: formData.name,
        description: formData.description,
        price: Number.parseFloat(formData.price),
        images: imageUrls,
        image_url: imageUrls[0]?.url || null,
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

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
              <CardDescription>Add a new product to your shop</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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

              <div className="space-y-2">
                <Label htmlFor="images">Product Images (Max 3)</Label>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById("images")?.click()}
                      disabled={imageFiles.length >= 3}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Choose Images
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {imageFiles.length === 0
                        ? "No images chosen"
                        : `${imageFiles.length} image${imageFiles.length > 1 ? "s" : ""} selected`}
                    </span>
                  </div>
                  <Input
                    id="images"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  {imagePreviews.length > 0 && (
                    <div className="grid grid-cols-3 gap-4">
                      {imagePreviews.map((preview, index) => (
                        <div key={index} className="relative">
                          <div className="relative h-32 w-full overflow-hidden rounded-lg border border-border">
                            <Image
                              src={preview || "/placeholder.svg"}
                              alt={`Preview ${index + 1}`}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute -right-2 -top-2 h-6 w-6"
                            onClick={() => handleRemoveImage(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

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
