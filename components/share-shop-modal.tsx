"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import QRCode from "qrcode"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, Share2, Copy, Check, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ShareShopModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shopName: string
  shopUrl: string
}

const QR_SIZE = 300
const LOGO_RATIO = 0.22 // logo occupies 22% of QR width

export default function ShareShopModal({
  open,
  onOpenChange,
  shopName,
  shopUrl,
}: ShareShopModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [rendered, setRendered] = useState(false)

  const renderQR = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setRendered(false)

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = QR_SIZE
    canvas.height = QR_SIZE

    // ── 1. Draw white background ──────────────────────────────────────
    ctx.fillStyle = "#ffffff"
    ctx.roundRect(0, 0, QR_SIZE, QR_SIZE, 20)
    ctx.fill()

    // ── 2. Generate QR matrix ─────────────────────────────────────────
    const qr = QRCode.create(shopUrl, { errorCorrectionLevel: "H" })
    const { data, size } = qr.modules

    const quiet = 4
    const moduleSize = Math.floor(QR_SIZE / (size + quiet * 2))
    const offsetX = Math.round((QR_SIZE - size * moduleSize) / 2)
    const offsetY = Math.round((QR_SIZE - size * moduleSize) / 2)

    // ── 3. Build gradient for dots ────────────────────────────────────
    const grad = ctx.createLinearGradient(0, 0, QR_SIZE, QR_SIZE)
    grad.addColorStop(0, "#2563eb")   // blue
    grad.addColorStop(0.45, "#7c3aed") // violet
    grad.addColorStop(1, "#ec4899")   // pink

    // ── 4. Draw QR modules with rounded corners ────────────────────────
    const r = moduleSize * 0.35

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (!data[row * size + col]) continue
        const x = offsetX + col * moduleSize
        const y = offsetY + row * moduleSize

        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.roundRect(x + 1, y + 1, moduleSize - 2, moduleSize - 2, r)
        ctx.fill()
      }
    }

    // ── 5. Re-draw the three finder patterns in solid colors ──────────
    drawFinder(ctx, offsetX, offsetY, moduleSize, "#2563eb")
    drawFinder(ctx, offsetX + (size - 7) * moduleSize, offsetY, moduleSize, "#7c3aed")
    drawFinder(ctx, offsetX, offsetY + (size - 7) * moduleSize, moduleSize, "#ec4899")

    // ── 6. Logo in center ─────────────────────────────────────────────
    const logoSize = QR_SIZE * LOGO_RATIO
    const logoX = (QR_SIZE - logoSize) / 2
    const logoY = (QR_SIZE - logoSize) / 2

    // White circle background for logo
    const padded = logoSize + 12
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.arc(QR_SIZE / 2, QR_SIZE / 2, padded / 2, 0, Math.PI * 2)
    ctx.fill()

    // Try to draw the actual logo image
    try {
      const img = new Image()
      img.crossOrigin = "anonymous"
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject()
        img.src = "/logo.png"
      })
      ctx.save()
      ctx.beginPath()
      ctx.arc(QR_SIZE / 2, QR_SIZE / 2, logoSize / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, logoX, logoY, logoSize, logoSize)
      ctx.restore()
    } catch {
      // Fallback: draw a styled "S" if logo fails
      ctx.fillStyle = "#2563eb"
      ctx.beginPath()
      ctx.arc(QR_SIZE / 2, QR_SIZE / 2, logoSize / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = "#ffffff"
      ctx.font = `bold ${Math.round(logoSize * 0.6)}px system-ui`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("S", QR_SIZE / 2, QR_SIZE / 2 + 1)
    }

    // ── 7. Thin border around canvas ──────────────────────────────────
    ctx.strokeStyle = "rgba(0,0,0,0.06)"
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(0.75, 0.75, QR_SIZE - 1.5, QR_SIZE - 1.5, 20)
    ctx.stroke()

    setRendered(true)
  }, [shopUrl])

  useEffect(() => {
    if (open) renderQR()
  }, [open, renderQR])

  // ── Helpers ──────────────────────────────────────────────────────────

  function drawFinder(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    m: number,
    color: string,
  ) {
    // Clear the finder area first (re-draw with solid color)
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(x, y, m * 7, m * 7)

    // Outer square
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(x, y, m * 7, m * 7, m * 0.8)
    ctx.fill()

    // White gap
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.roundRect(x + m, y + m, m * 5, m * 5, m * 0.5)
    ctx.fill()

    // Inner square
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(x + m * 2, y + m * 2, m * 3, m * 3, m * 0.4)
    ctx.fill()
  }

  async function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) return

    // Create a padded version for download
    const padded = document.createElement("canvas")
    const p = 24
    padded.width = QR_SIZE + p * 2
    padded.height = QR_SIZE + p * 2 + 56
    const pCtx = padded.getContext("2d")!

    // White background
    pCtx.fillStyle = "#ffffff"
    pCtx.fillRect(0, 0, padded.width, padded.height)

    // Copy QR
    pCtx.drawImage(canvas, p, p)

    // Shop name text
    pCtx.fillStyle = "#111827"
    pCtx.font = `bold 16px system-ui`
    pCtx.textAlign = "center"
    pCtx.textBaseline = "top"
    pCtx.fillText(shopName, padded.width / 2, QR_SIZE + p + 14)

    pCtx.fillStyle = "#6b7280"
    pCtx.font = `13px system-ui`
    pCtx.fillText("shoppieapp.co.zw", padded.width / 2, QR_SIZE + p + 36)

    const link = document.createElement("a")
    link.download = `${shopName.replace(/\s+/g, "-").toLowerCase()}-qr.png`
    link.href = padded.toDataURL("image/png")
    link.click()
  }

  async function handleShare() {
    // Try native share first
    if (navigator.share) {
      try {
        await navigator.share({ title: shopName, url: shopUrl })
        return
      } catch {
        // fall through to clipboard
      }
    }
    handleCopy()
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shopUrl)
      setCopied(true)
      toast({ title: "Link copied!", description: shopUrl })
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast({ title: "Copy failed", description: "Please copy the link manually.", variant: "destructive" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-center text-lg">Share Shop</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 pb-2">
          {/* QR Code canvas */}
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={QR_SIZE}
              height={QR_SIZE}
              className={`rounded-2xl shadow-md transition-opacity duration-300 ${rendered ? "opacity-100" : "opacity-0"}`}
              style={{ width: QR_SIZE, height: QR_SIZE }}
            />
            {!rendered && (
              <div
                className="absolute inset-0 flex items-center justify-center rounded-2xl bg-muted/60"
                style={{ width: QR_SIZE, height: QR_SIZE }}
              >
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            )}
          </div>

          {/* Shop name + URL */}
          <div className="text-center">
            <p className="font-semibold text-foreground">{shopName}</p>
            <a
              href={shopUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 flex items-center justify-center gap-1 text-xs text-primary hover:underline"
            >
              {shopUrl.replace("https://", "")}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Action buttons */}
          <div className="flex w-full gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleDownload}
              disabled={!rendered}
            >
              <Download className="h-4 w-4" />
              Save QR
            </Button>

            <Button
              className="flex-1 gap-2"
              onClick={handleShare}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : navigator?.share ? (
                <>
                  <Share2 className="h-4 w-4" />
                  Share
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Link
                </>
              )}
            </Button>
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            Scan to visit this shop on ShoppieApp
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
