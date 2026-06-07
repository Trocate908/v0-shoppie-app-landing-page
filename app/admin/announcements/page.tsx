"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2, ToggleLeft, ToggleRight, Megaphone } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

interface Announcement {
  id: string
  title: string
  message: string
  target_audience: string
  expires_at: string | null
  is_active: boolean
  created_at: string
}

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [form, setForm] = useState({ title: "", message: "", target_audience: "all", expires_at: "" })
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  function load() {
    fetch("/api/admin/announcements").then(r => r.json()).then(d => {
      if (d.error) setMissing(true)
      setItems(d.announcements ?? [])
      setLoading(false)
    })
  }

  useEffect(load, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const r = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, expires_at: form.expires_at || null }),
    })
    const d = await r.json()
    setSubmitting(false)
    if (!r.ok) { toast({ variant: "destructive", title: "Error", description: d.error }); return }
    toast({ title: "Announcement created" })
    setForm({ title: "", message: "", target_audience: "all", expires_at: "" })
    load()
  }

  async function del(id: string) {
    await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    })
    load()
  }

  async function toggle(id: string, is_active: boolean) {
    await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", id, is_active: !is_active }),
    })
    load()
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Announcements</h1>
        <p className="text-sm text-muted-foreground">Broadcast messages to users</p>
      </div>

      {missing && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
          The <code>announcements</code> table doesn't exist yet.{" "}
          <Link href="/admin/setup" className="underline font-medium">Run the migration →</Link>
        </div>
      )}

      <form onSubmit={submit} className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Plus className="h-4 w-4" />New Announcement</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Title</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Announcement title" className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Audience</label>
            <select value={form.target_audience} onChange={e => setForm(f => ({ ...f, target_audience: e.target.value }))} className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-sm focus:outline-none">
              <option value="all">All users</option>
              <option value="vendors">Vendors</option>
              <option value="buyers">Buyers</option>
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Message</label>
          <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} required rows={3} placeholder="Announcement body…" className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Expires at <span className="text-muted-foreground font-normal">(optional)</span></label>
          <input type="datetime-local" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} className="px-3 py-2.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
        </div>
        <button type="submit" disabled={submitting} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors text-sm">
          <Plus className="h-4 w-4" />{submitting ? "Creating…" : "Create Announcement"}
        </button>
      </form>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground">
          <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No announcements yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{item.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${item.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                      {item.is_active ? "Active" : "Inactive"}
                    </span>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full capitalize">{item.target_audience}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{item.message}</p>
                  {item.expires_at && <p className="text-xs text-muted-foreground mt-1">Expires {new Date(item.expires_at).toLocaleDateString()}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => toggle(item.id, item.is_active)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground">
                    {item.is_active ? <ToggleRight className="h-5 w-5 text-emerald-600" /> : <ToggleLeft className="h-5 w-5" />}
                  </button>
                  <button onClick={() => del(item.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
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
