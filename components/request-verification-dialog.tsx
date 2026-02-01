"use client"

import type React from "react"

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
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { BadgeCheck } from "lucide-react"
import { Input } from "@/components/ui/input"

interface RequestVerificationDialogProps {
  vendorId: string
  verificationStatus: string
}

export function RequestVerificationDialog({ vendorId, verificationStatus }: RequestVerificationDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState("")
  const [documents, setDocuments] = useState<File[]>([])
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setDocuments(files)
  }

  const handleSubmit = async () => {
    if (!notes.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide details about your business",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    const supabase = createBrowserClient()

    try {
      const documentUrls: string[] = []

      // For now, just store filenames - in production you'd upload to Cloudinary
      for (const doc of documents) {
        documentUrls.push(`pending_upload_${doc.name}`)
      }

      const { error } = await supabase
        .from("vendors")
        .update({
          verification_status: "pending",
          verification_requested_at: new Date().toISOString(),
          verification_notes: notes,
          verification_documents: documentUrls,
        })
        .eq("id", vendorId)

      if (error) throw error

      toast({
        title: "Verification requested",
        description: "Your verification request has been submitted. We'll review it within 2-3 business days.",
      })

      setOpen(false)
      window.location.reload()
    } catch (error) {
      toast({
        title: "Request failed",
        description: error instanceof Error ? error.message : "Failed to submit verification request",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getButtonText = () => {
    switch (verificationStatus) {
      case "pending":
        return "Verification Pending"
      case "verified":
        return "Verified"
      case "rejected":
        return "Reapply for Verification"
      default:
        return "Request Verification"
    }
  }

  const isDisabled = verificationStatus === "pending" || verificationStatus === "verified"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isDisabled}>
          <BadgeCheck className="mr-2 h-4 w-4" />
          {getButtonText()}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Vendor Verification</DialogTitle>
          <DialogDescription>
            Get a verified badge to build trust with buyers. Provide business details and supporting documents.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Business Information *</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe your business, registration details, physical location, etc."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Include business registration number, tax ID, or any official documents
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="documents">Supporting Documents (Optional)</Label>
            <Input
              id="documents"
              type="file"
              onChange={handleFileChange}
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              Upload business license, ID, or other verification documents (Max 5MB each)
            </p>
            {documents.length > 0 && (
              <p className="text-sm text-foreground">
                {documents.length} file(s) selected: {documents.map((d) => d.name).join(", ")}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Submitting..." : "Submit Request"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
