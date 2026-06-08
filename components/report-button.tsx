"use client"

import { useState } from "react"
import { Flag } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"

const REASONS = [
  "Spam or misleading",
  "Inappropriate content",
  "Counterfeit or fake product",
  "Scam or fraud",
  "Prohibited item",
  "Price gouging",
  "Other",
]

interface ReportButtonProps {
  targetType: "product" | "vendor" | "user"
  targetId: string
  className?: string
  variant?: "icon" | "text"
}

export default function ReportButton({
  targetType,
  targetId,
  className = "",
  variant = "icon",
}: ReportButtonProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [details, setDetails] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  async function handleSubmit() {
    if (!reason) {
      toast({ title: "Please select a reason", variant: "destructive" })
      return
    }
    setSubmitting(true)
    const r = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type: targetType, target_id: targetId, reason, details }),
    })
    const d = await r.json()
    setSubmitting(false)
    if (!r.ok) {
      toast({ title: "Failed to submit report", description: d.error, variant: "destructive" })
    } else {
      toast({ title: "Report submitted", description: "Our team will review it shortly." })
      setOpen(false)
      setReason("")
      setDetails("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <button className={`flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors ${className}`}>
            <Flag className="h-3.5 w-3.5" />
            Report
          </button>
        ) : (
          <button className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors ${className}`}>
            <Flag className="h-4 w-4" />
            Report {targetType}
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-destructive" />
            Report {targetType}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason…" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Additional details <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="Describe the issue…"
              rows={3}
              maxLength={500}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !reason}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {submitting ? "Submitting…" : "Submit Report"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
