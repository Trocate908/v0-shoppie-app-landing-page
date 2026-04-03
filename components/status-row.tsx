"use client"

import { useState, useRef, useEffect } from "react"
import { Plus, X, Image as ImageIcon, Type, Video, Upload, CheckCircle, AlertCircle } from "lucide-react"
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

type UploadState = "uploading" | "done" | "error"

interface BackgroundUpload {
  state: UploadState
  progress: number
  label: string
  error?: string
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
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const progressRef = useRef<NodeJS.Timeout | null>(null)
  const [storyProgress, setStoryProgress] = useState(0)

  // Background upload indicator
  const [bgUpload, setBgUpload] = useState<BackgroundUpload | null>(null)
  const bgUploadTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetch("/api/cleanup-statuses", { method: "POST" }).finally(() => {
      fetchStatuses()
    })
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

  function scheduleDismiss(delay = 4000) {
    if (bgUploadTimerRef.current) clearTimeout(bgUploadTimerRef.current)
    bgUploadTimerRef.current = setTimeout(() => setBgUpload(null), delay)
  }

  function resetCreateForm() {
    setUploadType(null)
    setTextContent("")
    setCaption("")
    setSelectedFile(null)
    setPreviewUrl(null)
    setError(null)
  }

  // Close dialog immediately, upload runs in the background
  async function handleSubmit() {
    if (!currentVendorId) return

    const mediaType = uploadType!
    const file = selectedFile
    const text = textContent.trim()
    const cap = caption.trim()

    if (mediaType === "text" && !text) { setError("Text cannot be empty"); return }
    if (mediaType !== "text" && !file) { setError("Please select a file"); return }

    setCreateOpen(false)
    resetCreateForm()

    const label = mediaType === "text" ? "Text status" : mediaType === "image" ? "Photo status" : "Video status"
    setBgUpload({ state: "uploading", progress: 0, label })

    let fakeProgress = 0
    const fakeTimer = setInterval(() => {
      fakeProgress = Math.min(fakeProgress + Math.random() * 8, 85)
      setBgUpload((prev) => prev ? { ...prev, progress: Math.round(fakeProgress) } : null)
    }, 300)

    try {
      const supabase = createBrowserClient()
      let media_url = ""

      if (mediaType !== "text" && file) {
        const ext = file.name.split(".").pop()
        const path = `statuses/${currentVendorId}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from("product-images")
          .upload(path, file, { upsert: true })
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path)
        media_url = urlData.publicUrl
      }

      const { error: insertErr } = await supabase.from("shop_statuses").insert({
        vendor_id: currentVendorId,
        media_url,
        media_type: mediaType,
        text_content: mediaType === "text" ? text : null,
        caption: cap || null,
      })
      if (insertErr) throw insertErr

      clearInterval(fakeTimer)
      setBgUpload({ state: "done", progress: 100, label })
      scheduleDismiss(3000)
      fetchStatuses()
    } catch (e: any) {
      clearInterval(fakeTimer)
      setBgUpload({ state: "error", progress: 0, label, error: e.message ?? "Upload failed" })
      scheduleDismiss(5000)
    }
  }

  // Group statuses by vendor
  const groupedByVendor = statuses.reduce<Record<string, VendorStatus[]>>((acc, s) => {
    if (!acc[s.vendor_id]) acc[s.vendor_id] = []
    acc[s.vendor_id].push(s)
    return acc
  }, {})

  const otherVendors = Object.values(groupedByVendor)
    .filter((group) => group[0].vendor_id !== currentVendorId)
    .sort((a, b) => (b[0].vendor.is_verified ? 1 : 0) - (a[0].vendor.is_verified ? 1 : 0))

  const myStatuses = currentVendorId ? (groupedByVendor[currentVendorId] ?? []) : []

  function openViewer(group: VendorStatus[]) {
    setViewingStatuses(group)
    setViewIndex(0)
    setViewOpen(true)
    startProgress()
  }

  function startProgress() {
    setStoryProgress(0)
    if (progressRef.current) clearInterval(progressRef.current)
    progressRef.current = setInterval(() => {
      setStoryProgress((p) => {
        if (p >= 100) { clearInterval(progressRef.current!); return 100 }
        return p + 2
      })
    }, 100)
  }

  useEffect(() => {
    if (storyProgress >= 100) {
      setViewIndex((i) => {
        if (i < viewingStatuses.length - 1) { startProgress(); return i + 1 }
        setViewOpen(false)
        return i
      })
    }
  }, [storyProgress])

  useEffect(() => {
    return () => {
      if (progressRef.current) clearInterval(progressRef.current)
      if (bgUploadTimerRef.current) clearTimeout(bgUploadTimerRef.current)
    }
  }, [])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE) { setError("File must be under 2 MB"); return }
    setError(null)
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
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
                  ${myStatuses.length > 0 ? "border-primary" : "border-dashed border-muted-foreground"}`}
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
            return (
              <button
                key={vendor.id}
                onClick={() => openViewer(group)}
                className="flex flex-col items-center gap-1 shrink-0"
              >
                <div className="relative">
                  <div className={`h-14 w-14 rounded-full border-2 overflow-hidden flex items-center justify-center bg-muted
                    ${vendor.is_verified ? "border-blue-500 ring-2 ring-blue-500/30" : "border-primary"}`}
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

      {/* Floating background upload indicator */}
      {bgUpload && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full bg-foreground text-background px-4 py-2.5 shadow-xl text-sm font-medium min-w-[220px] max-w-xs">
          {bgUpload.state === "uploading" && (
            <>
              <Upload className="h-4 w-4 shrink-0 animate-pulse" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between mb-1">
                  <span className="truncate">{bgUpload.label}</span>
                  <span className="ml-2 text-xs opacity-70">{bgUpload.progress}%</span>
                </div>
                <div className="h-1 rounded-full bg-background/20 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-background transition-all duration-300"
                    style={{ width: `${bgUpload.progress}%` }}
                  />
                </div>
              </div>
            </>
          )}
          {bgUpload.state === "done" && (
            <>
              <CheckCircle className="h-4 w-4 shrink-0 text-green-400" />
              <span className="flex-1">{bgUpload.label} posted!</span>
              <button onClick={() => setBgUpload(null)} className="opacity-60 hover:opacity-100">
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {bgUpload.state === "error" && (
            <>
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span className="flex-1 truncate">{bgUpload.error ?? "Upload failed"}</span>
              <button onClick={() => setBgUpload(null)} className="opacity-60 hover:opacity-100">
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      )}

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
                      style={{ width: i < viewIndex ? "100%" : i === viewIndex ? `${storyProgress}%` : "0%" }}
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
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetCreateForm() }}>
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
                    {uploadType === "image"
                      ? <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      : <Video className="h-8 w-8 text-muted-foreground" />
                    }
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
                  <Button className="flex-1" onClick={handleSubmit}>
                    Post Status
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
