"use client"

import { Button } from "@/components/ui/button"
import { MessageCircle } from "lucide-react"

interface WhatsAppButtonProps {
  phoneNumber: string
  shopName: string
  productName: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg"
  className?: string
}

export default function WhatsAppButton({
  phoneNumber,
  shopName,
  productName,
  variant = "default",
  size = "default",
  className = "",
}: WhatsAppButtonProps) {
  const handleWhatsAppClick = () => {
    const cleanNumber = phoneNumber.replace(/\s/g, "")

    const message = `Hello ${shopName}, I found this *${productName}* on *ShoppieApp*, I would like to ask ...`

    const encodedMessage = encodeURIComponent(message)

    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodedMessage}`

    window.open(whatsappUrl, "_blank")
  }

  return (
    <Button variant={variant} size={size} className={`gap-2 ${className}`} onClick={handleWhatsAppClick}>
      <MessageCircle className="h-4 w-4" />
      Contact on WhatsApp
    </Button>
  )
}
