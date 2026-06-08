"use client"

import { useEffect, useState } from "react"
import { Search, Shield, Ban, Trash2, RefreshCw, CheckCircle, MoreVertical } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

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
    const q = query.toLowerCase()
    setFiltered(q ? users.filter(u => u.email?.toLowerCase().includes(q) || u.vendor?.shop_name?.toLowerCase().includes(q)) : users)
  }, [query, users])

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

  const isBanned = (u: User) => u.banned_until && new Date(u.banned_until) > new Date()

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground text-sm">{users.length} total users</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by email or shop…" className="pl-9" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
      </div>

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
                    {u.is_admin && <Badge variant="secondary" className="text-xs mt-0.5">Admin</Badge>}
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
                          <DropdownMenuItem onClick={() => setConfirm({ action: "reset_password", userId: u.id, label: "Send password reset email?" })}>
                            <RefreshCw className="h-4 w-4 mr-2 text-blue-500" />Reset Password
                          </DropdownMenuItem>
                          {isBanned(u) ? (
                            <DropdownMenuItem onClick={() => setConfirm({ action: "unban", userId: u.id, label: "Unban this user?" })}>
                              <Shield className="h-4 w-4 mr-2 text-green-500" />Unban
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => setConfirm({ action: "ban", userId: u.id, label: "Ban this user? They won't be able to log in." })}>
                              <Ban className="h-4 w-4 mr-2 text-orange-500" />Ban User
                            </DropdownMenuItem>
                          )}
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
