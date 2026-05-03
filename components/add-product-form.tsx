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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Upload, Loader2, X, Shield, Images, Camera, MessageCircle, Wand2 } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"
import { ImageCropperDialog } from "@/components/image-cropper-dialog"
import { PexelsImagePickerDialog } from "@/components/pexels-image-picker-dialog"
import { CameraDialog } from "@/components/camera-dialog"
import { PRODUCT_CATEGORIES } from "@/lib/constants"

type AddProductFormProps = {
  vendorId: string
  shopName: string
  isVerified: boolean
  hasWhatsapp: boolean
}

export function AddProductForm({ vendorId, shopName, isVerified, hasWhatsapp }: AddProductFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [cropperOpen, setCropperOpen] = useState(false)
  const [pexelsOpen, setPexelsOpen] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [currentImageSrc, setCurrentImageSrc] = useState<string>("")
  const [currentFileName, setCurrentFileName] = useState<string>("")
  const [whatsappNumber, setWhatsappNumber] = useState("")
  const [removingBgIndex, setRemovingBgIndex] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    price: "",
    inStock: true,
  })

  const maxImages = isVerified ? 3 : 1

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])

    if (imageFiles.length + files.length > maxImages) {
      toast({
        title: "Too many images",
        description: `${isVerified ? "Verified vendors" : "You"} can upload up to ${maxImages} image${maxImages > 1 ? "s" : ""}`,
        variant: "destructive",
      })
      return
    }

    const file = files[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: `${file.name} is over 5MB`,
        variant: "destructive",
      })
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setCurrentImageSrc(reader.result as string)
      setCurrentFileName(file.name)
      setCropperOpen(true)
    }
    reader.readAsDataURL(file)

    // Reset input
    e.target.value = ""
  }

  const handleCropComplete = (croppedFile: File) => {
    setImageFiles((prev) => [...prev, croppedFile])

    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreviews((prev) => [...prev, reader.result as string])
    }
    reader.readAsDataURL(croppedFile)

    toast({
      title: "Image added",
      description: "Your cropped image has been added",
    })
  }

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
    setImagePreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const handlePexelsSelect = (cloudinaryUrl: string, fileName: string) => {
    // Create a placeholder file entry (URL-based, already on Cloudinary)
    // We store the cloudinary URL directly as a "pre-uploaded" sentinel
    setImageFiles((prev) => [...prev, new File([], fileName)])
    setImagePreviews((prev) => [...prev, cloudinaryUrl])
    toast({
      title: "Image added",
      description: "Stock photo has been added to your product",
    })
  }

  const handleCameraCapture = (file: File, previewUrl: string) => {
    if (imageFiles.length >= maxImages) {
      toast({
        title: "Too many images",
        description: `You can upload up to ${maxImages} image${maxImages > 1 ? "s" : ""}`,
        variant: "destructive",
      })
      return
    }
    // Run through cropper so user can adjust framing
    setCurrentImageSrc(previewUrl)
    setCurrentFileName(file.name)
    setCropperOpen(true)
  }

  const handleRemoveBg = async (index: number) => {
    const file = imageFiles[index]
    const preview = imagePreviews[index]

    // For Pexels / already-uploaded URLs, fetch the image first
    let blob: Blob
    if (preview.startsWith("https://")) {
      setRemovingBgIndex(index)
      try {
        const res = await fetch(preview)
        blob = await res.blob()
      } catch {
        toast({ title: "Could not load image", variant: "destructive" })
        setRemovingBgIndex(null)
        return
      }
    } else {
      blob = file
    }

    setRemovingBgIndex(index)
    try {
      const fd = new FormData()
      fd.append("image_file", blob, "image.png")

      const res = await fetch("/api/remove-bg", { method: "POST", body: fd })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }))
        toast({ title: "Background removal failed", description: error, variant: "destructive" })
        return
      }

      const resultBlob = await res.blob()
      const newFile = new File([resultBlob], `${file.name.replace(/\.[^.]+$/, "")}_nobg.png`, {
        type: "image/png",
      })
      const newPreview = URL.createObjectURL(resultBlob)

      setImageFiles((prev) => prev.map((f, i) => (i === index ? newFile : f)))
      setImagePreviews((prev) => prev.map((p, i) => (i === index ? newPreview : p)))

      toast({ title: "Background removed!", description: "Looking clean." })
    } catch {
      toast({ title: "Unexpected error", description: "Background removal failed.", variant: "destructive" })
    } finally {
      setRemovingBgIndex(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Validate WhatsApp number if provided
    if (!hasWhatsapp && whatsappNumber && !/^\+?[1-9]\d{1,14}$/.test(whatsappNumber.replace(/\s/g, ""))) {
      toast({
        title: "Invalid WhatsApp number",
        description: "Please enter a valid number with country code (e.g., +265991234567)",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    const supabase = createClient()

    try {
      const imageUrls: string[] = []

      for (let i = 0; i < imageFiles.length; i++) {
        const imageFile = imageFiles[i]
        const preview = imagePreviews[i]

        // If this image was picked from Pexels it's already on Cloudinary
        if (preview.startsWith("https://res.cloudinary.com")) {
          imageUrls.push(preview)
          continue
        }

        const uploadForm = new FormData()
        uploadForm.append("file", imageFile)
        uploadForm.append("upload_preset", "shoppieapp_products")
        uploadForm.append("folder", `vendors/${vendorId}`)

        const cloudinaryResponse = await fetch("https://api.cloudinary.com/v1_1/dibqpzu1j/image/upload", {
          method: "POST",
          body: uploadForm,
        })

        if (!cloudinaryResponse.ok) {
          toast({
            title: "Upload failed",
            description: "Failed to upload image. Please try again.",
            variant: "destructive",
          })
          setIsSubmitting(false)
          return
        }

        const cloudinaryData = await cloudinaryResponse.json()
        imageUrls.push(cloudinaryData.secure_url)
      }

      // Save WhatsApp number to vendor profile if not set yet
      if (!hasWhatsapp && whatsappNumber.trim()) {
        await supabase
          .from("vendors")
          .update({ whatsapp_number: whatsappNumber.trim() })
          .eq("id", vendorId)
      }

      const { data: newProduct, error: insertError } = await supabase
        .from("products")
        .insert({
          vendor_id: vendorId,
          name: formData.name,
          description: formData.description,
          price: Number.parseFloat(formData.price),
          category: formData.category || "Other",
          image_url: imageUrls[0] || null,
          image_urls: imageUrls,
          in_stock: formData.inStock,
        })
        .select("id")
        .single()

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

      // Fire new-product notification to all shoppers (fire-and-forget)
      fetch("/api/notifications/new-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: newProduct?.id ?? "",
          productName: formData.name,
          shopName,
          imageUrl: imageUrls[0] ?? null,
          category: formData.category || null,
        }),
      }).catch(() => {})

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
      <ImageCropperDialog
        open={cropperOpen}
        onOpenChange={setCropperOpen}
        imageSrc={currentImageSrc}
        onCropComplete={handleCropComplete}
        fileName={currentFileName}
      />
      <PexelsImagePickerDialog
        open={pexelsOpen}
        onOpenChange={setPexelsOpen}
        productName={formData.name}
        onSelectImage={handlePexelsSelect}
      />
      <CameraDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={handleCameraCapture}
      />

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
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Label htmlFor="price">Price (USD) *</Label>
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="image">Product Image{isVerified ? "s" : ""}</Label>
                  {isVerified && (
                    <div className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
                      <Shield className="h-3 w-3" />
                      <span>Up to 3 images</span>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  {imageFiles.length < maxImages && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById("image")?.click()}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Image
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCameraOpen(true)}
                          className="border-primary/40 text-primary hover:bg-primary/5 hover:text-primary"
                        >
                          <Camera className="mr-2 h-4 w-4" />
                          Take Photo
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setPexelsOpen(true)}
                          className="border-primary/40 text-primary hover:bg-primary/5 hover:text-primary"
                        >
                          <Images className="mr-2 h-4 w-4" />
                          Search Stock Photos
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          {imageFiles.length} / {maxImages} selected
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Upload an image, take a photo with your camera, or find a free stock photo from Pexels
                      </p>
                    </div>
                  )}
                  <Input id="image" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  {imagePreviews.length > 0 && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Wand2 className="h-3 w-3 text-violet-500" />
                      Tap the purple wand on any image to remove its background automatically
                    </p>
                  )}
                  {imagePreviews.length > 0 && (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      {imagePreviews.map((preview, index) => (
                        <div
                          key={index}
                          className="relative aspect-square overflow-hidden rounded-lg border border-border"
                        >
                          <Image
                            src={preview || "/placeholder.svg"}
                            alt={`Preview ${index + 1}`}
                            fill
                            className="object-cover"
                            unoptimized={preview.startsWith("blob:")}
                          />
                          {/* Remove image button */}
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute right-1 top-1 h-6 w-6"
                            onClick={() => removeImage(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          {/* Remove background button */}
                          <Button
                            type="button"
                            size="icon"
                            className="absolute left-1 top-1 h-6 w-6 bg-violet-600 hover:bg-violet-700 text-white border-0"
                            onClick={() => handleRemoveBg(index)}
                            disabled={removingBgIndex === index}
                            title="Remove background"
                          >
                            {removingBgIndex === index ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Wand2 className="h-3 w-3" />
                            )}
                          </Button>
                          {index === 0 && (
                            <div className="absolute bottom-1 left-1 rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                              Primary
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* WhatsApp number — only shown if not already set */}
              {!hasWhatsapp && (
                <div className="space-y-2 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <Label htmlFor="whatsapp" className="text-green-700 dark:text-green-400 font-medium">
                      Add WhatsApp Number
                    </Label>
                  </div>
                  <Input
                    id="whatsapp"
                    type="tel"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="+265991234567"
                    className="border-green-200 dark:border-green-900"
                  />
                  <p className="text-xs text-green-700 dark:text-green-400">
                    Include your country code. Buyers will use this to contact you directly. Once saved, it will apply to all your products automatically.
                  </p>
                </div>
              )}

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
