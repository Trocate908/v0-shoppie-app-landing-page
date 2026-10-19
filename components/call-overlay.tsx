"use client"

import { useEffect, useState, type ReactNode } from "react"
import {
  Mic,
  MicOff,
  Phone,
  PhoneIncoming,
  PhoneOff,
  ShieldCheck,
  Volume2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { avatarGradient } from "@/lib/avatar"
import {
  formatCallDuration,
  type CallSession,
} from "@/lib/webrtc"

type CallOverlayProps = {
  session: CallSession | null
  speakerSupported: boolean
  audioBlocked: boolean
  onAccept: () => void
  onDecline: () => void
  onEnd: () => void
  onToggleMute: () => void
  onToggleSpeaker: () => void
  onEnableAudio: () => void
  onDismiss: () => void
}

/** Ticks once a second while a call is live so the timer stays accurate
 *  without re-rendering the whole app. */
function useElapsedSeconds(startedAt: number | null, running: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [running])
  if (!startedAt) return 0
  return Math.max(0, Math.floor((now - startedAt) / 1000))
}

function statusLine(session: CallSession, elapsed: number): string {
  switch (session.phase) {
    case "incoming":
      return "Incoming voice call"
    case "ringing-out":
      return "Ringing…"
    case "connecting":
      return "Connecting…"
    case "active":
      return formatCallDuration(elapsed)
    case "ending":
      return "Ending call…"
    case "ended":
      return session.outro ?? "Call ended"
    default:
      return ""
  }
}

function connectionLine(session: CallSession): string | null {
  if (session.phase === "ended" || session.phase === "incoming") return null
  if (session.notice) return session.notice
  switch (session.connection) {
    case "connected":
      return "Connected · encrypted audio"
    case "connecting":
    case "new":
    case "idle":
      return session.phase === "ringing-out" ? "Waiting for answer" : "Setting up audio…"
    case "disconnected":
      return "Connection unstable — reconnecting…"
    case "failed":
      return "Connection lost"
    default:
      return null
  }
}

