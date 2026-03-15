"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Search, Loader2, CheckCircle2, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react"

type PexelsPhoto = {
  id: number
  url: string
  thumb: string
  photographer: string
  alt: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  productName: string
  onSelectImage: (imageUrl: string, fileName: string) => void
}

export function PexelsImagePickerDialog({ open, onOpenChange, productName, onSelectImage }: Props) {
  const { toast } = useToast()
  const [query, setQuery] = useState("")
  const [photos, setPhotos] = useState<PexelsPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [totalResults, setTotalResults] = useState(0)
  const [uploading, setUploading] = useState(false)

  const PER_PAGE = 15
  const totalPages = Math.ceil(Math.min(totalResults, 100) / PER_PAGE)

  const search = useCallback(async (searchQuery: string, pageNum = 1) => {
    if (!searchQuery.trim()) return
    setLoading(true)
    setSelectedId(null)

    try {
      const res = await fetch(
        `/api/pexels?query=${encodeURIComponent(searchQuery)}&page=${pageNum}&per_page=${PER_PAGE}`,
      )
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to search images")
      }

      setPhotos(data.photos)
      setTotalResults(data.total_results)
      setPage(pageNum)
    } catch (err: any) {
      toast({
        title: "Search failed",
        description: err.message || "Could not load images from Pexels",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  // Auto-search when dialog opens with product name
  useEffect(() => {
    if (open && productName.trim()) {
      setQuery(productName)
      search(productName, 1)
    }
  }, [open, productName, search])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    search(query, 1)
  }

  const handleSelect = async () => {
    if (selectedId === null) return
    const photo = photos.find((p) => p.id === selectedId)
    if (!photo) return

    setUploading(true)

    try {
      // Fetch the image as a blob, then upload to Cloudinary
      const imgRes = await fetch(`/api/proxy-image?url=${encodeURIComponent(photo.url)}`)
      if (!imgRes.ok) throw new Error("Failed to fetch image")

      const blob = await imgRes.blob()
      const file = new File([blob], `pexels-${photo.id}.jpg`, { type: "image/jpeg" })

      const formData = new FormData()
      formData.append("file", file)
      formData.append("upload_preset", "shoppieapp_products")

      const cloudRes = await fetch("https://api.cloudinary.com/v1_1/dibqpzu1j/image/upload", {
        method: "POST",
        body: formData,
      })

      if (!cloudRes.ok) throw new Error("Failed to upload to Cloudinary")

      const cloudData = await cloudRes.json()
      onSelectImage(cloudData.secure_url, `pexels-${photo.id}.jpg`)
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message || "Could not upload the selected image",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle>Search Stock Photos</DialogTitle>
          <DialogDescription>
            Search Pexels for free high-quality product images. Photos by talented photographers.
          </DialogDescription>
        </DialogHeader>

        {/* Search bar */}
        <div className="shrink-0 border-b border-border px-6 py-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for images..."
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={loading || !query.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </form>
        </div>

        {/* Results grid */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Searching for images...</p>
              </div>
            </div>
          ) : photos.length === 0 ? (
            <div className="flex h-48 items-center justify-center">
              <div className="text-center">
                <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">No images yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Type a product name above and press Search
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs text-muted-foreground">
                {totalResults.toLocaleString()} photos found &mdash; click to select
              </p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {photos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setSelectedId(photo.id === selectedId ? null : photo.id)}
                    className={`group relative aspect-square overflow-hidden rounded-lg border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      selectedId === photo.id
                        ? "border-primary shadow-md"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Image
                      src={photo.thumb}
                      alt={photo.alt}
                      fill
                      className="object-cover transition-transform duration-200 group-hover:scale-105"
                      unoptimized
                    />
                    {selectedId === photo.id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                        <CheckCircle2 className="h-8 w-8 text-primary drop-shadow" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <p className="truncate text-[10px] text-white">{photo.photographer}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Pagination + footer */}
        {photos.length > 0 && (
          <div className="shrink-0 border-t border-border px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => search(query, page - 1)}
                  disabled={page <= 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages || 1}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => search(query, page + 1)}
                  disabled={page >= totalPages || loading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="https://www.pexels.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Photos by Pexels
                  <ExternalLink className="h-3 w-3" />
                </a>
                <Button
                  type="button"
                  onClick={handleSelect}
                  disabled={selectedId === null || uploading}
                  size="sm"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    "Use This Image"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
