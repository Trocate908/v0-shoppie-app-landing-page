"use client"

import { useState, useEffect } from "react"
import { Bell, Send, History, Users, CheckCircle2, ExternalLink, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

interface NotificationLog {
  id: string
  title: string
  message: string
  target_audience: string
  notification_type: string
  recipients: number
  onesignal_id: string | null
  sent_by: string
  url: string | null
  created_at: string
}

const TYPE_LABELS: Record<string, string> = {
  platform_update: "Platform Update",
  promotion: "Promotion",
  security_alert: "Security Alert",
  recommendation: "Product Recommendation",
  announcement: "Announcement",
  admin_broadcast: "Broadcast",
}

const TARGET_LABELS: Record<string, string> = {
  all: "All Users",
  vendors: "Vendors Only",
  buyers: "Buyers Only",
  verified_vendors: "Verified Vendors",
}

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [target, setTarget] = useState("all")
  const [type, setType] = useState("platform_update")
  const [url, setUrl] = useState("")
  const [sending, setSending] = useState(false)
  const [logs, setLogs] = useState<NotificationLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const { toast } = useToast()

  async function loadHistory() {
    setLogsLoading(true)
    try {
      const r = await fetch("/api/admin/notifications")
      const d = await r.json()
      setLogs(d.logs ?? [])
    } catch {}
    setLogsLoading(false)
  }

  useEffect(() => { loadHistory() }, [])

  async function handleSend() {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Missing fields", description: "Title and message are required", variant: "destructive" })
      return
    }
    setSending(true)
    const r = await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, message, target, type, url: url.trim() || undefined }),
    })
    const d = await r.json()
    setSending(false)
    if (!r.ok) {
      toast({ title: "Failed to send", description: d.error ?? "OneSignal error", variant: "destructive" })
    } else {
      toast({
        title: "Notification sent!",
        description: `Delivered to ${d.recipients ?? 0} subscriber${d.recipients !== 1 ? "s" : ""}`,
      })
      setTitle("")
      setMessage("")
      setUrl("")
      loadHistory()
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6 text-violet-600" />
          Push Notification Center
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Send push notifications via OneSignal to platform users</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <h2 className="font-semibold">Compose Notification</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Type</Label>
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
          <Label>Title <span className="text-muted-foreground font-normal text-xs">{title.length}/80</span></Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Notification title…" maxLength={80} />
        </div>

        <div className="space-y-1.5">
          <Label>Message <span className="text-muted-foreground font-normal text-xs">{message.length}/300</span></Label>
          <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Notification body…" rows={4} maxLength={300} />
        </div>

        <div className="space-y-1.5">
          <Label>Deep Link URL <span className="text-muted-foreground font-normal text-xs">(optional — tapping opens this URL)</span></Label>
          <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://shoppieapp.co.zw/browse" />
        </div>

        {(title || message) && (
          <div className="bg-muted/50 border border-border rounded-xl p-4 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Preview</p>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
                <Bell className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm">{title || "Title"}</p>
                <p className="text-sm text-muted-foreground">{message || "Message"}</p>
                {url && (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-600 flex items-center gap-1 mt-1">
                    <ExternalLink className="h-3 w-3" />{url}
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={sending || !title.trim() || !message.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {sending ? "Sending…" : `Send to ${TARGET_LABELS[target]}`}
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <History className="h-4 w-4" />Notification History
          </h2>
          <button onClick={loadHistory} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={`h-3.5 w-3.5 ${logsLoading ? "animate-spin" : ""}`} />Refresh
          </button>
        </div>

        {logsLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 h-20 animate-pulse" />
          ))
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-xl">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No notifications sent yet</p>
            <p className="text-xs mt-1">Run DB Setup first if this is a new installation</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {logs.map(log => (
              <div key={log.id} className="p-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="font-medium text-sm">{log.title}</p>
                    <Badge variant="outline" className="text-xs">{TYPE_LABELS[log.notification_type] ?? log.notification_type}</Badge>
                    <Badge variant="secondary" className="text-xs">{TARGET_LABELS[log.target_audience] ?? log.target_audience}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">{log.message}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1 text-green-600 font-medium">
                      <CheckCircle2 className="h-3 w-3" />{log.recipients ?? 0} delivered
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />{log.sent_by}
                    </span>
                    <span>{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
