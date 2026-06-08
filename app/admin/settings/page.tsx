"use client"

import { useEffect, useState } from "react"
import { Settings, Save, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

interface Setting { key: string; value: string; description: string }

const SETTING_LABELS: Record<string, string> = {
  site_name: "Site Name",
  maintenance_mode: "Maintenance Mode",
  registration_enabled: "Allow New Registrations",
  homepage_banner: "Homepage Banner Message",
  vendor_approval_required: "Require Vendor Approval",
}

const BOOLEAN_SETTINGS = new Set(["maintenance_mode", "registration_enabled", "vendor_approval_required"])

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  const { toast } = useToast()

  async function load() {
    setLoading(true)
    const r = await fetch("/api/admin/settings")
    const d = await r.json()
    if (d.settings) {
      const map: Record<string, string> = {}
      d.settings.forEach((s: Setting) => { map[s.key] = s.value })
      setSettings(map)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save(key: string, value: string, needsConfirm?: boolean) {
    if (needsConfirm) { setConfirm(key); return }
    setSaving(true)
    const r = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    })
    const d = await r.json()
    setSaving(false)
    if (!r.ok) toast({ title: "Error", description: d.error, variant: "destructive" })
    else {
      toast({ title: "Saved", description: `${SETTING_LABELS[key] ?? key} updated` })
      setSettings(prev => ({ ...prev, [key]: value }))
    }
  }

  async function confirmSave() {
    if (!confirm) return
    const key = confirm
    setConfirm(null)
    await save(key, settings[key], false)
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <div className="h-8 bg-muted rounded animate-pulse w-48" />
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
      </div>
    )
  }

  const dangerActions = [
    { label: "Force Logout All Users", description: "Invalidate all active sessions platform-wide", key: "force_logout" },
    { label: "Clear Platform Cache", description: "Purge all cached data (may cause temporary slowness)", key: "clear_cache" },
  ]

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6 text-violet-600" />
          Platform Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Configure platform-wide settings</p>
      </div>

      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {Object.entries(SETTING_LABELS).map(([key, label]) => {
          const value = settings[key] ?? ""
          const isBool = BOOLEAN_SETTINGS.has(key)
          const boolValue = value === "true"
          const isDangerous = key === "maintenance_mode"

          return (
            <div key={key} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Label htmlFor={key} className="font-medium">{label}</Label>
                  {isDangerous && <span className="text-xs text-red-500 font-medium">⚠ Caution</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {key === "site_name" && "The name shown across the platform"}
                  {key === "maintenance_mode" && "Disables the site for all non-admin users"}
                  {key === "registration_enabled" && "Allow new vendors and users to sign up"}
                  {key === "homepage_banner" && "Optional banner shown to all visitors"}
                  {key === "vendor_approval_required" && "New vendors must be approved by an admin"}
                </p>
              </div>
              {isBool ? (
                <Switch
                  id={key}
                  checked={boolValue}
                  onCheckedChange={v => {
                    setSettings(prev => ({ ...prev, [key]: v ? "true" : "false" }))
                    save(key, v ? "true" : "false", isDangerous && v)
                  }}
                />
              ) : (
                <div className="flex items-center gap-2 w-56 shrink-0">
                  <Input
                    id={key}
                    value={value}
                    onChange={e => setSettings(prev => ({ ...prev, [key]: e.target.value }))}
                    className="text-sm h-8"
                  />
                  <button
                    onClick={() => save(key, value)}
                    disabled={saving}
                    className="p-1.5 rounded hover:bg-accent transition-colors shrink-0"
                  >
                    <Save className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="bg-card border border-red-200 dark:border-red-900 rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900">
          <h2 className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />Danger Zone
          </h2>
        </div>
        <div className="divide-y divide-border">
          {dangerActions.map(({ label, description, key }) => (
            <div key={key} className="px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <button
                onClick={() => setConfirm(key)}
                className="text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
              >
                Execute
              </button>
            </div>
          ))}
        </div>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={() => setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "maintenance_mode"
                ? "Enabling maintenance mode will block all non-admin users from accessing the platform. Are you sure?"
                : confirm === "force_logout"
                ? "This will sign out all active users immediately. They'll need to log in again."
                : confirm === "clear_cache"
                ? "This will purge all cached data. The platform may be slower temporarily."
                : "Are you sure you want to proceed?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={confirmSave}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
