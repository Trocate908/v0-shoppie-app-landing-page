"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useFcm } from "@/hooks/use-fcm"
import { ArrowLeft, CheckCircle2, XCircle, AlertCircle, RefreshCw, Bell, Send, Volume2, KeyRound, Copy, Check } from "lucide-react"
import Link from "next/link"

type Check = {
  label: string
  status: "ok" | "warn" | "fail" | "pending"
  detail?: string
}

/**
 * /notifications/debug — hands-on diagnostic. Run each test, in order,
 * to localise where push notifications are failing.
 */
export default function NotificationDebugClient() {
  const { status, enable, token } = useFcm()
  const [checks, setChecks] = useState<Check[]>([])
  const [busy, setBusy] = useState(false)
  const [testJson, setTestJson] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [vapidEnvBlock, setVapidEnvBlock] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const appendLog = useCallback((line: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${line}`, ...prev].slice(0, 60))
  }, [])

  const runChecks = useCallback(async () => {
    const next: Check[] = []

    // 1. Browser support
    const supported =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    next.push({
      label: "Browser supports web push",
      status: supported ? "ok" : "fail",
      detail: supported
        ? `${navigator.userAgent.split(") ").pop()?.slice(0, 60) ?? "unknown UA"}`
        : "This browser does not support Notification + ServiceWorker + PushManager. Try Chrome on Android or desktop Chrome/Edge/Firefox.",
    })

    // 2. Notification permission
    if (typeof window !== "undefined" && "Notification" in window) {
      const perm = Notification.permission
      next.push({
        label: `Notification permission: ${perm}`,
        status: perm === "granted" ? "ok" : perm === "denied" ? "fail" : "warn",
        detail:
          perm === "denied"
            ? "Permission was BLOCKED. Open browser site settings, allow notifications for this site, then reload."
            : perm === "default"
              ? "Not yet asked. Tap the 'Enable notifications' button below."
              : "Granted",
      })
    }

    // 3. Service worker + push subscription
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration("/")
      if (reg) {
        const swActive = reg.active ? "active" : reg.waiting ? "waiting" : reg.installing ? "installing" : "unknown"
        next.push({
          label: "Service worker",
          status: reg.active ? "ok" : "warn",
          detail: `state: ${swActive} • script: ${reg.active?.scriptURL ?? "n/a"}`,
        })
        const sub = await reg.pushManager.getSubscription().catch(() => null)
        next.push({
          label: "Push subscription on this device",
          status: sub ? "ok" : "warn",
          detail: sub
            ? `endpoint: …${sub.endpoint.slice(-32)}`
            : "Not subscribed yet. Tap 'Enable notifications' below.",
        })
      } else {
        next.push({
          label: "Service worker",
          status: "warn",
          detail: "Not registered yet. Tap 'Enable notifications' to register.",
        })
      }
    }

    // 4. Push token registered with our backend
    try {
      const res = await fetch("/api/notifications/test", { cache: "no-store" })
      if (res.ok) {
        const json = await res.json()
        if (json.ok === false && json.reason?.includes("Not logged in")) {
          next.push({
            label: "Logged in",
            status: "fail",
            detail: "You must be signed in for cross-account push tests to work.",
          })
        } else if (json.ok === false && json.reason?.includes("No push subscription")) {
          next.push({
            label: "Push subscription registered with backend",
            status: "fail",
            detail: "No subscription in push_tokens for this user. Tap 'Enable notifications' below.",
          })
        } else if (json.ok === true) {
          next.push({
            label: "Push subscription registered with backend",
            status: "ok",
            detail: `${json.tokenCount} subscription(s) on file. dispatch result: pushed=${json.dispatch?.pushed ?? "?"} persisted=${json.dispatch?.persisted ?? "?"}`,
          })
        }
        if (Array.isArray(json.hints)) {
          for (const hint of json.hints) {
            next.push({ label: "Server config", status: "warn", detail: hint })
          }
        }
      }
    } catch (err) {
      next.push({
        label: "Backend reachable",
        status: "fail",
        detail: `${(err as Error).message ?? err}`,
      })
    }

    setChecks(next)
  }, [])

  useEffect(() => {
    runChecks()
  }, [runChecks])

  // Handle the user enabling notifications.
  const handleEnable = useCallback(async () => {
    setBusy(true)
    appendLog("Requesting permission + FCM token...")
    const ok = await enable()
    appendLog(ok ? "Permission granted, token registered." : "Failed to enable. Check the checks above.")
    await runChecks()
    setBusy(false)
  }, [enable, appendLog, runChecks])

  // Show a LOCAL notification (no FCM) — proves SW + permission work.
  const handleLocalNotification = useCallback(async () => {
    setBusy(true)
    try {
      if (Notification.permission !== "granted") {
        appendLog("Permission is not granted. Tap 'Enable notifications' first.")
        setBusy(false)
        return
      }
      const reg =
        (await navigator.serviceWorker.getRegistration("/")) ??
        (await navigator.serviceWorker.ready)
      if (!reg) {
        appendLog("No service worker available. Hard-reload the page and try again.")
        setBusy(false)
        return
      }
      await reg.showNotification("Local test notification", {
        body: "If you can see this, the service worker + permissions work. Now test the FCM push.",
        icon: "/logo.png",
        badge: "/logo.png",
        tag: `shoppie-local-${Date.now()}`,
        requireInteraction: true,
        renotify: true,
        vibrate: [200, 100, 200, 100, 200],
        data: { link: "/notifications/debug" },
      } as NotificationOptions)
      appendLog("showNotification() called locally — check your notification tray.")
    } catch (err) {
      appendLog(`Local notification failed: ${(err as Error).message ?? err}`)
    }
    setBusy(false)
  }, [appendLog])

  // Trigger an FCM push from the server back to ourselves.
  const handleTestPush = useCallback(async () => {
    setBusy(true)
    setTestJson(null)
    appendLog("Triggering /api/notifications/test ...")
    try {
      const res = await fetch("/api/notifications/test", { cache: "no-store" })
      const text = await res.text()
      setTestJson(text)
      appendLog("Test push request finished — see JSON below.")
    } catch (err) {
      appendLog(`Test push failed: ${(err as Error).message ?? err}`)
    }
    setBusy(false)
  }, [appendLog])

  // Mint a fresh VAPID keypair so the user can paste them into env vars.
  const handleGenerateVapid = useCallback(async () => {
    setBusy(true)
    appendLog("Requesting fresh VAPID keys from /api/push/generate-vapid ...")
    try {
      const res = await fetch("/api/push/generate-vapid", { cache: "no-store" })
      if (!res.ok) {
        appendLog(`Failed: HTTP ${res.status}`)
      } else {
        const json = await res.json()
        setVapidEnvBlock(json.envBlock ?? null)
        appendLog("Got fresh VAPID keys. Copy the env block, paste into Vars panel, then refresh.")
      }
    } catch (err) {
      appendLog(`Generate VAPID failed: ${(err as Error).message ?? err}`)
    }
    setBusy(false)
  }, [appendLog])

  const handleCopyEnv = useCallback(async () => {
    if (!vapidEnvBlock) return
    try {
      await navigator.clipboard.writeText(vapidEnvBlock)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      appendLog(`Copy failed: ${(err as Error).message ?? err}`)
    }
  }, [vapidEnvBlock, appendLog])

  // Unregister all SWs and clear the push subscription (clean slate).
  const handleReset = useCallback(async () => {
    setBusy(true)
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        for (const r of regs) await r.unregister()
        appendLog(`Unregistered ${regs.length} service worker(s).`)
      }
      try {
        localStorage.removeItem("shoppie:notif-registered-at")
        localStorage.removeItem("shoppie:notif-soft-prompt")
      } catch {}
      appendLog("Cleared local registration markers. Now hard-reload (pull to refresh) and tap 'Enable notifications' again.")
    } catch (err) {
      appendLog(`Reset failed: ${(err as Error).message ?? err}`)
    }
    setBusy(false)
  }, [appendLog])

  return (
    <main className="min-h-svh bg-background text-foreground pb-24">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            href="/notifications"
            aria-label="Back to notifications"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-base font-semibold leading-tight">Notification diagnostics</h1>
            <p className="text-xs text-muted-foreground">Run these tests in order to find what&apos;s broken</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={runChecks}
            disabled={busy}
            aria-label="Re-run checks"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </header>

      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-4">
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
                  {c.status === "ok" && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                  {c.status === "fail" && <XCircle className="h-5 w-5 text-destructive" />}
                  {c.status === "warn" && <AlertCircle className="h-5 w-5 text-amber-600" />}
                  {c.status === "pending" && (
                    <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-snug">{c.label}</div>
                  {c.detail && (
                    <div className="mt-0.5 break-words text-xs text-muted-foreground">{c.detail}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Hook-level state from useFcm */}
        <Card className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span>
              <span className="text-muted-foreground">FCM hook status: </span>
              <span className="font-medium">{status}</span>
            </span>
            <span className="truncate">
              <span className="text-muted-foreground">Token: </span>
              <span className="font-mono">
                {token ? token.slice(0, 24) + "…" : "(none)"}
              </span>
            </span>
          </div>
        </Card>

        {/* Action buttons */}
        <Card className="overflow-hidden">
          <div className="border-b border-border bg-muted/40 px-4 py-2">
            <h2 className="text-sm font-semibold">Run tests in this order</h2>
          </div>
          <div className="flex flex-col gap-2 p-4">
            <Button
              size="lg"
              variant="outline"
              className="justify-start"
              onClick={handleGenerateVapid}
              disabled={busy}
            >
              <KeyRound className="mr-2 h-4 w-4" />
              0. Generate VAPID keys (run this once if env vars are missing)
            </Button>
            {vapidEnvBlock && (
              <div className="my-1 rounded-lg border border-border bg-muted/40 p-3">
                <p className="mb-2 text-xs font-medium text-foreground">
                  Copy these four lines into your project Vars panel, then refresh this page:
                </p>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-background p-2 text-[11px] leading-relaxed">
                  {vapidEnvBlock}
                </pre>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 h-7 px-2 text-xs"
                  onClick={handleCopyEnv}
                >
                  {copied ? (
                    <>
                      <Check className="mr-1 h-3 w-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 h-3 w-3" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            )}
            <Button
              size="lg"
              className="justify-start"
              onClick={handleEnable}
              disabled={busy}
            >
              <Bell className="mr-2 h-4 w-4" />
              1. Enable notifications &amp; subscribe
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="justify-start"
              onClick={handleLocalNotification}
              disabled={busy}
            >
              <Volume2 className="mr-2 h-4 w-4" />
              2. Show local test notification (no FCM)
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="justify-start"
              onClick={handleTestPush}
              disabled={busy}
            >
              <Send className="mr-2 h-4 w-4" />
              3. Send test push from server (full Web Push pipeline)
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 justify-start text-muted-foreground"
              onClick={handleReset}
              disabled={busy}
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Reset (unregister all SWs &amp; clear cache)
            </Button>
          </div>
        </Card>

        {/* Test JSON output */}
        {testJson && (
          <Card className="overflow-hidden">
            <div className="border-b border-border bg-muted/40 px-4 py-2">
              <h2 className="text-sm font-semibold">Test push response</h2>
            </div>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words p-4 text-[11px] leading-relaxed">
              {(() => {
                try {
                  return JSON.stringify(JSON.parse(testJson), null, 2)
                } catch {
                  return testJson
                }
              })()}
            </pre>
          </Card>
        )}

        {/* Activity log */}
        <Card className="overflow-hidden">
          <div className="border-b border-border bg-muted/40 px-4 py-2">
            <h2 className="text-sm font-semibold">Activity log</h2>
          </div>
          <ul className="divide-y divide-border text-[11px] leading-relaxed">
            {log.length === 0 && (
              <li className="px-4 py-3 text-muted-foreground">No actions yet.</li>
            )}
            {log.map((line, i) => (
              <li key={i} className="px-4 py-2 font-mono">
                {line}
              </li>
            ))}
          </ul>
        </Card>

        {/* Help text */}
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Reading the results:</strong>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>If step 2 (local notification) fails → it&apos;s a permission/SW problem on your device, not the server.</li>
            <li>
              If step 2 works but step 3 fails → the server pipeline (VAPID keys / subscription lookup) is wrong. Check the &quot;hints&quot; in the JSON above. Tap &quot;Generate VAPID keys&quot; if you haven&apos;t set them yet.
            </li>
            <li>
              If both work but real messages still don&apos;t notify → make sure the SENDER and RECIPIENT are different accounts on different devices.
            </li>
            <li>
              On Android Chrome, system notifications are silenced for ~10 sec after a notification is dismissed (anti-spam) — wait a moment between tests.
            </li>
          </ul>
        </div>
      </div>
    </main>
  )
}
