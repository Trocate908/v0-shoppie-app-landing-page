"use client"

import { useState, useRef, useEffect } from "react"
import { Plus, X, Image as ImageIcon, Type, Video, Upload, CheckCircle, AlertCircle, Eye, PlusCircle, Trash2, Pencil, Volume2, VolumeX } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { VerificationBadge } from "@/components/verification-badge"
import { VideoTrimmer } from "@/components/video-trimmer"

interface VendorStatus {
  id: string
  vendor_id: string
  media_url: string
  media_type: "image" | "video" | "text"
  text_content: string | null
  caption: string | null
  created_at: string
  expires_at: string
  view_count: number
  video_duration_seconds?: number | null
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

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB (trimmer handles final size)
const MAX_VIDEO_DURATION = 15 // seconds

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
  const [myActionOpen, setMyActionOpen] = useState(false)
  const [viewingStatuses, setViewingStatuses] = useState<VendorStatus[]>([])
  const [viewIndex, setViewIndex] = useState(0)
  const [uploadType, setUploadType] = useState<"image" | "video" | "text" | null>(null)
  const [textContent, setTextContent] = useState("")
  const [caption, setCaption] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showTrimmer, setShowTrimmer] = useState(false)
  const [trimmedFile, setTrimmedFile] = useState<File | null>(null)
  const [trimmedUrl, setTrimmedUrl] = useState<string | null>(null)
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const progressRef = useRef<NodeJS.Timeout | null>(null)
  const videoViewerRef = useRef<HTMLVideoElement>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [storyProgress, setStoryProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const isPausedRef = useRef(false)
  const [mediaLoaded, setMediaLoaded] = useState(false)

  // Edit caption state
  const [editCaptionOpen, setEditCaptionOpen] = useState(false)
  const [editCaptionValue, setEditCaptionValue] = useState("")
  const [editTextValue, setEditTextValue] = useState("")
  const [editSaving, setEditSaving] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
    setTrimmedFile(null)
    setTrimmedUrl(null)
    setShowTrimmer(false)
    setVideoDurationSeconds(null)
    setError(null)
  }

  // Close dialog immediately, upload runs in the background
  async function handleSubmit() {
    if (!currentVendorId) return

    const mediaType = uploadType!
    // Use trimmed file for video if available, else selected file
    const file = mediaType === "video" ? (trimmedFile ?? selectedFile) : selectedFile
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
        const path = `${currentVendorId}/statuses/${Date.now()}.${ext}`
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
        ...(mediaType === "video" && videoDurationSeconds !== null
          ? { video_duration_seconds: videoDurationSeconds }
          : {}),
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
    startProgressForStatus(group[0])
    // Increment view count for first status if it belongs to another vendor
    if (group[0].vendor_id !== currentVendorId) {
      incrementViewCount(group[0].id)
    }
  }

  async function incrementViewCount(statusId: string) {
    const supabase = createBrowserClient()
    await supabase.rpc("increment_status_view_count", { status_id: statusId })
  }

  async function handleDeleteStatus() {
    if (!current) return
    setDeleting(true)
    const supabase = createBrowserClient()
    await supabase.from("shop_statuses").delete().eq("id", current.id)
    setDeleting(false)
    setDeleteConfirmOpen(false)
    // Remove deleted status from viewer
    const updated = viewingStatuses.filter((s) => s.id !== current.id)
    if (updated.length === 0) {
      setViewOpen(false)
    } else {
      setViewingStatuses(updated)
      setViewIndex((i) => Math.min(i, updated.length - 1))
    }
    fetchStatuses()
  }

  async function handleEditCaption() {
    if (!current) return
    setEditSaving(true)
    const supabase = createBrowserClient()
    const updates: Record<string, string | null> = {
      caption: editCaptionValue.trim() || null,
    }
    if (current.media_type === "text") {
      updates.text_content = editTextValue.trim() || null
    }
    const { error } = await supabase
      .from("shop_statuses")
      .update(updates)
      .eq("id", current.id)
    setEditSaving(false)
    if (!error) {
      setEditCaptionOpen(false)
      // Update local state immediately
      setViewingStatuses((prev) =>
        prev.map((s) =>
          s.id === current.id
            ? { ...s, caption: updates.caption ?? null, text_content: updates.text_content !== undefined ? (updates.text_content ?? null) : s.text_content }
            : s
        )
      )
      fetchStatuses()
    }
  }

  function startProgress(durationMs: number = 5000) {
    setStoryProgress(0)
    setMediaLoaded(false)
    if (progressRef.current) clearInterval(progressRef.current)
    const step = (100 / durationMs) * 100 // percent per 100ms tick
    progressRef.current = setInterval(() => {
      if (isPausedRef.current) return
      setStoryProgress((p) => {
        if (p >= 100) { clearInterval(progressRef.current!); return 100 }
        return Math.min(p + step, 100)
      })
    }, 100)
  }

  function startProgressForStatus(status: VendorStatus) {
    // Use actual video duration if known, else 5s for image/text
    const dur =
      status.media_type === "video"
        ? (status.video_duration_seconds ?? MAX_VIDEO_DURATION) * 1000
        : 5000
    startProgress(dur)
  }

  function pauseProgress() {
    isPausedRef.current = true
    setIsPaused(true)
    videoViewerRef.current?.pause()
  }

  function resumeProgress() {
    isPausedRef.current = false
    setIsPaused(false)
    if (videoViewerRef.current && mediaLoaded) {
      videoViewerRef.current.play().catch(() => {})
    }
  }

  useEffect(() => {
    if (storyProgress >= 100) {
      setViewIndex((i) => {
        if (i < viewingStatuses.length - 1) {
          const nextIndex = i + 1
          if (viewingStatuses[nextIndex]?.vendor_id !== currentVendorId) {
            incrementViewCount(viewingStatuses[nextIndex].id)
          }
          startProgressForStatus(viewingStatuses[nextIndex])
          return nextIndex
        }
        setViewOpen(false)
        return i
      })
    }
  }, [storyProgress])

  useEffect(() => {
    setMediaLoaded(false)
  }, [viewIndex, current?.id])

  useEffect(() => {
    return () => {
      if (progressRef.current) clearInterval(progressRef.current)
      if (bgUploadTimerRef.current) clearTimeout(bgUploadTimerRef.current)
    }
  }, [])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE) { setError("File must be under 50 MB"); return }
    setError(null)
    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    // For videos, always open the trimmer
    if (uploadType === "video") {
      setTrimmedFile(null)
      setTrimmedUrl(null)
      setShowTrimmer(true)
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
              onClick={() => myStatuses.length > 0 ? setMyActionOpen(true) : setCreateOpen(true)}
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
            <div
              className="relative flex flex-col h-[78vh] select-none"
              onPointerDown={() => pauseProgress()}
              onPointerUp={() => resumeProgress()}
              onPointerLeave={() => resumeProgress()}
            >
              {/* Progress bars */}
              <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2">
                {viewingStatuses.map((_, i) => (
                  <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-white rounded-full ${isPaused && i === viewIndex ? "" : "transition-none"}`}
                      style={{ width: i < viewIndex ? "100%" : i === viewIndex ? `${storyProgress}%` : "0%" }}
                    />
                  </div>
                ))}
              </div>

              {/* Vendor info */}
              <div className="absolute top-6 left-0 right-0 z-20 flex items-center gap-2 px-3 py-2">
                <div className="h-8 w-8 rounded-full overflow-hidden bg-white/20 flex items-center justify-center shrink-0">
                  {current.vendor.profile_picture_url ? (
                    <img src={current.vendor.profile_picture_url} className="h-full w-full object-cover" alt="" />
                  ) : (
                    <span className="text-sm font-bold text-white">{current.vendor.shop_name[0]}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-sm font-medium text-white truncate">{current.vendor.shop_name}</span>
                  {current.vendor.is_verified && <VerificationBadge isVerified size="xs" showTooltip={false} />}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {/* Mute/unmute — only for video statuses */}
                  {current.media_type === "video" && (
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); setIsMuted((m) => !m) }}
                      className="p-1.5 rounded-full bg-black/40 text-white/90 hover:text-white hover:bg-black/60 transition-colors"
                      aria-label={isMuted ? "Unmute" : "Mute"}
                    >
                      {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  {/* View count — only shown to status owner */}
                  {current.vendor_id === currentVendorId && (
                    <div className="flex items-center gap-1 bg-black/40 rounded-full px-2 py-0.5">
                      <Eye className="h-3.5 w-3.5 text-white" />
                      <span className="text-xs text-white font-medium">{current.view_count ?? 0}</span>
                    </div>
                  )}
                  {/* Edit button — owner only */}
                  {current.vendor_id === currentVendorId && (
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (progressRef.current) clearInterval(progressRef.current)
                        setEditCaptionValue(current.caption ?? "")
                        setEditTextValue(current.text_content ?? "")
                        setEditCaptionOpen(true)
                      }}
                      className="p-1.5 rounded-full bg-black/40 text-white/90 hover:text-white hover:bg-black/60 transition-colors"
                      aria-label="Edit status"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {/* Delete button — owner only */}
                  {current.vendor_id === currentVendorId && (
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (progressRef.current) clearInterval(progressRef.current)
                        setDeleteConfirmOpen(true)
                      }}
                      className="p-1.5 rounded-full bg-black/40 text-white/90 hover:text-red-400 hover:bg-black/60 transition-colors"
                      aria-label="Delete status"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setViewOpen(false)}
                    className="p-1.5 text-white/80 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Media content */}
              <div className="flex-1 flex items-center justify-center overflow-hidden bg-black relative">

                {/* Circle loading spinner — shown while media loads */}
                {!mediaLoaded && current.media_type !== "text" && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
                    <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
                      {/* Track */}
                      <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                      {/* Spinner arc */}
                      <circle
                        cx="28" cy="28" r="22"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray="138.2"
                        strokeDashoffset="103.7"
                        className="origin-center animate-spin"
                        style={{ animationDuration: "900ms" }}
                      />
                    </svg>
                  </div>
                )}

                {current.media_type === "image" && (
                  <img
                    key={current.id}
                    src={current.media_url}
                    alt={current.caption ?? ""}
                    className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${mediaLoaded ? "opacity-100" : "opacity-0"}`}
                    onLoad={() => setMediaLoaded(true)}
                    draggable={false}
                  />
                )}
                {current.media_type === "video" && (
                  <video
                    key={current.id}
                    ref={videoViewerRef}
                    src={current.media_url}
                    autoPlay
                    muted={isMuted}
                    playsInline
                    className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${mediaLoaded ? "opacity-100" : "opacity-0"}`}
                    onCanPlay={() => setMediaLoaded(true)}
                    draggable={false}
                  />
                )}
                {current.media_type === "text" && (
                  <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-primary/80 to-primary p-8">
                    <p className="text-center text-xl font-semibold text-white leading-relaxed">{current.text_content}</p>
                  </div>
                )}

                {/* Hold-to-pause overlay hint */}
                {isPaused && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <div className="bg-black/40 rounded-full px-4 py-2">
                      <span className="text-white text-xs font-medium tracking-wide">Hold to pause</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Caption */}
              {current.caption && (
                <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-5 pt-8">
                  <p className="text-sm text-white leading-snug">{current.caption}</p>
                </div>
              )}

              {/* Tap zones */}
              <button
                className="absolute left-0 top-0 h-full w-1/3 z-10"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  if (viewIndex > 0) {
                    setViewIndex(v => v - 1)
                    startProgressForStatus(viewingStatuses[viewIndex - 1])
                  }
                }}
              />
              <button
                className="absolute right-0 top-0 h-full w-1/3 z-10"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  if (viewIndex < viewingStatuses.length - 1) {
                    const next = viewIndex + 1
                    if (viewingStatuses[next]?.vendor_id !== currentVendorId) {
                      incrementViewCount(viewingStatuses[next].id)
                    }
                    setViewIndex(next)
                    startProgressForStatus(viewingStatuses[next])
                  } else {
                    setViewOpen(false)
                  }
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* My Store Action Sheet */}
      <Dialog open={myActionOpen} onOpenChange={setMyActionOpen}>
        <DialogContent className="max-w-xs p-0 overflow-hidden rounded-2xl">
          <div className="p-5 space-y-1">
            <h3 className="text-sm font-semibold text-center mb-4">Shop Updates</h3>
            <button
              onClick={() => { setMyActionOpen(false); openViewer(myStatuses) }}
              className="flex items-center gap-3 w-full rounded-xl px-4 py-3 hover:bg-muted transition-colors text-left"
            >
              <Eye className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">View my status</p>
                <p className="text-xs text-muted-foreground">{myStatuses.length} update{myStatuses.length !== 1 ? "s" : ""} active</p>
              </div>
            </button>
            <button
              onClick={() => { setMyActionOpen(false); setCreateOpen(true) }}
              className="flex items-center gap-3 w-full rounded-xl px-4 py-3 hover:bg-muted transition-colors text-left"
            >
              <PlusCircle className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Add a status</p>
                <p className="text-xs text-muted-foreground">Photo, video, or text — visible for 24 hrs</p>
              </div>
            </button>
            <button
              onClick={() => setMyActionOpen(false)}
              className="w-full text-center text-sm text-muted-foreground py-2 mt-1 hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Caption / Text Dialog */}
      <Dialog open={editCaptionOpen} onOpenChange={(o) => { setEditCaptionOpen(o); if (!o && viewOpen) startProgress() }}>
        <DialogContent className="max-w-xs">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Edit Status</h3>
            {viewingStatuses[viewIndex]?.media_type === "text" && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Text content</label>
                <Textarea
                  value={editTextValue}
                  onChange={(e) => setEditTextValue(e.target.value)}
                  rows={3}
                  maxLength={280}
                  placeholder="Status text..."
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Caption</label>
              <input
                type="text"
                value={editCaptionValue}
                onChange={(e) => setEditCaptionValue(e.target.value)}
                maxLength={120}
                placeholder="Add a caption..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditCaptionOpen(false)} disabled={editSaving}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleEditCaption} disabled={editSaving}>
                {editSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={(o) => { setDeleteConfirmOpen(o); if (!o && viewOpen) startProgress() }}>
        <DialogContent className="max-w-xs">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Delete Status</h3>
            <p className="text-sm text-muted-foreground">This status will be permanently deleted and cannot be recovered.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleDeleteStatus} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
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
            ) : showTrimmer && selectedFile && previewUrl ? (
              /* Video Trimmer step */
              <VideoTrimmer
                file={selectedFile}
                previewUrl={previewUrl}
                onConfirm={(tf, tu, _start, end) => {
                  setTrimmedFile(tf)
                  setTrimmedUrl(tu)
                  setVideoDurationSeconds(Math.round(end - _start))
                  setShowTrimmer(false)
                }}
                onCancel={() => {
                  setSelectedFile(null)
                  setPreviewUrl(null)
                  setTrimmedFile(null)
                  setTrimmedUrl(null)
                  setShowTrimmer(false)
                }}
              />
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
                ) : (trimmedUrl ?? previewUrl) ? (
                  <div className="relative rounded-xl overflow-hidden aspect-video bg-muted">
                    {uploadType === "image"
                      ? <img src={trimmedUrl ?? previewUrl!} alt="Preview" className="w-full h-full object-contain" />
                      : (
                        <video
                          src={trimmedUrl ?? previewUrl!}
                          controls
                          className="w-full h-full object-contain"
                        />
                      )
                    }
                    <button
                      onClick={() => {
                        setSelectedFile(null)
                        setPreviewUrl(null)
                        setTrimmedFile(null)
                        setTrimmedUrl(null)
                        setShowTrimmer(false)
                        setVideoDurationSeconds(null)
                      }}
                      className="absolute top-2 right-2 bg-black/50 rounded-full p-1 text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    {uploadType === "video" && videoDurationSeconds !== null && (
                      <div className="absolute bottom-2 left-2 bg-black/60 rounded-full px-2 py-0.5 text-[10px] text-white font-medium">
                        {videoDurationSeconds}s
                      </div>
                    )}
                    {uploadType === "video" && (
                      <button
                        onClick={() => setShowTrimmer(true)}
                        className="absolute bottom-2 right-2 bg-black/60 rounded-full px-2 py-1 text-[10px] text-white flex items-center gap-1"
                      >
                        <Video className="h-3 w-3" /> Re-trim
                      </button>
                    )}
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
                    <span className="text-xs text-muted-foreground">
                      {uploadType === "video" ? "Tap to select (max 15s, 50 MB)" : "Tap to select (max 50 MB)"}
                    </span>
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
