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
    try {
      const supabase = createBrowserClient()
      let {
        data: { user },
      } = await supabase.auth.getUser()

      // Buyers are not required to have a full account — sign them in anonymously
      // so they get a real auth.uid() that satisfies RLS on conversations/messages.
      if (!user) {
        console.log("[v0] No user found, attempting anonymous sign-in")
        const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously()
        console.log("[v0] Anonymous sign-in result:", { user: anonData?.user?.id, error: anonError?.message })
        if (anonError || !anonData.user) {
          toast({
            title: "Could not start chat",
            description: anonError?.message || "Please try again in a moment.",
            variant: "destructive",
          })
          return
        }
        user = anonData.user
      }
      
      console.log("[v0] User authenticated:", user.id)

      if (user.id === vendorId) {
        toast({
          title: "This is your product",
          description: "You cannot message yourself.",
        })
        return
      }

      console.log("[v0] Creating conversation:", { product_id: productId, vendor_id: vendorId })
      const res = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, vendor_id: vendorId }),
      })

      console.log("[v0] Conversation API status:", res.status)
      
      if (!res.ok) {
        const err = await res.json()
        console.log("[v0] Conversation API error:", err)
        throw new Error(err.error ?? "Failed to start conversation")
      }

      const { conversation } = await res.json()
      console.log("[v0] Conversation created:", conversation?.id)

      if (onConversationReady) {
        onConversationReady(conversation.id)
      } else {
        window.location.href = `/?tab=messages&cid=${conversation.id}`
      }
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
