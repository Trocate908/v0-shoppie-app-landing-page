"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Scissors, Play, Pause, Check, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

const MAX_DURATION = 15 // seconds

interface VideoTrimmerProps {
  file: File
  previewUrl: string
  onConfirm: (trimmedFile: File, trimmedUrl: string, startTime: number, endTime: number) => void
  onCancel: () => void
}

export function VideoTrimmer({ file, previewUrl, onConfirm, onCancel }: VideoTrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const [duration, setDuration] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [trimming, setTrimming] = useState(false)
  const [dragging, setDragging] = useState<"start" | "end" | null>(null)
  const animFrameRef = useRef<number | null>(null)

  // Load video metadata
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onLoaded = () => {
      const dur = video.duration
      setDuration(dur)
      setStartTime(0)
      setEndTime(Math.min(dur, MAX_DURATION))
    }
    video.addEventListener("loadedmetadata", onLoaded)
    return () => video.removeEventListener("loadedmetadata", onLoaded)
  }, [previewUrl])

  // Sync current time display
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onTime = () => setCurrentTime(video.currentTime)
    video.addEventListener("timeupdate", onTime)
    return () => video.removeEventListener("timeupdate", onTime)
  }, [])

  // Loop within trim range
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onTime = () => {
      if (video.currentTime >= endTime) {
        video.currentTime = startTime
        if (!isPlaying) video.pause()
      }
    }
    video.addEventListener("timeupdate", onTime)
    return () => video.removeEventListener("timeupdate", onTime)
  }, [startTime, endTime, isPlaying])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      if (video.currentTime >= endTime || video.currentTime < startTime) {
        video.currentTime = startTime
      }
      video.play()
      setIsPlaying(true)
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }

  const getPositionFromEvent = useCallback((e: MouseEvent | TouchEvent): number => {
    const timeline = timelineRef.current
    if (!timeline || duration === 0) return 0
    const rect = timeline.getBoundingClientRect()
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return ratio * duration
  }, [duration])

  const handlePointerDown = (e: React.PointerEvent, handle: "start" | "end") => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(handle)
    const video = videoRef.current
    if (video && !video.paused) { video.pause(); setIsPlaying(false) }
  }

  useEffect(() => {
    if (!dragging) return

    const onMove = (e: MouseEvent | TouchEvent) => {
      const time = getPositionFromEvent(e)
      if (dragging === "start") {
        const newStart = Math.max(0, Math.min(time, endTime - 0.5))
        setStartTime(newStart)
        if (videoRef.current) videoRef.current.currentTime = newStart
        // Enforce max duration
        if (endTime - newStart > MAX_DURATION) {
          setEndTime(newStart + MAX_DURATION)
        }
      } else {
        const newEnd = Math.min(duration, Math.max(time, startTime + 0.5))
        const capped = Math.min(newEnd, startTime + MAX_DURATION)
        setEndTime(capped)
        if (videoRef.current) videoRef.current.currentTime = capped
      }
    }

    const onUp = () => setDragging(null)

    window.addEventListener("mousemove", onMove)
    window.addEventListener("touchmove", onMove, { passive: true })
    window.addEventListener("mouseup", onUp)
    window.addEventListener("touchend", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("touchmove", onMove)
      window.removeEventListener("mouseup", onUp)
      window.removeEventListener("touchend", onUp)
    }
  }, [dragging, startTime, endTime, duration, getPositionFromEvent])

  // Client-side trim using MediaRecorder — no FFmpeg needed
  async function handleConfirmTrim() {
    const video = videoRef.current
    if (!video) return
    setTrimming(true)

    try {
      // If video needs no trimming, use original
      if (startTime <= 0.05 && endTime >= duration - 0.05) {
        onConfirm(file, previewUrl, 0, duration)
        return
      }

      // Use canvas + MediaRecorder to capture trimmed segment
      const canvas = document.createElement("canvas")
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 640
      const ctx = canvas.getContext("2d")!

      const stream = canvas.captureStream(30)

      // Add audio if possible
      let mediaStream = stream
      try {
        const audioCtx = new AudioContext()
        const src = audioCtx.createMediaElementSource(video)
        const dest = audioCtx.createMediaStreamDestination()
        src.connect(dest)
        src.connect(audioCtx.destination)
        const audioTrack = dest.stream.getAudioTracks()[0]
        if (audioTrack) mediaStream.addTrack(audioTrack)
      } catch {
        // audio capture not supported, continue without
      }

      const chunks: Blob[] = []
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/mp4"

      const recorder = new MediaRecorder(mediaStream, { mimeType })
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve()

        video.currentTime = startTime
        video.muted = false

        const drawFrame = () => {
          if (video.currentTime >= endTime) {
            recorder.stop()
            video.pause()
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
            return
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          animFrameRef.current = requestAnimationFrame(drawFrame)
        }

        recorder.start(100)
        video.play().then(() => {
          drawFrame()
        })

        // Safety timeout
        setTimeout(() => {
          if (recorder.state === "recording") recorder.stop()
        }, (endTime - startTime + 1) * 1000 + 2000)
      })

      const blob = new Blob(chunks, { type: mimeType })
      const ext = mimeType.includes("webm") ? "webm" : "mp4"
      const trimmedFile = new File([blob], `trimmed-${Date.now()}.${ext}`, { type: mimeType })
      const trimmedUrl = URL.createObjectURL(blob)

      onConfirm(trimmedFile, trimmedUrl, startTime, endTime)
    } catch (err) {
      console.error("Trim failed, using original", err)
      onConfirm(file, previewUrl, startTime, endTime)
    } finally {
      setTrimming(false)
    }
  }

  const trimDuration = endTime - startTime
  const startPct = duration > 0 ? (startTime / duration) * 100 : 0
  const endPct = duration > 0 ? (endTime / duration) * 100 : 100
  const currentPct = duration > 0 ? (currentTime / duration) * 100 : 0
  const needsTrim = duration > MAX_DURATION

  function formatTime(t: number) {
    const s = Math.floor(t % 60)
    const m = Math.floor(t / 60)
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Scissors className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Trim Video</h3>
        <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
          trimDuration > MAX_DURATION ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
        }`}>
          {formatTime(trimDuration)} / {MAX_DURATION}s max
        </span>
      </div>

      {/* Video preview */}
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={previewUrl}
          className="max-w-full max-h-full object-contain"
          playsInline
          onEnded={() => setIsPlaying(false)}
        />
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-transparent"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {!isPlaying && (
            <div className="bg-black/50 rounded-full p-3">
              <Play className="h-6 w-6 text-white fill-white" />
            </div>
          )}
        </button>
        {isPlaying && (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute bottom-2 right-2 bg-black/50 rounded-full p-1.5"
          >
            <Pause className="h-4 w-4 text-white fill-white" />
          </button>
        )}
      </div>

      {/* Timeline trimmer */}
      <div className="space-y-2">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{formatTime(startTime)}</span>
          <span className="text-foreground font-medium">{formatTime(trimDuration)} selected</span>
          <span>{formatTime(endTime)}</span>
        </div>

        <div
          ref={timelineRef}
          className="relative h-10 rounded-lg overflow-visible select-none"
          style={{ touchAction: "none" }}
        >
          {/* Full track */}
          <div className="absolute inset-0 rounded-lg bg-muted" />

          {/* Dimmed regions outside trim */}
          <div
            className="absolute top-0 bottom-0 left-0 rounded-l-lg bg-black/40"
            style={{ width: `${startPct}%` }}
          />
          <div
            className="absolute top-0 bottom-0 right-0 rounded-r-lg bg-black/40"
            style={{ width: `${100 - endPct}%` }}
          />

          {/* Selected range highlight */}
          <div
            className="absolute top-0 bottom-0 border-y-2 border-primary bg-primary/10"
            style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
          />

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/80 pointer-events-none"
            style={{ left: `${currentPct}%` }}
          />

          {/* Start handle */}
          <div
            className="absolute top-0 bottom-0 w-5 -ml-2.5 flex items-center justify-center cursor-ew-resize z-10"
            style={{ left: `${startPct}%` }}
            onPointerDown={(e) => handlePointerDown(e, "start")}
          >
            <div className="w-3 h-10 bg-primary rounded-l flex items-center justify-center shadow-md">
              <div className="w-0.5 h-4 bg-white/70 rounded" />
            </div>
          </div>

          {/* End handle */}
          <div
            className="absolute top-0 bottom-0 w-5 -mr-2.5 flex items-center justify-center cursor-ew-resize z-10"
            style={{ left: `${endPct}%` }}
            onPointerDown={(e) => handlePointerDown(e, "end")}
          >
            <div className="w-3 h-10 bg-primary rounded-r flex items-center justify-center shadow-md">
              <div className="w-0.5 h-4 bg-white/70 rounded" />
            </div>
          </div>
        </div>

        {needsTrim && trimDuration > MAX_DURATION && (
          <p className="text-[11px] text-destructive">
            Trim to {MAX_DURATION} seconds or less to post.
          </p>
        )}
        {!needsTrim && (
          <p className="text-[11px] text-muted-foreground">
            Video is under {MAX_DURATION}s — you can post as-is or trim further.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onCancel} disabled={trimming}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Change Video
        </Button>
        <Button
          type="button"
          size="sm"
          className="flex-1"
          onClick={handleConfirmTrim}
          disabled={trimming || trimDuration > MAX_DURATION}
        >
          {trimming ? (
            <span className="flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" />
              </svg>
              Trimming...
            </span>
          ) : (
            <>
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Use This Clip
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
