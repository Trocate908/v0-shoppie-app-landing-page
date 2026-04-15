"use client"

import { useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { MessageCircle, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface MessageSellerButtonProps {
  productId: string
  vendorId: string
  className?: string
  variant?: "default" | "outline" | "secondary" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
  showLabel?: boolean
  onConversationReady?: (conversationId: string) => void
}

export default function MessageSellerButton({
  productId,
  vendorId,
  className,
  variant = "outline",
  size = "default",
  showLabel = true,
  onConversationReady,
}: MessageSellerButtonProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  async function handleClick() {
    setLoading(true)
    console.log("[v0] MessageSellerButton clicked", { productId, vendorId })
    try {
      const supabase = createBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      console.log("[v0] Current user:", user?.id ?? "not logged in")

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

      console.log("[v0] Creating conversation with:", { product_id: productId, vendor_id: vendorId })
      const res = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, vendor_id: vendorId }),
      })

      console.log("[v0] Conversation API response status:", res.status)

      if (!res.ok) {
        const err = await res.json()
        console.log("[v0] Conversation API error:", err)
        throw new Error(err.error ?? "Failed to start conversation")
      }

      const { conversation } = await res.json()
      console.log("[v0] Conversation created/fetched:", conversation)

      if (onConversationReady) {
        // In-app navigation: let the parent handle it
        onConversationReady(conversation.id)
      } else {
        // Fallback: navigate to messages tab with conversation pre-selected
        console.log("[v0] Navigating to:", `/?tab=messages&cid=${conversation.id}`)
        window.location.href = `/?tab=messages&cid=${conversation.id}`
      }
    } catch (err: unknown) {
      console.log("[v0] MessageSellerButton error:", err)
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
