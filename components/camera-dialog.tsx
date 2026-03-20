"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Camera, RefreshCw, Check, FlipHorizontal, AlertCircle } from "lucide-react"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCapture: (file: File, previewUrl: string) => void
}

export function CameraDialog({ open, onOpenChange, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [phase, setPhase] = useState<"preview" | "captured">("preview")
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment")
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const startCamera = useCallback(
    async (facing: "environment" | "user") => {
      stopStream()
      setError(null)
      setStarting(true)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (err: any) {
        if (err.name === "NotAllowedError") {
          setError("Camera permission denied. Please allow camera access and try again.")
        } else if (err.name === "NotFoundError") {
          setError("No camera found on this device.")
        } else {
          setError("Could not start camera. " + (err.message || ""))
        }
      } finally {
        setStarting(false)
      }
    },
    [stopStream],
  )

  // Start / stop camera when dialog opens/closes
  useEffect(() => {
    if (open) {
      setPhase("preview")
      setCapturedDataUrl(null)
      startCamera(facingMode)
    } else {
      stopStream()
    }
    return () => {
      stopStream()
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const flipCamera = async () => {
    const next = facingMode === "environment" ? "user" : "environment"
    setFacingMode(next)
    await startCamera(next)
  }

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 640
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92)
    setCapturedDataUrl(dataUrl)
    setPhase("captured")
    stopStream()
  }

  const handleRetake = () => {
    setCapturedDataUrl(null)
    setPhase("preview")
    startCamera(facingMode)
  }

  const handleUse = () => {
    if (!capturedDataUrl) return
    // Convert data URL → File
    const arr = capturedDataUrl.split(",")
    const mime = arr[0].match(/:(.*?);/)![1]
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8 = new Uint8Array(n)
    while (n--) u8[n] = bstr.charCodeAt(n)
    const file = new File([u8], `camera-${Date.now()}.jpg`, { type: mime })
    onCapture(file, capturedDataUrl)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-lg flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Take a Photo
          </DialogTitle>
          <DialogDescription>
            Use your camera to capture a product photo
          </DialogDescription>
        </DialogHeader>

        {/* Camera viewport */}
        <div className="relative flex-1 min-h-0 bg-black flex items-center justify-center" style={{ minHeight: 300 }}>
          {error ? (
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm text-white/80">{error}</p>
              <Button size="sm" variant="outline" onClick={() => startCamera(facingMode)}>
                Try Again
              </Button>
            </div>
          ) : phase === "preview" ? (
            <>
              {starting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                  <RefreshCw className="h-8 w-8 animate-spin text-white/70" />
                </div>
              )}
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
                style={{ maxHeight: 480 }}
              />
              {/* Viewfinder guide */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-56 w-56 rounded-xl border-2 border-white/40" />
              </div>
            </>
          ) : (
            capturedDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={capturedDataUrl}
                alt="Captured photo"
                className="h-full w-full object-cover"
                style={{ maxHeight: 480 }}
              />
            )
          )}
        </div>

        {/* Hidden canvas for snapshot */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Controls */}
        <div className="shrink-0 border-t border-border bg-card px-5 py-4">
          {phase === "preview" ? (
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={flipCamera}
                disabled={starting || !!error}
                title="Flip camera"
              >
                <FlipHorizontal className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                onClick={handleCapture}
                disabled={starting || !!error}
                className="flex-1"
              >
                <Camera className="mr-2 h-4 w-4" />
                Capture Photo
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="shrink-0"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={handleRetake} className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                Retake
              </Button>
              <Button type="button" onClick={handleUse} className="flex-1">
                <Check className="mr-2 h-4 w-4" />
                Use Photo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