export function CallOverlay({
  session,
  speakerSupported,
  audioBlocked,
  onAccept,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleSpeaker,
  onEnableAudio,
  onDismiss,
}: CallOverlayProps) {
  const live = !!session && session.phase !== "ended" && session.phase !== "incoming"
  const elapsed = useElapsedSeconds(session?.startedAt ?? null, live)
  if (!session) return null

  const incoming = session.phase === "incoming"
  const ended = session.phase === "ended"
  const note = connectionLine(session)
  const gradient = avatarGradient(session.peerName)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        incoming ? `Incoming call from ${session.peerName}` : `Call with ${session.peerName}`
      }
      className="fixed inset-0 z-[200] flex min-h-dvh flex-col overflow-hidden bg-slate-950 text-white"
    >
      {/* Ambient brand glow — purely decorative, sits behind the content. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(37,99,235,0.55),transparent_55%),radial-gradient(circle_at_10%_100%,rgba(16,185,129,0.18),transparent_45%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
      />

      <div
        className="relative flex flex-1 flex-col px-6"
        style={{
          paddingTop: "calc(1.5rem + env(safe-area-inset-top))",
          paddingBottom: "calc(1.75rem + env(safe-area-inset-bottom))",
        }}
      >
        {/* Brand + privacy line */}
        <div className="flex items-center justify-between gap-3 text-[11px] font-medium uppercase tracking-[0.16em] text-white/50">
          <span className="inline-flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10">
              <Phone className="h-3 w-3" />
            </span>
            Shoppie voice
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-300/80">
            <ShieldCheck className="h-3.5 w-3.5" />
            Encrypted
          </span>
        </div>

        {/* Peer */}
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          <div className="relative mb-7">
            {!ended && (
              <>
                <span
                  aria-hidden
                  className={cn(
                    "absolute -inset-4 rounded-full border border-white/10",
                    incoming || session.phase === "ringing-out"
                      ? "animate-pulse"
                      : "opacity-0",
                  )}
                />
                <span
                  aria-hidden
                  className={cn(
                    "absolute -inset-8 rounded-full border border-white/5",
                    incoming || session.phase === "ringing-out"
                      ? "animate-pulse"
                      : "opacity-0",
                  )}
                />
              </>
            )}
            <div className="relative h-28 w-28 overflow-hidden rounded-full bg-white/10 ring-4 ring-white/15">
              {session.peerAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.peerAvatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className={cn(
                    "flex h-full w-full items-center justify-center bg-gradient-to-br text-4xl font-bold text-white",
                    gradient,
                  )}
                >
                  {session.peerName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          <h1 className="max-w-full truncate text-2xl font-bold tracking-tight">
            {session.peerName}
          </h1>
          <p
            aria-live="polite"
            className={cn(
              "mt-2 text-sm font-medium tabular-nums",
              ended ? "text-white/70" : "text-white/80",
            )}
          >
            {statusLine(session, elapsed)}
          </p>
          {session.productName && !ended && (
            <p className="mt-1 max-w-xs truncate text-xs text-white/45">
              About {session.productName}
            </p>
          )}
          {note && !ended && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-white/45">
              <span
                aria-hidden
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  session.connection === "connected"
                    ? "bg-emerald-400"
                    : "bg-amber-300 animate-pulse",
                )}
              />
              {note}
            </p>
          )}
          {audioBlocked && !ended && !incoming && (
            <button
              type="button"
              onClick={onEnableAudio}
              className="mt-4 rounded-full bg-amber-300 px-4 py-2 text-xs font-semibold text-slate-900 transition-colors hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              Tap to hear the call
            </button>
          )}
        </div>

        {/* Controls */}
        {incoming ? (
          <div className="flex items-start justify-center gap-12">
            <CallControl
              label="Decline"
              tone="danger"
              icon={<PhoneOff className="h-7 w-7" />}
              onClick={onDecline}
            />
            <CallControl
              label="Accept"
              tone="accept"
              icon={<PhoneIncoming className="h-7 w-7" />}
              onClick={onAccept}
            />
          </div>
        ) : ended ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-full bg-white/10 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-7">
            <div className="flex items-start justify-center gap-10">
              <CallControl
                label={session.muted ? "Unmute" : "Mute"}
                icon={
                  session.muted ? (
                    <MicOff className="h-6 w-6" />
                  ) : (
                    <Mic className="h-6 w-6" />
                  )
                }
                active={session.muted}
                onClick={onToggleMute}
                disabled={session.phase === "ending"}
              />
              {speakerSupported && (
                <CallControl
                  label="Speaker"
                  icon={<Volume2 className="h-6 w-6" />}
                  active={session.speakerOn}
                  onClick={onToggleSpeaker}
                  disabled={session.phase === "ending"}
                />
              )}
            </div>

            <div className="flex justify-center">
              <CallControl
                label={session.phase === "ringing-out" ? "Cancel" : "End call"}
                tone="danger"
                icon={<PhoneOff className="h-7 w-7" />}
                onClick={onEnd}
                disabled={session.phase === "ending"}
              />
            </div>
          </div>
        )}

        <p className="mt-7 text-center text-[10px] leading-relaxed text-white/35">
          Audio travels directly between devices when your network allows it.
          Calls use your data or Wi-Fi, never phone credit.
        </p>
      </div>
    </div>
  )
}

function CallControl({
  label,
  icon,
  onClick,
  tone = "neutral",
  active = false,
  disabled = false,
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  tone?: "neutral" | "danger" | "accept"
  active?: boolean
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={tone === "neutral" ? active : undefined}
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-full transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
          tone === "danger" && "bg-red-500 text-white shadow-lg shadow-red-500/25 hover:bg-red-600",
          tone === "accept" && "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600",
          tone === "neutral" &&
            (active
              ? "bg-white text-slate-900 hover:bg-white/90"
              : "bg-white/10 text-white hover:bg-white/15"),
        )}
      >
        {icon}
      </button>
      <span className="text-[11px] font-medium text-white/60">{label}</span>
    </div>
  )
}
