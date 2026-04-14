"use client"

import { useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { MessageCircle, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

interface MessageSellerButtonProps {
  productId: string
  vendorId: string
  className?: string
  variant?: "default" | "outline" | "secondary" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
  showLabel?: boolean
}

export default function MessageSellerButton({
  productId,
  vendorId,
  className,
  variant = "outline",
  size = "default",
  showLabel = true,
}: MessageSellerButtonProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  async function handleClick() {
    setLoading(true)
    try {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        toast({
          title: "Sign in required",
          description: "Please sign in to message this seller.",
          variant: "destructive",
        })
        return
      }

      if (user.id === vendorId) {
        toast({
          title: "This is your product",
          description: "You cannot message yourself.",
        })
        return
      }

      const res = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, vendor_id: vendorId }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed to start conversation")
      }

      // Navigate to the home page messages tab
      router.push("/?tab=messages")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong"
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={loading}
      className={className}
      aria-label="Message seller"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <MessageCircle className="h-4 w-4" />
      )}
      {showLabel && <span className="ml-2">Message Seller</span>}
    </Button>
  )
}
