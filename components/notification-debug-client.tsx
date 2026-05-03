"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useOneSignal } from "@/hooks/use-onesignal"
import { ArrowLeft, CheckCircle2, XCircle, AlertCircle, RefreshCw, Bell, Send, ExternalLink } from "lucide-react"
import Link from "next/link"

type CheckItem = {
  label: string
  status: "ok" | "warn" | "fail" | "pending"
  detail?: string
}

export default function NotificationDebugClient() {
  const { status, enable } = useOneSignal()
  const [checks, setChecks]   = useState<CheckItem[]>([])
  const [busy, setBusy]       = useState(false)
  const [testJson, setTestJson] = useState<string | null>(null)
  const [log, setLog]         = useState<string[]>([])

  const appendLog = useCallback((line: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${line}`, ...prev].slice(0, 60))
  }, [])

  const runChecks = useCallback(async () => {
    const next: CheckItem[] = []

    // 1. Browser support
    const supported =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator
    next.push({
      label: "Browser supports notifications",
      status: supported ? "ok" : "fail",
      detail: supported
        ? navigator.userAgent.split(") ").pop()?.slice(0, 60) ?? "supported"
        : "This browser does not support Notifications or Service Workers. Use Chrome, Edge, or Firefox on desktop/Android.",
    })

    // 2. OneSignal App ID configured
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
    next.push({
      label: "OneSignal App ID configured",
      status: appId ? "ok" : "fail",
      detail: appId
        ? `App ID: ${appId.slice(0, 8)}…`
        : "NEXT_PUBLIC_ONESIGNAL_APP_ID is not set. Follow the setup steps below.",
    })

    // 3. Notification permission
    if (typeof window !== "undefined" && "Notification" in window) {
      const perm = Notification.permission
      next.push({
        label: `Notification permission: ${perm}`,
        status: perm === "granted" ? "ok" : perm === "denied" ? "fail" : "warn",
        detail:
          perm === "denied"
            ? "BLOCKED — open browser site settings, allow notifications, then reload."
            : perm === "default"
              ? "Not asked yet. Click 'Enable notifications' below."
              : "Granted ✓",
      })
    }

    // 4. OneSignal hook status
    next.push({
      label: `OneSignal SDK status: ${status}`,
      status:
        status === "granted" ? "ok" :
        status === "denied"  ? "fail" :
        status === "not_configured" ? "fail" :
        status === "unsupported" ? "fail" : "warn",
      detail:
        status === "not_configured"
          ? "OneSignal App ID not set — SDK will not load."
          : status === "unsupported"
            ? "This device/browser does not support web push."
            : status === "granted"
              ? "Subscribed and ready to receive pushes."
              : status === "idle"
                ? "Waiting for user to enable notifications."
                : undefined,
    })

    // 5. Server-side config
    try {
      const res  = await fetch("/api/notifications/test", { cache: "no-store" })
      const json = await res.json()
      if (json.ok) {
        next.push({
          label: "Server push pipeline",
          status: "ok",
          detail: `Dispatched — pushed=${json.dispatch?.pushed ?? "?"} persisted=${json.dispatch?.persisted ?? "?"}`,
        })
      } else {
        next.push({
          label: "Server push pipeline",
          status: json.reason?.includes("not configured") ? "fail" : "warn",
          detail: json.reason ?? "Unknown error",
        })
        if (Array.isArray(json.hints)) {
          for (const hint of json.hints as string[]) {
            next.push({ label: "Config hint", status: "warn", detail: hint })
          }
        }
      }
    } catch (err) {
      next.push({ label: "Backend reachable", status: "fail", detail: (err as Error).message })
    }

    setChecks(next)
  }, [status])

  useEffect(() => { runChecks() }, [runChecks])

  const handleEnable = useCallback(async () => {
    setBusy(true)
    appendLog("Requesting notification permission via OneSignal…")
    const ok = await enable()
    appendLog(ok ? "Permission granted ✓ OneSignal is now tracking this device." : "Permission denied or failed.")
    await runChecks()
    setBusy(false)
  }, [enable, appendLog, runChecks])

  const handleTestPush = useCallback(async () => {
    setBusy(true)
    setTestJson(null)
    appendLog("Calling /api/notifications/test …")
    try {
      const res  = await fetch("/api/notifications/test", { cache: "no-store" })
      const text = await res.text()
      setTestJson(text)
      appendLog("Done — see JSON below.")
    } catch (err) {
      appendLog(`Failed: ${(err as Error).message}`)
    }
    setBusy(false)
  }, [appendLog])

  const handleReset = useCallback(async () => {
    setBusy(true)
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        for (const r of regs) await r.unregister()
        appendLog(`Unregistered ${regs.length} service worker(s). Reload the page.`)
      }
      try {
        localStorage.removeItem("shoppie:os-prompt-dismissed-v1")
      } catch {}
      appendLog("Cleared prompt dismissed marker. Reload to re-show the prompt.")
    } catch (err) {
      appendLog(`Reset failed: ${(err as Error).message}`)
    }
    setBusy(false)
  }, [appendLog])

  return (
    <main className="min-h-svh bg-background text-foreground pb-24">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link href="/notifications" aria-label="Back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-base font-semibold leading-tight">Notification diagnostics</h1>
            <p className="text-xs text-muted-foreground">Powered by OneSignal</p>
          </div>
          <Button size="sm" variant="outline" className="ml-auto" onClick={runChecks} disabled={busy}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </header>

      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-4">

        {/* Setup guide */}
        <Card className="overflow-hidden">
          <div className="border-b border-border bg-muted/40 px-4 py-2">
            <h2 className="text-sm font-semibold">OneSignal setup (do this once)</h2>
          </div>
          <ol className="list-decimal space-y-2 p-4 pl-8 text-sm leading-relaxed text-muted-foreground">
            <li>
              Go to{" "}
              <a href="https://onesignal.com" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary underline">
                onesignal.com <ExternalLink className="h-3 w-3" />
              </a>{" "}
              → Create a free account → <strong>New App</strong> → <strong>Web Push</strong>.
            </li>
            <li>
              Enter your site URL: <code className="rounded bg-muted px-1 text-xs font-mono text-foreground">https://shoppieapp.co.zw</code>
            </li>
            <li>
              Set <strong>Service Worker</strong> path to{" "}
              <code className="rounded bg-muted px-1 text-xs font-mono text-foreground">/OneSignalSDKWorker.js</code>
            </li>
            <li>
              Copy your <strong>App ID</strong> → set as Replit Secret{" "}
              <code className="rounded bg-muted px-1 text-xs font-mono text-foreground">NEXT_PUBLIC_ONESIGNAL_APP_ID</code>
              {" "}(same value) and{" "}
              <code className="rounded bg-muted px-1 text-xs font-mono text-foreground">ONESIGNAL_APP_ID</code>
            </li>
            <li>
              Go to <strong>Settings → Keys &amp; IDs</strong> → copy <strong>REST API Key</strong> → set as{" "}
              <code className="rounded bg-muted px-1 text-xs font-mono text-foreground">ONESIGNAL_REST_API_KEY</code>
            </li>
            <li>Restart the app, then come back here and run the tests below.</li>
          </ol>
        </Card>

        {/* Status checks */}
        <Card className="overflow-hidden">
          <div className="border-b border-border bg-muted/40 px-4 py-2">
            <h2 className="text-sm font-semibold">System status</h2>
          </div>
          <ul className="divide-y divide-border">
            {checks.length === 0 && (
              <li className="px-4 py-4 text-sm text-muted-foreground">Running checks…</li>
            )}
            {checks.map((c, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 shrink-0">
                  {c.status === "ok"   && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                  {c.status === "fail" && <XCircle      className="h-5 w-5 text-destructive" />}
                  {c.status === "warn" && <AlertCircle  className="h-5 w-5 text-amber-600" />}
                  {c.status === "pending" && <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-snug">{c.label}</div>
                  {c.detail && <div className="mt-0.5 break-words text-xs text-muted-foreground">{c.detail}</div>}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Action buttons */}
        <Card className="overflow-hidden">
          <div className="border-b border-border bg-muted/40 px-4 py-2">
            <h2 className="text-sm font-semibold">Run tests in this order</h2>
          </div>
          <div className="flex flex-col gap-2 p-4">
            <Button size="lg" className="justify-start" onClick={handleEnable} disabled={busy}>
              <Bell className="mr-2 h-4 w-4" />
              1. Enable notifications (allow the browser prompt)
            </Button>
            <Button size="lg" variant="secondary" className="justify-start" onClick={handleTestPush} disabled={busy}>
              <Send className="mr-2 h-4 w-4" />
              2. Send test push from server (full pipeline)
            </Button>
            <Button size="sm" variant="ghost" className="mt-2 justify-start text-muted-foreground"
              onClick={handleReset} disabled={busy}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Reset (unregister SWs, clear prompt cache)
            </Button>
          </div>
        </Card>

        {/* Test JSON */}
        {testJson && (
          <Card className="overflow-hidden">
            <div className="border-b border-border bg-muted/40 px-4 py-2">
              <h2 className="text-sm font-semibold">Server response</h2>
            </div>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words p-4 text-[11px] leading-relaxed">
              {(() => { try { return JSON.stringify(JSON.parse(testJson), null, 2) } catch { return testJson } })()}
            </pre>
          </Card>
        )}

        {/* Log */}
        <Card className="overflow-hidden">
          <div className="border-b border-border bg-muted/40 px-4 py-2">
            <h2 className="text-sm font-semibold">Activity log</h2>
          </div>
          <ul className="divide-y divide-border text-[11px] leading-relaxed">
            {log.length === 0 && (
              <li className="px-4 py-3 text-muted-foreground">No actions yet.</li>
            )}
            {log.map((line, i) => (
              <li key={i} className="px-4 py-2 font-mono">{line}</li>
            ))}
          </ul>
        </Card>

        {/* Help text */}
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Troubleshooting tips:</strong>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Push only works on the <strong>real site URL</strong> (not the Replit preview iframe). Open the app in a new browser tab.</li>
            <li>iOS requires the app to be <strong>installed to the home screen</strong> as a PWA before push works.</li>
            <li>If <strong>pushed=0</strong> after enabling, make sure you opened the app in your real browser and allowed the prompt there.</li>
            <li>To test end-to-end: log in as Vendor on Device A, send a message as Buyer on Device B. Vendor&apos;s Device A should get a push.</li>
          </ul>
        </div>

      </div>
    </main>
  )
}
