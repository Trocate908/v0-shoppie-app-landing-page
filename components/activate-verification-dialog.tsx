"use client"

import { useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { BadgeCheck, ExternalLink, Calendar } from "lucide-react"

interface ActivateVerificationDialogProps {
  vendorId: string
  shopName: string
  isVerified: boolean
  expiresAt: string | null
}

// Generate device fingerprint
function getDeviceFingerprint(): string {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (ctx) {
    ctx.textBaseline = "top"
    ctx.font = "14px Arial"
    ctx.fillText("fingerprint", 2, 2)
  }
  const canvasData = canvas.toDataURL()

  const fingerprint = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    canvasFingerprint: canvasData.substring(0, 50),
  }

  return btoa(JSON.stringify(fingerprint))
}

export function ActivateVerificationDialog({
  vendorId,
  shopName,
  isVerified,
  expiresAt,
}: ActivateVerificationDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [keyCode, setKeyCode] = useState("")
  const { toast } = useToast()

  const handleSubscribe = () => {
    const message = `Greetings, I want to subscribe for a monthly verification key for my ${shopName}.`
    const whatsappUrl = `https://wa.me/263715907468?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, "_blank")
  }

  const handleActivateKey = async () => {
    const cleanKey = keyCode.trim().replace(/\s/g, "")

    if (cleanKey.length !== 17) {
      toast({
        title: "Invalid key",
        description: "Please enter a valid 17-digit activation key",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    const supabase = createBrowserClient()

    try {
      // Get device fingerprint
      const deviceFingerprint = getDeviceFingerprint()

      // Check if key exists and is valid
      const { data: keyData, error: keyError } = await supabase
        .from("verification_keys")
        .select("*")
        .eq("key_code", cleanKey)
        .single()

      if (keyError || !keyData) {
        throw new Error("Invalid activation key")
      }

      if (keyData.is_used) {
        throw new Error("This key has already been used")
      }

      // Calculate expiration date (1 month from now)
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

      // Mark key as used and link to vendor
      const { error: updateKeyError } = await supabase
        .from("verification_keys")
        .update({
          is_used: true,
          vendor_id: vendorId,
          device_fingerprint: deviceFingerprint,
          activated_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .eq("key_code", cleanKey)

      if (updateKeyError) throw updateKeyError

      // Update vendor verification status
      const { error: vendorError } = await supabase
        .from("vendors")
        .update({
          is_verified: true,
          verification_status: "verified",
          verification_key: cleanKey,
          verification_activated_at: now.toISOString(),
          verification_expires_at: expiresAt.toISOString(),
          verification_device_fingerprint: deviceFingerprint,
        })
        .eq("id", vendorId)

      if (vendorError) throw vendorError

      toast({
        title: "Verification activated!",
        description: `Your verification badge is now active until ${expiresAt.toLocaleDateString()}`,
      })

      setOpen(false)
      window.location.reload()
    } catch (error) {
      toast({
        title: "Activation failed",
        description: error instanceof Error ? error.message : "Failed to activate key",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const formatExpiryDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const isExpired = expiresAt && new Date(expiresAt) < new Date()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isVerified && !isExpired ? "outline" : "default"} size="sm">
          <BadgeCheck className="mr-2 h-4 w-4" />
          {isVerified && !isExpired ? "Verified" : isExpired ? "Renew Verification" : "Get Verified"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vendor Verification Badge</DialogTitle>
          <DialogDescription>Stand out with a verified badge and build trust with your customers</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isVerified && !isExpired && expiresAt && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <Calendar className="h-5 w-5" />
                <div>
                  <p className="font-semibold">Verification Active</p>
                  <p className="text-sm">Expires on {formatExpiryDate(expiresAt)}</p>
                </div>
              </div>
            </div>
          )}

          {(!isVerified || isExpired) && (
            <>
              <div className="space-y-2">
                <Label htmlFor="key">Activation Key</Label>
                <Input
                  id="key"
                  type="text"
                  value={keyCode}
                  onChange={(e) => setKeyCode(e.target.value)}
                  placeholder="Enter 17-digit key"
                  maxLength={17}
                  className="font-mono text-center text-lg tracking-wider"
                />
                <p className="text-xs text-muted-foreground">
                  Enter your purchased verification key to activate your badge
                </p>
              </div>

              <div className="rounded-lg border border-border bg-muted p-4">
                <p className="mb-3 text-sm font-medium">Don't have a key?</p>
                <Button onClick={handleSubscribe} variant="outline" className="w-full bg-transparent" type="button">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Subscribe for Monthly Key
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Contact us via WhatsApp to purchase a monthly verification key
                </p>
              </div>
            </>
          )}
        </div>

        {(!isVerified || isExpired) && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleActivateKey} disabled={loading || !keyCode.trim()}>
              {loading ? "Activating..." : "Activate Key"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
