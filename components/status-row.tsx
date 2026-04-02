"use client"

import { useState, useRef, useEffect } from "react"
import { Plus, X, Image as ImageIcon, Type, Video, ChevronLeft, ChevronRight } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { VerificationBadge } from "@/components/verification-badge"

interface VendorStatus {
  id: string
  vendor_id: string
  media_url: string
  media_type: "image" | "video" | "text"
  text_content: string | null
  caption: string | null
  created_at: string
  expires_at: string
  vendor: {
    id: string
    shop_name: string
    is_verified: boolean
    profile_picture_url?: string | null
  }
}

interface StatusRowProps {
  currentVendorId?: string | null
  currentVendorName?: string | null
  currentVendorIsVerified?: boolean
  currentVendorProfilePic?: string | null
}

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB

export default function StatusRow({
  currentVendorId,
  currentVendorName,
  currentVendorIsVerified,
  currentVendorProfilePic,
}: StatusRowProps) {
  const [statuses, setStatuses] = useState<VendorStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [viewingStatuses, setViewingStatuses] = useState<VendorStatus[]>([])
  const [viewIndex, setViewIndex] = useState(0)
  const [uploadType, setUploadType] = useState<"image" | "video" | "text" | null>(null)
  const [textContent, setTextContent] = useState("")
  const [caption, setCaption] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const progressRef = useRef<NodeJS.Timeout | null>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    fetchStatuses()
  }, [])

  async function fetchStatuses() {
    setLoading(true)
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from("shop_statuses")
      .select("*, vendor:vendors(id, shop_name, is_verified, profile_picture_url)")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
    if (!error && data) setStatuses(data as VendorStatus[])
    setLoading(false)
  }

  // Group statuses by vendor, keeping only each vendor's latest
  const groupedByVendor = statuses.reduce<Record<string, VendorStatus[]>>((acc, s) => {
    if (!acc[s.vendor_id]) acc[s.vendor_id] = []
    acc[s.vendor_id].push(s)
    return acc
  }, {})

  // Unique vendors that have statuses (excluding current vendor — shown first separately)
  const otherVendors = Object.values(groupedByVendor)
    .filter((group) => group[0].vendor_id !== currentVendorId)
    .sort((a, b) => {
      // Verified first
      const aV = a[0].vendor.is_verified ? 1 : 0
      const bV = b[0].vendor.is_verified ? 1 : 0
      return bV - aV
    })

  const myStatuses = currentVendorId ? (groupedByVendor[currentVendorId] ?? []) : []

  function openViewer(group: VendorStatus[]) {
    setViewingStatuses(group)
    setViewIndex(0)
    setViewOpen(true)
    startProgress()
  }

  function startProgress() {
    setProgress(0)
    if (progressRef.current) clearInterval(progressRef.current)
    progressRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(progressRef.current!)
          return 100
        }
        return p + 2
      })
    }, 100)
  }

  useEffect(() => {
    if (progress >= 100) {
      setViewIndex((i) => {
        if (i < viewingStatuses.length - 1) {
          startProgress()
          return i + 1
        }
        setViewOpen(false)
        return i
      })
    }
  }, [progress])

  useEffect(() => {
    return () => { if (progressRef.current) clearInterval(progressRef.current) }
  }, [])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      setError("File must be under 2 MB")
      return
    }
    setError(null)
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  async function handleSubmit() {
    if (!currentVendorId) return
    setUploading(true)
    setError(null)

    try {
      const supabase = createBrowserClient()
      let media_url = ""
      const media_type = uploadType!

      if (media_type === "text") {
        if (!textContent.trim()) { setError("Text cannot be empty"); setUploading(false); return }
        media_url = ""
      } else {
        if (!selectedFile) { setError("Please select a file"); setUploading(false); return }
        const ext = selectedFile.name.split(".").pop()
        const path = `statuses/${currentVendorId}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from("product-images")
          .upload(path, selectedFile, { upsert: true })
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path)
        media_url = urlData.publicUrl
      }

      const { error: insertErr } = await supabase.from("shop_statuses").insert({
        vendor_id: currentVendorId,
        media_url,
        media_type,
        text_content: media_type === "text" ? textContent.trim() : null,
        caption: caption.trim() || null,
      })
      if (insertErr) throw insertErr

      setCreateOpen(false)
      setUploadType(null)
      setTextContent("")
      setCaption("")
      setSelectedFile(null)
      setPreviewUrl(null)
      await fetchStatuses()
    } catch (e: any) {
      setError(e.message ?? "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const current = viewingStatuses[viewIndex]

  return (
    <>
      {/* Horizontal scrollable row */}
      <div className="mb-4 -mx-4 px-4">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">

          {/* My Store avatar */}
          {currentVendorId && (
            <button
              onClick={() => myStatuses.length > 0 ? openViewer(myStatuses) : setCreateOpen(true)}
              className="flex flex-col items-center gap-1 shrink-0"
            >
              <div className="relative">
                <div className={`h-14 w-14 rounded-full border-2 overflow-hidden flex items-center justify-center
                  ${myStatuses.length > 0
                    ? "border-primary"
                    : "border-dashed border-muted-foreground"}`}
                >
                  {currentVendorProfilePic ? (
                    <img src={currentVendorProfilePic} alt="My Store" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-primary">
                      {currentVendorName?.[0]?.toUpperCase() ?? "S"}
                    </span>
                  )}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white border-2 border-background">
                  <Plus className="h-3 w-3" />
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground w-14 truncate text-center">My Store</span>
            </button>
          )}

          {/* Other vendors with active statuses */}
          {!loading && otherVendors.map((group) => {
            const vendor = group[0].vendor
            const hasUnwatched = true // Future: track watched state
            return (
              <button
                key={vendor.id}
                onClick={() => openViewer(group)}
                className="flex flex-col items-center gap-1 shrink-0"
              >
                <div className="relative">
                  <div className={`h-14 w-14 rounded-full border-2 overflow-hidden flex items-center justify-center bg-muted
                    ${vendor.is_verified
                      ? "border-blue-500 ring-2 ring-blue-500/30"
                      : "border-primary"}`}
                  >
                    {vendor.profile_picture_url ? (
                      <img src={vendor.profile_picture_url} alt={vendor.shop_name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold text-foreground">
                        {vendor.shop_name?.[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  {vendor.is_verified && (
                    <span className="absolute -bottom-0.5 -right-0.5">
                      <VerificationBadge isVerified size="xs" showTooltip={false} />
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground w-14 truncate text-center">
                  {vendor.shop_name}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Status Viewer Dialog */}
      <Dialog open={viewOpen} onOpenChange={(o) => { setViewOpen(o); if (!o && progressRef.current) clearInterval(progressRef.current) }}>
        <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl bg-black border-0">
          {current && (
            <div className="relative flex flex-col h-[70vh]">
              {/* Progress bars */}
              <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2">
                {viewingStatuses.map((_, i) => (
                  <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-none"
                      style={{ width: i < viewIndex ? "100%" : i === viewIndex ? `${progress}%` : "0%" }}
                    />
                  </div>
                ))}
              </div>

              {/* Vendor info */}
              <div className="absolute top-6 left-0 right-0 z-20 flex items-center gap-2 px-3 py-2">
                <div className="h-8 w-8 rounded-full overflow-hidden bg-white/20 flex items-center justify-center">
                  {current.vendor.profile_picture_url ? (
                    <img src={current.vendor.profile_picture_url} className="h-full w-full object-cover" alt="" />
                  ) : (
                    <span className="text-sm font-bold text-white">{current.vendor.shop_name[0]}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-white">{current.vendor.shop_name}</span>
                  {current.vendor.is_verified && <VerificationBadge isVerified size="xs" showTooltip={false} />}
                </div>
                <button onClick={() => setViewOpen(false)} className="ml-auto text-white/80 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 flex items-center justify-center">
                {current.media_type === "image" && (
                  <img src={current.media_url} alt={current.caption ?? ""} className="w-full h-full object-cover" />
                )}
                {current.media_type === "video" && (
                  <video src={current.media_url} autoPlay muted loop className="w-full h-full object-cover" />
                )}
                {current.media_type === "text" && (
                  <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-primary/80 to-primary p-6">
                    <p className="text-center text-xl font-semibold text-white">{current.text_content}</p>
                  </div>
                )}
              </div>

              {/* Caption */}
              {current.caption && (
                <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/70 px-4 py-3">
                  <p className="text-sm text-white">{current.caption}</p>
                </div>
              )}

              {/* Tap zones */}
              <button
                className="absolute left-0 top-0 h-full w-1/3 z-10"
                onClick={() => { if (viewIndex > 0) { setViewIndex(v => v - 1); startProgress() } }}
              />
              <button
                className="absolute right-0 top-0 h-full w-1/3 z-10"
                onClick={() => {
                  if (viewIndex < viewingStatuses.length - 1) { setViewIndex(v => v + 1); startProgress() }
                  else setViewOpen(false)
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Status Dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) { setUploadType(null); setError(null); setPreviewUrl(null); setSelectedFile(null) } }}>
        <DialogContent className="max-w-sm">
          <div className="space-y-4">
            <h2 className="text-base font-semibold">Add Status</h2>

            {!uploadType ? (
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => { setUploadType("image"); fileInputRef.current?.click() }}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 hover:bg-muted transition-colors"
                >
                  <ImageIcon className="h-6 w-6 text-primary" />
                  <span className="text-xs">Photo</span>
                </button>
                <button
                  onClick={() => { setUploadType("video"); fileInputRef.current?.click() }}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 hover:bg-muted transition-colors"
                >
                  <Video className="h-6 w-6 text-primary" />
                  <span className="text-xs">Video</span>
                </button>
                <button
                  onClick={() => setUploadType("text")}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 hover:bg-muted transition-colors"
                >
                  <Type className="h-6 w-6 text-primary" />
                  <span className="text-xs">Text</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {uploadType === "text" ? (
                  <Textarea
                    placeholder="Write your status..."
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    rows={4}
                    maxLength={280}
                  />
                ) : previewUrl ? (
                  <div className="relative rounded-xl overflow-hidden aspect-square bg-muted">
                    {uploadType === "image"
                      ? <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                      : <video src={previewUrl} controls className="w-full h-full object-cover" />
                    }
                    <button
                      onClick={() => { setSelectedFile(null); setPreviewUrl(null) }}
                      className="absolute top-2 right-2 bg-black/50 rounded-full p-1 text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border h-32 cursor-pointer hover:bg-muted transition-colors"
                  >
                    {uploadType === "image" ? <ImageIcon className="h-8 w-8 text-muted-foreground" /> : <Video className="h-8 w-8 text-muted-foreground" />}
                    <span className="text-xs text-muted-foreground">Tap to select (max 2 MB)</span>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={uploadType === "image" ? "image/*" : "video/*"}
                  className="hidden"
                  onChange={handleFileSelect}
                />

                <input
                  type="text"
                  placeholder="Add a caption (optional)"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  maxLength={120}
                />

                {error && <p className="text-xs text-destructive">{error}</p>}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setUploadType(null)}>
                    Back
                  </Button>
                  <Button className="flex-1" onClick={handleSubmit} disabled={uploading}>
                    {uploading ? "Posting..." : "Post Status"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
