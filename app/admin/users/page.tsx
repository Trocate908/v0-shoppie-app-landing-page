"use client"

import { useEffect, useState } from "react"
import { Search, Ban, CheckCircle, Trash2, ShieldCheck } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface User {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  is_banned: boolean | null
  created_at: string
  phone: string | null
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  function load() {
    fetch("/api/admin/users").then(r => r.json()).then(d => {
      setUsers(d.users ?? [])
      setLoading(false)
    })
  }

  useEffect(load, [])

  async function action(userId: string, act: string) {
    const r = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: act, userId }),
    })
    const d = await r.json()
    if (!r.ok) { toast({ variant: "destructive", title: "Error", description: d.error }); return }
    toast({ title: "Done", description: `User ${act}ned successfully` })
    load()
  }

  const filtered = users.filter(u =>
    (u.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (u.full_name ?? "").toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-sm text-muted-foreground">{users.length} total users</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg bg-card text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {filtered.map(u => (
            <div key={u.id} className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{u.full_name || u.email}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email} · {new Date(u.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {u.is_banned ? (
                  <span className="text-xs bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 px-2 py-0.5 rounded-full">Banned</span>
                ) : (
                  <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 px-2 py-0.5 rounded-full">Active</span>
                )}
                <button
                  onClick={() => action(u.id, u.is_banned ? "unban" : "ban")}
                  title={u.is_banned ? "Unban" : "Ban"}
                  className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"
                >
                  {u.is_banned ? <CheckCircle className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => action(u.id, "delete")}
                  title="Delete"
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">No users found</p>
          )}
        </div>
      )}
    </div>
  )
}
