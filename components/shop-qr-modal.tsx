"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import QRCode from "qrcode"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, Copy, Check, Share2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ShopQRModalProps {
  open: boolean
  onClose: () => void
  shopUrl: string
  shopName: string
}

export default function ShopQRModal({ open, onClose, shopUrl, shopName }: ShopQRModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [copied, setCopied] = useState(false)
  const [rendered, setRendered] = useState(false)
  const { toast } = useToast()

  const renderQR = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setRendered(false)

    const size = 300
    canvas.width = size
    canvas.height = size

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // 1. White background
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, size, size)

    // 2. Draw QR in black first on a temp canvas
    const tmp = document.createElement("canvas")
    tmp.width = size
    tmp.height = size
    await QRCode.toCanvas(tmp, shopUrl, {
      width: size,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "H",
    })

    // 3. Read pixels and apply diagonal gradient (hot-pink → purple)
    const tmpCtx = tmp.getContext("2d")!
    const imageData = tmpCtx.getImageData(0, 0, size, size)
    const d = imageData.data

    for (let i = 0; i < d.length; i += 4) {
      const isDark = d[i] < 128
      if (isDark) {
        const x = (i / 4) % size
        const y = Math.floor(i / 4 / size)
        const t = (x + y) / (size * 2) // 0..1 diagonal
        // Interpolate: #e91e8c (hot pink) → #7c3aed (purple)
        d[i]     = Math.round(233 - (233 - 124) * t) // R
        d[i + 1] = Math.round(30  - (30  -  58) * t) // G
        d[i + 2] = Math.round(140 + (237 - 140) * t) // B
        d[i + 3] = 255
      }
    }
    tmpCtx.putImageData(imageData, 0, 0)
    ctx.drawImage(tmp, 0, 0)

    // 4. Logo white badge in center
    const logoSize = size * 0.22
    const cx = size / 2
    const cy = size / 2
    const pad = 6
    const badgeSize = logoSize + pad * 2

    ctx.save()
    ctx.shadowColor = "rgba(0,0,0,0.15)"
    ctx.shadowBlur = 8
    ctx.fillStyle = "#ffffff"
    roundRect(ctx, cx - badgeSize / 2, cy - badgeSize / 2, badgeSize, badgeSize, 10)
    ctx.fill()
    ctx.restore()

    // 5. Draw logo image over badge
    await new Promise<void>((resolve) => {
      const img = new window.Image()
      img.onload = () => {
        ctx.drawImage(img, cx - logoSize / 2, cy - logoSize / 2, logoSize, logoSize)
        resolve()
      }
      img.onerror = () => resolve()
      img.src = "/logo.png"
    })

    setRendered(true)
  }, [shopUrl])

  useEffect(() => {
    if (open) renderQR()
  }, [open, renderQR])

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Build a larger decorated canvas for download
    const out = document.createElement("canvas")
    const pad = 40
    out.width = canvas.width + pad * 2
    out.height = canvas.height + pad * 2 + 56
    const ctx = out.getContext("2d")!

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, out.width, out.height)
    bg.addColorStop(0, "#fdf2f8")
    bg.addColorStop(1, "#ede9fe")
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, out.width, out.height)

    // QR
    ctx.drawImage(canvas, pad, pad)

    // Shop name footer
    ctx.fillStyle = "#7c3aed"
    ctx.font = "bold 18px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(shopName, out.width / 2, canvas.height + pad + 28)

    ctx.fillStyle = "#9ca3af"
    ctx.font = "12px sans-serif"
    ctx.fillText("shoppieapp.co.zw", out.width / 2, canvas.height + pad + 48)

    const link = document.createElement("a")
    link.download = `${shopName.replace(/\s+/g, "-")}-qr.png`
    link.href = out.toDataURL("image/png")
    link.click()
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shopUrl)
      setCopied(true)
      toast({ title: "Link copied!", description: shopUrl })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${shopName} on ShoppieApp`, url: shopUrl })
        return
      } catch {}
    }
    handleCopy()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="text-center">Share Shop</DialogTitle>
          <DialogDescription className="text-center">
            Scan to visit <span className="font-semibold text-foreground">{shopName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 pt-1">
          {/* QR card */}
          <div className="relative rounded-2xl bg-gradient-to-br from-pink-50 to-violet-50 p-4 shadow-inner ring-1 ring-border">
            <canvas
              ref={canvasRef}
              className="block rounded-xl"
              style={{ width: 240, height: 240 }}
            />
            {!rendered && (
              <div className="absolute inset-4 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-sm">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            )}
          </div>

          {/* Short URL pill */}
          <div className="flex w-full items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2">
            <span className="flex-1 truncate text-xs text-muted-foreground">{shopUrl}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>

          {/* Action buttons */}
          <div className="grid w-full grid-cols-2 gap-2">
            <Button variant="outline" className="gap-2" onClick={handleDownload} disabled={!rendered}>
              <Download className="h-4 w-4" />
              Save QR
            </Button>
            <Button className="gap-2" onClick={handleShare}>
              <Share2 className="h-4 w-4" />
              Share Link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
