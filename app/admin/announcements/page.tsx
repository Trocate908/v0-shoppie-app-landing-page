"use client"

import { useEffect, useState } from "react"
import { Megaphone, Plus, Trash2, Calendar } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

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
      toast({ title: "Announcement created!" })
      setForm({ title: "", message: "", target_audience: "all", expires_at: "" })
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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-violet-600" />
          Announcement Center
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Broadcast messages to platform users</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">New Announcement</h2>
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
          <Label>Expiry Date (optional)</Label>
          <Input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} className="w-48" />
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />{creating ? "Creating…" : "Create Announcement"}
        </button>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">Active Announcements</h2>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-card border border-border rounded-xl p-4 h-24 animate-pulse" />)
        ) : announcements.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-xl">
            <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>No announcements yet</p>
          </div>
        ) : announcements.map(a => (
          <div key={a.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="font-semibold">{a.title}</p>
                  <Badge variant="outline" className="text-xs">{TARGET_LABELS[a.target_audience] ?? a.target_audience}</Badge>
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
              <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
