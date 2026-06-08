"use client"

import { useState } from "react"
import { Bell, Send } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [target, setTarget] = useState("all")
  const [type, setType] = useState("platform_update")
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState<{ title: string; target: string; type: string; sentAt: string }[]>([])
  const { toast } = useToast()

  async function handleSend() {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Missing fields", description: "Title and message are required", variant: "destructive" })
      return
    }
    setSending(true)
    const r = await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, message, target, type }),
    })
    const d = await r.json()
    setSending(false)
    if (!r.ok) {
      toast({ title: "Error", description: d.error ?? "Failed to send", variant: "destructive" })
    } else {
      toast({ title: "Notification sent!", description: `Delivered to: ${target}` })
      setHistory(prev => [{ title, target, type, sentAt: new Date().toLocaleString() }, ...prev])
      setTitle("")
      setMessage("")
    }
  }

  const TYPE_LABELS: Record<string, string> = {
    platform_update: "Platform Update",
    promotion: "Promotion",
    security_alert: "Security Alert",
    recommendation: "Product Recommendation",
  }

  const TARGET_LABELS: Record<string, string> = {
    all: "All Users",
    vendors: "Vendors Only",
    buyers: "Buyers Only",
    verified: "Verified Vendors",
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6 text-violet-600" />
          Push Notification Center
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Send push notifications to platform users</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <h2 className="font-semibold">Compose Notification</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Notification Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Target Audience</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TARGET_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Notification title…" maxLength={80} />
          <p className="text-xs text-muted-foreground text-right">{title.length}/80</p>
        </div>

        <div className="space-y-1.5">
          <Label>Message</Label>
          <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Notification body…" rows={4} maxLength={300} />
          <p className="text-xs text-muted-foreground text-right">{message.length}/300</p>
        </div>

        <button
          onClick={handleSend}
          disabled={sending || !title.trim() || !message.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {sending ? "Sending…" : "Send Notification"}
        </button>
      </div>

      {history.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border font-semibold text-sm">Sent This Session</div>
          <div className="divide-y divide-border">
            {history.map((h, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-sm">{h.title}</p>
                  <p className="text-xs text-muted-foreground">{h.sentAt}</p>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  <Badge variant="outline" className="text-xs">{TYPE_LABELS[h.type]}</Badge>
                  <Badge variant="secondary" className="text-xs">{TARGET_LABELS[h.target]}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
