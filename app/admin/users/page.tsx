"use client"

import { useEffect, useState } from "react"
import { Search, Shield, Ban, Trash2, RefreshCw, CheckCircle, MoreVertical, Download } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface User {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  email_confirmed_at: string | null
  banned_until: string | null
  is_admin: boolean
  vendor: { shop_name: string; is_verified: boolean } | null
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [filtered, setFiltered] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [confirm, setConfirm] = useState<{ action: string; userId: string; label: string } | null>(null)
  const { toast } = useToast()

  async function load() {
    setLoading(true)
    const r = await fetch("/api/admin/users")
    const d = await r.json()
    setUsers(d.users ?? [])
    setFiltered(d.users ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    let result = users
    if (query) {
      const q = query.toLowerCase()
      result = result.filter(u =>
        u.email?.toLowerCase().includes(q) || u.vendor?.shop_name?.toLowerCase().includes(q)
      )
    }
    if (roleFilter === "vendors") result = result.filter(u => u.vendor)
    if (roleFilter === "admins") result = result.filter(u => u.is_admin)
    if (roleFilter === "regular") result = result.filter(u => !u.vendor && !u.is_admin)
    if (statusFilter === "banned") result = result.filter(u => isBanned(u))
    if (statusFilter === "unverified") result = result.filter(u => !u.email_confirmed_at)
    if (statusFilter === "active") result = result.filter(u => !isBanned(u) && !!u.email_confirmed_at)
    setFiltered(result)
  }, [query, roleFilter, statusFilter, users])

  async function doAction(action: string, userId: string) {
    const r = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, userId }),
    })
    const d = await r.json()
    if (!r.ok) {
      toast({ title: "Error", description: d.error, variant: "destructive" })
    } else {
      toast({ title: "Done", description: `Action "${action}" completed` })
      load()
    }
    setConfirm(null)
  }

  function exportCsv() {
    const rows = [
      ["Email", "Joined", "Last Login", "Status", "Shop", "Admin"],
      ...filtered.map(u => [
        u.email,
        new Date(u.created_at).toLocaleDateString(),
        u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "Never",
        isBanned(u) ? "Banned" : u.email_confirmed_at ? "Active" : "Unverified",
        u.vendor?.shop_name ?? "",
        u.is_admin ? "Yes" : "No",
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const isBanned = (u: User) => u.banned_until && new Date(u.banned_until) > new Date()

  const statsBar = [
    { label: "Total", value: users.length, color: "text-blue-600" },
    { label: "Vendors", value: users.filter(u => u.vendor).length, color: "text-green-600" },
    { label: "Banned", value: users.filter(u => isBanned(u)).length, color: "text-red-600" },
    { label: "Unverified", value: users.filter(u => !u.email_confirmed_at).length, color: "text-amber-600" },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <div className="flex gap-4 mt-1">
            {statsBar.map(s => (
              <span key={s.label} className="text-xs text-muted-foreground">
                {s.label}: <span className={`font-semibold ${s.color}`}>{s.value}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors">
            <Download className="h-4 w-4" />Export CSV
          </button>
          <button onClick={load} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by email or shop…" className="pl-9" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="vendors">Vendors</SelectItem>
            <SelectItem value="admins">Admins</SelectItem>
            <SelectItem value="regular">Regular Users</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="unverified">Unverified</SelectItem>
            <SelectItem value="banned">Banned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} user{filtered.length !== 1 ? "s" : ""} shown</p>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Shop</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Joined</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Last Login</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No users found</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium truncate max-w-[200px]">{u.email}</div>
                    <div className="flex gap-1 mt-0.5">
                      {u.is_admin && <Badge variant="secondary" className="text-xs">Admin</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                    {u.vendor ? (
                      <span className="flex items-center gap-1">
                        {u.vendor.shop_name}
                        {u.vendor.is_verified && <CheckCircle className="h-3 w-3 text-green-500" />}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    {isBanned(u) ? (
                      <Badge variant="destructive">Banned</Badge>
                    ) : u.email_confirmed_at ? (
                      <Badge variant="outline" className="text-green-600 border-green-200">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-200">Unverified</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!u.is_admin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="p-1.5 rounded hover:bg-accent">
                          <MoreVertical className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!u.email_confirmed_at && (
                            <DropdownMenuItem onClick={() => setConfirm({ action: "verify_email", userId: u.id, label: "Verify email for this user?" })}>
                              <CheckCircle className="h-4 w-4 mr-2 text-green-500" />Verify Email
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setConfirm({ action: "reset_password", userId: u.id, label: "Send password reset email to this user?" })}>
                            <RefreshCw className="h-4 w-4 mr-2 text-blue-500" />Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {isBanned(u) ? (
                            <DropdownMenuItem onClick={() => setConfirm({ action: "unban", userId: u.id, label: "Unban this user? They will regain access." })}>
                              <Shield className="h-4 w-4 mr-2 text-green-500" />Unban User
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => setConfirm({ action: "ban", userId: u.id, label: "Ban this user? They will not be able to log in." })}>
                              <Ban className="h-4 w-4 mr-2 text-orange-500" />Ban User
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setConfirm({ action: "delete", userId: u.id, label: "Permanently delete this account? This cannot be undone." })}>
                            <Trash2 className="h-4 w-4 mr-2" />Delete Account
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={() => setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.label}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirm && doAction(confirm.action, confirm.userId)}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
