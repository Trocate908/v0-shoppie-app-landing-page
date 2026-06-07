"use client"

import { useState } from "react"
import { Bell, Send } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [audience, setAudience] = useState("all")
  const [imageUrl, setImageUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ recipients: number } | null>(null)
  const { toast } = useToast()

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    const r = await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, message, audience, imageUrl: imageUrl || undefined }),
    })
    const d = await r.json()
    setLoading(false)
    if (!r.ok) { toast({ variant: "destructive", title: "Failed", description: d.error }); return }
    setResult(d)
    toast({ title: "Notification sent!", description: `Delivered to ${d.recipients} device(s)` })
    setTitle(""); setMessage(""); setImageUrl("")
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Push Notifications</h1>
        <p className="text-sm text-muted-foreground">Send a push notification via OneSignal</p>
      </div>

      <form onSubmit={send} className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Audience</label>
          <select
            value={audience}
            onChange={e => setAudience(e.target.value)}
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="all">All users</option>
            <option value="vendors">Vendors only</option>
            <option value="buyers">Buyers only</option>
            <option value="verified">Verified vendors</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            placeholder="Notification title"
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Message</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            required
            rows={4}
            placeholder="Write your message…"
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Image URL <span className="text-muted-foreground font-normal">(optional)</span></label>
          <input
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="https://…"
            type="url"
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Sending…" : <><Send className="h-4 w-4" />Send Notification</>}
        </button>
      </form>

      {result && (
        <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
          <Bell className="h-5 w-5 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800 dark:text-emerald-300">
            Sent successfully to <strong>{result.recipients}</strong> device(s)
          </p>
        </div>
      )}
    </div>
  )
}
