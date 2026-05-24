"use client"

import { useEffect, useState, useCallback } from "react"
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
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"

interface ShopQRModalProps {
  open: boolean
  onClose: () => void
  shopUrl: string
  shopName: string
}

export default function ShopQRModal({ open, onClose, shopUrl, shopName }: ShopQRModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("")
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  // Pre-generate as soon as component mounts (not on open) — instant display
  useEffect(() => {
    QRCode.toDataURL(shopUrl, {
      width: 280,
      margin: 2,
      color: { dark: "#4f0499", light: "#ffffff" },
      errorCorrectionLevel: "H",
    }).then(setQrDataUrl).catch(() => {})
  }, [shopUrl])

  const handleDownload = useCallback(() => {
    if (!qrDataUrl) return
    // Draw decorated card for download
    const img = new window.Image()
    img.onload = () => {
      const pad = 32
      const footerH = 56
      const out = document.createElement("canvas")
      out.width = img.width + pad * 2
      out.height = img.height + pad * 2 + footerH
      const ctx = out.getContext("2d")!

      // Gradient background
      const bg = ctx.createLinearGradient(0, 0, out.width, out.height)
      bg.addColorStop(0, "#fdf4ff")
      bg.addColorStop(1, "#ede9fe")
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, out.width, out.height)

      ctx.drawImage(img, pad, pad)

      // Shop name
      ctx.fillStyle = "#4f0499"
      ctx.font = "bold 16px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText(shopName, out.width / 2, img.height + pad + 26)

      ctx.fillStyle = "#9ca3af"
      ctx.font = "11px sans-serif"
      ctx.fillText("shoppieapp.co.zw", out.width / 2, img.height + pad + 46)

      const link = document.createElement("a")
      link.download = `${shopName.replace(/\s+/g, "-")}-qr.png`
      link.href = out.toDataURL("image/png")
      link.click()
    }
    img.src = qrDataUrl
  }, [qrDataUrl, shopName])

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
          <div className="relative rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4 shadow-inner ring-1 ring-violet-100">
            {qrDataUrl ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt={`QR code for ${shopName}`}
                  width={240}
                  height={240}
                  className="block rounded-xl"
                />
                {/* Logo centered via CSS — no canvas manipulation */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="rounded-xl bg-white p-1.5 shadow-md ring-1 ring-violet-100">
                    <Image src="/logo.png" alt="ShoppieApp" width={40} height={40} className="block" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-[240px] w-[240px] items-center justify-center rounded-xl bg-white">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
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
            <Button variant="outline" className="gap-2" onClick={handleDownload} disabled={!qrDataUrl}>
              <Download className="h-4 w-4" />
              Save QR
            </Button>
            <Button className="gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700" onClick={handleShare}>
              <Share2 className="h-4 w-4" />
              Share Link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
