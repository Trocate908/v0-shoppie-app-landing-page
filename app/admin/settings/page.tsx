"use client"

import { useEffect, useState } from "react"
import { Save, Database } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

interface Setting { key: string; value: string; description: string | null }

const SETTING_LABELS: Record<string, { label: string; type: "text" | "toggle"; description: string }> = {
  site_name: { label: "Site Name", type: "text", description: "Platform display name shown across the app" },
  maintenance_mode: { label: "Maintenance Mode", type: "toggle", description: "Take the site offline for all users" },
  registration_enabled: { label: "New Registrations", type: "toggle", description: "Allow new vendor sign-ups" },
  homepage_banner: { label: "Homepage Banner", type: "text", description: "Announcement bar shown at the top of the store (leave empty to hide)" },
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetch("/api/admin/settings").then(r => r.json()).then(d => {
      if (d.settings?.length === 0 && !d.error) setMissing(true)
      const s: Setting[] = d.settings ?? []
      setSettings(s)
      const v: Record<string, string> = {}
      for (const item of s) v[item.key] = item.value
      setValues(v)
    })
  }, [])

  async function save(key: string) {
    setSaving(key)
    const r = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: values[key] ?? "" }),
    })
    const d = await r.json()
    setSaving(null)
    if (!r.ok) { toast({ variant: "destructive", title: "Error", description: d.error }); return }
    toast({ title: "Saved" })
  }

  const knownKeys = Object.keys(SETTING_LABELS)
  const unknownSettings = settings.filter(s => !knownKeys.includes(s.key))

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Control core platform behaviour</p>
      </div>

      {missing && (
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <Database className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            The <code>platform_settings</code> table doesn't exist yet.{" "}
            <Link href="/admin/setup" className="underline font-medium">Run the migration →</Link>
          </p>
        </div>
      )}

      <div className="space-y-4">
        {knownKeys.map(key => {
          const meta = SETTING_LABELS[key]
          const val = values[key] ?? ""
          return (
            <div key={key} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{meta.label}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{meta.description}</p>
                  {meta.type === "text" && (
                    <input
                      value={val}
                      onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
                      className="mt-3 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  )}
                </div>
                {meta.type === "toggle" ? (
                  <button
                    onClick={() => {
                      const next = val === "true" ? "false" : "true"
                      setValues(v => ({ ...v, [key]: next }))
                      setTimeout(() => save(key), 50)
                    }}
                    className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${val === "true" ? "bg-violet-600" : "bg-muted"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${val === "true" ? "translate-x-5" : ""}`} />
                  </button>
                ) : (
                  <button
                    onClick={() => save(key)}
                    disabled={saving === key}
                    className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors shrink-0"
                  >
                    <Save className="h-4 w-4" />{saving === key ? "Saving…" : "Save"}
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {unknownSettings.map(s => (
          <div key={s.key} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium font-mono text-sm">{s.key}</p>
                {s.description && <p className="text-sm text-muted-foreground mt-0.5">{s.description}</p>}
                <input
                  value={values[s.key] ?? ""}
                  onChange={e => setValues(v => ({ ...v, [s.key]: e.target.value }))}
                  className="mt-3 w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <button
                onClick={() => save(s.key)}
                disabled={saving === s.key}
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors shrink-0"
              >
                <Save className="h-4 w-4" />{saving === s.key ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
