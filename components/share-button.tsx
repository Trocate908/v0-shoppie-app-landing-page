"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Share2, Copy, Facebook, Twitter, Linkedin, MessageCircle, Check } from "lucide-react"
import { toast } from "sonner"
import QRCode from "qrcode"
import Image from "next/image"

interface ShareButtonProps {
  productId: string
  productName: string
  productPrice: number
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
  showLabel?: boolean
}

export default function ShareButton({
  productId,
  productName,
  productPrice,
  variant = "ghost",
  size = "icon",
  showLabel = false,
}: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("")

  const productUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/product/${productId}`
  const shareText = `Check out ${productName} for $${productPrice.toFixed(2)} on ShoppieApp!`

  const generateQRCode = async () => {
    try {
      const url = await QRCode.toDataURL(productUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      })
      setQrCodeUrl(url)
    } catch (error) {
      console.error("Error generating QR code:", error)
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open && !qrCodeUrl) {
      generateQRCode()
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(productUrl)
      setCopied(true)
      toast.success("Link copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error("Failed to copy link")
    }
  }

  const shareToSocial = (platform: string) => {
    const encodedUrl = encodeURIComponent(productUrl)
    const encodedText = encodeURIComponent(shareText)

    const urls: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
    }

    window.open(urls[platform], "_blank", "noopener,noreferrer")
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className="gap-2" onClick={handleClick}>
          <Share2 className="h-4 w-4" />
          {showLabel && <span>Share</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" onClick={handleClick}>
        <DialogHeader>
          <DialogTitle>Share Product</DialogTitle>
          <DialogDescription>Share this product with your friends and family</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Social Media Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="gap-2 bg-transparent" onClick={() => shareToSocial("facebook")}>
              <Facebook className="h-4 w-4 text-blue-600" />
              Facebook
            </Button>
            <Button variant="outline" className="gap-2 bg-transparent" onClick={() => shareToSocial("twitter")}>
              <Twitter className="h-4 w-4 text-sky-500" />
              Twitter
            </Button>
            <Button variant="outline" className="gap-2 bg-transparent" onClick={() => shareToSocial("linkedin")}>
              <Linkedin className="h-4 w-4 text-blue-700" />
              LinkedIn
            </Button>
            <Button variant="outline" className="gap-2 bg-transparent" onClick={() => shareToSocial("whatsapp")}>
              <MessageCircle className="h-4 w-4 text-green-600" />
              WhatsApp
            </Button>
          </div>

          {/* Copy Link */}
          <div className="flex items-center gap-2">
            <div className="flex-1 truncate rounded-md border border-border bg-muted px-3 py-2 text-sm">
              {productUrl}
            </div>
            <Button variant="outline" size="icon" onClick={copyToClipboard}>
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          {/* QR Code */}
          {qrCodeUrl && (
            <div className="flex flex-col items-center gap-2 rounded-md border border-border bg-muted p-4">
              <p className="text-sm font-medium text-foreground">Scan QR Code</p>
              <Image src={qrCodeUrl || "/placeholder.svg"} alt="Product QR Code" width={200} height={200} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
