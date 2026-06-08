"use client"

import { useEffect, useState } from "react"
import { Megaphone, Plus, Trash2, Calendar, Eye, EyeOff, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"

interface Announcement {
  id: string
  title: string
  message: string
  target_audience: string
  expires_at: string | null
  created_at: string
  is_active: boolean
}

const TARGET_LABELS: Record<string, string> = {
  all: "All Users",
  vendors: "Vendors Only",
  buyers: "Buyers Only",
  verified_vendors: "Verified Vendors",
}

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [form, setForm] = useState({ title: "", message: "", target_audience: "all", expires_at: "" })
  const { toast } = useToast()

  async function load() {
    setLoading(true)
    const r = await fetch("/api/admin/announcements")
    const d = await r.json()
    setAnnouncements(d.announcements ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate() {
    if (!form.title.trim() || !form.message.trim()) {
      toast({ title: "Missing fields", variant: "destructive" })
      return
    }
    setCreating(true)
    const r = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", ...form }),
    })
    const d = await r.json()
    setCreating(false)
    if (!r.ok) toast({ title: "Error", description: d.error, variant: "destructive" })
    else {
      toast({ title: "Announcement created!", description: "It is now live for users." })
      setForm({ title: "", message: "", target_audience: "all", expires_at: "" })
      setShowPreview(false)
      load()
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    const r = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", id, is_active: !isActive }),
    })
    if (r.ok) {
      toast({ title: isActive ? "Announcement hidden" : "Announcement made live" })
      load()
    }
  }

  async function handleDelete(id: string) {
    const r = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    })
    if (r.ok) { toast({ title: "Deleted" }); load() }
  }

  const now = new Date()
  const active = announcements.filter(a => a.is_active && (!a.expires_at || new Date(a.expires_at) > now))
  const inactive = announcements.filter(a => !a.is_active || (a.expires_at && new Date(a.expires_at) <= now))

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-violet-600" />Announcement Center
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Broadcast messages shown as banners to platform users</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">New Announcement</h2>
          <button
            onClick={() => setShowPreview(p => !p)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
          >
            {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showPreview ? "Hide Preview" : "Show Preview"}
          </button>
        </div>

        {showPreview && (form.title || form.message) && (
          <div className="w-full bg-violet-600 text-white px-4 py-2.5 rounded-lg flex items-center gap-3">
            <Megaphone className="h-4 w-4 shrink-0 opacity-80" />
            <div className="flex-1 min-w-0 text-sm">
              <span className="font-semibold mr-2">{form.title || "Title"}:</span>
              <span className="opacity-90">{form.message || "Message"}</span>
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Announcement title…" />
          </div>
          <div className="space-y-1.5">
            <Label>Target Audience</Label>
            <Select value={form.target_audience} onValueChange={v => setForm(f => ({ ...f, target_audience: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TARGET_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Message</Label>
          <Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Your announcement…" rows={3} />
        </div>
        <div className="space-y-1.5">
          <Label>Expiry Date <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
          <Input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} className="w-48" />
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />{creating ? "Creating…" : "Publish Announcement"}
        </button>
      </div>

      {/* Active */}
      <div className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full" />Live Announcements
          <span className="text-sm font-normal text-muted-foreground">({active.length})</span>
        </h2>
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => <div key={i} className="bg-card border border-border rounded-xl p-4 h-24 animate-pulse" />)
        ) : active.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground bg-card border border-border rounded-xl text-sm">
            No live announcements
          </div>
        ) : active.map(a => (
          <div key={a.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="font-semibold">{a.title}</p>
                  <Badge variant="outline" className="text-xs">{TARGET_LABELS[a.target_audience] ?? a.target_audience}</Badge>
                  <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Live</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{a.message}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{new Date(a.created_at).toLocaleDateString()}</span>
                  {a.expires_at && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />Expires {new Date(a.expires_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch checked={a.is_active} onCheckedChange={() => handleToggle(a.id, a.is_active)} />
                <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Inactive */}
      {inactive.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold flex items-center gap-2 text-muted-foreground">
            <span className="w-2 h-2 bg-muted rounded-full" />Hidden / Expired
            <span className="text-sm font-normal">({inactive.length})</span>
          </h2>
          {inactive.map(a => (
            <div key={a.id} className="bg-card border border-border rounded-xl p-4 opacity-60">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold">{a.title}</p>
                    <Badge variant="secondary" className="text-xs">
                      {a.expires_at && new Date(a.expires_at) <= now ? "Expired" : "Hidden"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{a.message}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!a.expires_at || new Date(a.expires_at) > now ? (
                    <Switch checked={false} onCheckedChange={() => handleToggle(a.id, a.is_active)} />
                  ) : null}
                  <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
