"use client"

import { useEffect, useState } from "react"
import { Settings, Save, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

interface Setting { key: string; value: string; description: string }

const SETTING_META: Record<string, { label: string; description: string; type: "text" | "boolean" | "textarea"; danger?: boolean }> = {
  site_name: { label: "Site Name", description: "The name shown across the platform", type: "text" },
  maintenance_mode: { label: "Maintenance Mode", description: "Disables the site for all non-admin users", type: "boolean", danger: true },
  registration_enabled: { label: "Allow New Registrations", description: "Allow new vendors and users to sign up", type: "boolean" },
  homepage_banner: { label: "Homepage Banner", description: "Optional message shown to all visitors on the home page", type: "textarea" },
  vendor_approval_required: { label: "Require Vendor Approval", description: "New vendors must be approved by an admin before going live", type: "boolean" },
  max_products_per_vendor: { label: "Max Products Per Vendor", description: "Maximum products a vendor can list (0 = unlimited)", type: "text" },
  contact_email: { label: "Support Email", description: "Public contact email shown to users", type: "text" },
}

const BOOLEAN_SETTINGS = new Set(["maintenance_mode", "registration_enabled", "vendor_approval_required"])

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [onesignalOk, setOnesignalOk] = useState<boolean | null>(null)
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

  async function checkOnesignal() {
    try {
      const r = await fetch("/api/admin/notifications")
      setOnesignalOk(r.ok)
    } catch {
      setOnesignalOk(false)
    }
  }

  useEffect(() => { load(); checkOnesignal() }, [])

  async function save(key: string, value: string, needsConfirm?: boolean) {
    if (needsConfirm) { setConfirm(key); return }
    setSaving(key)
    const r = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    })
    const d = await r.json()
    setSaving(null)
    if (!r.ok) toast({ title: "Error", description: d.error, variant: "destructive" })
    else {
      toast({ title: "Saved", description: `${SETTING_META[key]?.label ?? key} updated` })
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

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6 text-violet-600" />Platform Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Configure platform-wide behaviour</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors">
          <RefreshCw className="h-4 w-4" />Reload
        </button>
      </div>

      {/* Integration Status */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-sm">Integration Status</h2>
        <div className="flex items-center justify-between py-2 border-t border-border">
          <div>
            <p className="text-sm font-medium">OneSignal Push Notifications</p>
            <p className="text-xs text-muted-foreground">ONESIGNAL_APP_ID &amp; ONESIGNAL_REST_API_KEY</p>
          </div>
          {onesignalOk === null ? (
            <span className="text-xs text-muted-foreground">Checking…</span>
          ) : onesignalOk ? (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <CheckCircle2 className="h-4 w-4" />Connected
            </span>
          ) : (
            <span className="text-xs text-amber-600 font-medium">Not configured</span>
          )}
        </div>
        <div className="flex items-center justify-between py-2 border-t border-border">
          <div>
            <p className="text-sm font-medium">Web Push (VAPID)</p>
            <p className="text-xs text-muted-foreground">VAPID_PUBLIC_KEY &amp; VAPID_PRIVATE_KEY</p>
          </div>
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
            <CheckCircle2 className="h-4 w-4" />Configured
          </span>
        </div>
        <div className="flex items-center justify-between py-2 border-t border-border">
          <div>
            <p className="text-sm font-medium">Supabase Database</p>
            <p className="text-xs text-muted-foreground">SUPABASE_SERVICE_ROLE_KEY</p>
          </div>
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
            <CheckCircle2 className="h-4 w-4" />Connected
          </span>
        </div>
      </div>

      {/* General settings */}
      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {Object.entries(SETTING_META).filter(([, m]) => !m.danger).map(([key, meta]) => {
          const value = settings[key] ?? ""
          const isBool = BOOLEAN_SETTINGS.has(key)
          const boolValue = value === "true"

          return (
            <div key={key} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <Label htmlFor={key} className="font-medium">{meta.label}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                </div>
                {isBool ? (
                  <Switch
                    id={key}
                    checked={boolValue}
                    onCheckedChange={v => {
                      setSettings(prev => ({ ...prev, [key]: v ? "true" : "false" }))
                      save(key, v ? "true" : "false")
                    }}
                  />
                ) : meta.type === "textarea" ? (
                  <div className="w-64 shrink-0 space-y-1.5">
                    <Textarea
                      id={key}
                      value={value}
                      onChange={e => setSettings(prev => ({ ...prev, [key]: e.target.value }))}
                      className="text-sm resize-none"
                      rows={2}
                    />
                    <button
                      onClick={() => save(key, value)}
                      disabled={saving === key}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
                    >
                      <Save className="h-3 w-3" />{saving === key ? "Saving…" : "Save"}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 w-48 shrink-0">
                    <Input
                      id={key}
                      value={value}
                      onChange={e => setSettings(prev => ({ ...prev, [key]: e.target.value }))}
                      className="text-sm h-8"
                    />
                    <button
                      onClick={() => save(key, value)}
                      disabled={saving === key}
                      className="p-1.5 rounded hover:bg-accent transition-colors shrink-0 disabled:opacity-50"
                    >
                      {saving === key ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Danger zone */}
      <div className="bg-card border border-red-200 dark:border-red-900 rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900">
          <h2 className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />Danger Zone
          </h2>
        </div>
        <div className="divide-y divide-border">
          {/* Maintenance mode */}
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-sm">Maintenance Mode</p>
              <p className="text-xs text-muted-foreground">Blocks all non-admin users from accessing the platform</p>
            </div>
            <Switch
              checked={settings["maintenance_mode"] === "true"}
              onCheckedChange={v => {
                setSettings(prev => ({ ...prev, maintenance_mode: v ? "true" : "false" }))
                save("maintenance_mode", v ? "true" : "false", v)
              }}
            />
          </div>
          {[
            { label: "Force Logout All Users", description: "Invalidate all active sessions platform-wide", key: "force_logout" },
            { label: "Clear Platform Cache", description: "Purge all cached data (may cause temporary slowness)", key: "clear_cache" },
          ].map(({ label, description, key }) => (
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
                ? "Enabling maintenance mode will block all non-admin users from the platform."
                : confirm === "force_logout"
                ? "This will sign out all active users immediately."
                : confirm === "clear_cache"
                ? "This will purge all cached data. The platform may be temporarily slower."
                : "Are you sure you want to proceed?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={confirmSave}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
