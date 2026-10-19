"use client"

import { Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCall } from "@/components/call-provider"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

/**
 * Starts a one-to-one voice call for an existing conversation.
 * The provider validates the participants and derives the recipient, so this
 * button only needs the conversation the user is already looking at.
 */
export function CallButton({
  conversationId,
  peerName,
  peerAvatarUrl,
  className,
}: {
  conversationId: string
  peerName: string
  peerAvatarUrl?: string | null
  className?: string
}) {
  const { startCall, session } = useCall()
  const { toast } = useToast()
  const inCall = !!session && session.phase !== "ended"

  async function handleClick() {
    if (inCall) {
      toast({
        title: "You're already in a call",
        description: "End the current call before starting another.",
      })
      return
    }
    await startCall({ conversationId, peerName, peerAvatarUrl })
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleClick}
      aria-label={`Call ${peerName}`}
      title={`Call ${peerName}`}
      className={cn(
        "h-9 w-9 shrink-0 rounded-full text-primary transition-colors hover:bg-primary/10 hover:text-primary",
        className,
      )}
    >
      <Phone className="h-5 w-5" />
    </Button>
  )
}
