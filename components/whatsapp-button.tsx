"use client"

import { Button } from "@/components/ui/button"
import { MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface WhatsAppButtonProps {
  phoneNumber: string
  shopName: string
  productName: string
  label?: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg"
  className?: string
}

export default function WhatsAppButton({
  phoneNumber,
  shopName,
  productName,
  label = "Contact on WhatsApp",
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
    <Button
      variant={variant}
      size={size}
      // WhatsApp's own brand green, so the button reads as "WhatsApp" at a
      // glance rather than as another generic primary action. Tinted back for
      // the non-solid variants, which have no fill to colour.
      className={cn(
        "gap-2",
        variant === "default"
          ? "bg-[#25D366] text-white hover:bg-[#1eb455] focus-visible:ring-[#25D366]/40"
          : "text-[#128C3E] hover:bg-[#25D366]/10 hover:text-[#0f7032]",
        className,
      )}
      onClick={handleWhatsAppClick}
    >
      <MessageCircle className="h-4 w-4" />
      {label}
    </Button>
  )
}
