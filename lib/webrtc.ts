// Shared client-side helpers for ShoppieApp voice calls.
//
// The call UI is intentionally thin: Supabase is the signaling transport and
// WebRTC carries the audio directly between the two browsers.

export type CallStatus =
  | "ringing"
  | "active"
  | "ended"
  | "declined"
  | "missed"
  | "cancelled"
  | "failed"

/** Row shape returned by public.calls (see supabase/migrations/add_voice_calls.sql). */
export type CallRow = {
  id: string
  conversation_id: string
  caller_id: string
  callee_id: string
  status: CallStatus
  end_reason: string | null
  created_at: string
  answered_at: string | null
  ended_at: string | null
}

export type CallRole = "caller" | "callee"

export type CallPhase =
  | "incoming"
  | "ringing-out"
  | "connecting"
  | "active"
  | "ending"
  | "ended"

/** Everything the overlay needs to render one live call. */
export type CallSession = {
  id: string
  conversationId: string
  role: CallRole
  phase: CallPhase
  peerId: string
  peerName: string
  peerAvatarUrl: string | null
  productName: string | null
  /** Epoch ms when the call was accepted (drives the duration timer). */
  startedAt: number | null
  muted: boolean
  speakerOn: boolean
  connection: RTCPeerConnectionState | "idle"
  notice: string | null
  outro: string | null
  /** True when the server has a TURN relay configured. */
  turnConfigured: boolean
}

export type CallSignalRow = {
  id: number
  call_id: string
  sender_id: string
  kind: "offer" | "answer" | "ice"
  payload: RTCSessionDescriptionInit & RTCIceCandidateInit
  created_at: string
}

/** How long a call rings before both sides treat it as missed. Mirrors the
 *  60s server-side guard in start_call/respond_call. */
export const RING_TIMEOUT_MS = 45_000
/** How long we wait for audio to connect before giving up / restarting ICE. */
export const CONNECT_TIMEOUT_MS = 30_000
/** Grace period for a transient "disconnected" ICE state. */
export const DISCONNECT_GRACE_MS = 15_000

export type IceConfig = {
  iceServers: RTCIceServer[]
  /** True when a TURN server is configured server-side. */
  turnConfigured: boolean
}

// Public STUN is enough for many home/mobile networks; it is not a guarantee.
// TURN credentials are supplied by the deployment (see docs/voice-calls.md).
const FALLBACK_ICE: IceConfig = {
  iceServers: [
    {
      urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],
    },
  ],
  turnConfigured: false,
}

function isValidIceServer(value: unknown): value is RTCIceServer {
  if (!value || typeof value !== "object") return false
  const urls = (value as { urls?: unknown }).urls
  const list = Array.isArray(urls) ? urls : [urls]
  return list.some(
    (url) =>
      typeof url === "string" &&
      /^(stun|stuns|turn|turns):/i.test(url.trim()),
  )
}

/** Loads ICE servers from our authenticated API so TURN credentials stay on
 *  the server instead of being baked into the client bundle. Falls back to
 *  public STUN when the endpoint is unavailable or unconfigured.
 *
 *  Deliberately fetched per call rather than cached for the page lifetime:
 *  Cloudflare TURN credentials are short-lived, and a long-open PWA must not
 *  reuse an expired relay credential on a later call. */
export async function loadIceConfig(): Promise<IceConfig> {
  try {
    const res = await fetch("/api/calls/ice-servers", {
      cache: "no-store",
      headers: { accept: "application/json" },
    })
    if (!res.ok) return FALLBACK_ICE
    const data = (await res.json()) as Partial<IceConfig>
    const servers = Array.isArray(data.iceServers)
      ? data.iceServers.filter(isValidIceServer)
      : []
    if (servers.length === 0) return FALLBACK_ICE
    return {
      iceServers: servers,
      turnConfigured: data.turnConfigured === true,
    }
  } catch {
    return FALLBACK_ICE
  }
}

export function isVoiceCallSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.RTCPeerConnection === "function" &&
    !!navigator.mediaDevices?.getUserMedia
  )
}

export function isSecureCallContext(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.isSecureContext ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  )
}

/** Requests the microphone with voice-call friendly processing. */
export async function acquireMicrophone(): Promise<MediaStream> {
  if (!isVoiceCallSupported()) {
    throw new DOMException("WebRTC is not supported", "NotSupportedError")
  }
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
    video: false,
  })
}

export function describeMicError(error: unknown): string {
  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name?: unknown }).name)
      : ""
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Microphone access was denied. Allow microphone access for this site in your browser settings, then try again."
    case "SecurityError":
      return "Microphone access needs a secure HTTPS connection."
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No microphone was found on this device."
    case "NotReadableError":
    case "TrackStartError":
      return "Your microphone is busy in another app. Close it and try again."
    case "OverconstrainedError":
      return "This microphone can't be used for a voice call."
    case "AbortError":
      return "The microphone could not be started. Please try again."
    case "NotSupportedError":
      return "This browser doesn't support in-app voice calls."
    default:
      return "Couldn't start your microphone. Please try again."
  }
}

/** Turns the Postgres exception text raised by start_call/respond_call into
 *  something a shopper can act on. */
export function mapCallError(message?: string | null): string {
  const text = message ?? ""
  const known: Array<[string, string]> = [
    ["already_in_call", "You're already in a call."],
    ["callee_busy", "They're on another call right now. Try again in a moment."],
    ["not_a_participant", "You can't join this call."],
    ["not_authenticated", "Sign in to make calls."],
    ["conversation_not_found", "This conversation is no longer available."],
    ["call_not_found", "This call is no longer available."],
    ["call_not_ringing", "This call has already ended."],
    ["call_expired", "This call was missed."],
    ["only_callee_can_accept", "Only the person being called can answer."],
    ["only_callee_can_decline", "Only the person being called can decline."],
    ["only_caller_can_cancel", "Only the caller can cancel this call."],
    ["invalid_action", "Something went wrong with this call."],
  ]
  for (const [key, label] of known) {
    if (text.includes(key)) return label
  }
  if (text.toLowerCase().includes("does not exist")) {
    return "Calling isn't set up on this server yet."
  }
  return "The call couldn't be started. Please try again."
}

async function postCallNotify(
  callId: string,
  kind: "ring" | "missed",
): Promise<void> {
  try {
    await fetch("/api/calls/notify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ callId, kind }),
    })
  } catch {
    // Best-effort: a call must never wait on a notification request.
  }
}

/** Asks the server to push the incoming call to the callee's devices — but
 *  only when they are not already in the app (the server checks their
 *  presence heartbeat before sending). Fire-and-forget. */
export function requestCallRingPush(callId: string): Promise<void> {
  return postCallNotify(callId, "ring")
}

/** Replaces the callee's stale "incoming call" notification with a missed-
 *  call notice after the ring times out or is cancelled. The server skips it
 *  when the callee is in the app. Fire-and-forget. */
export function requestCallMissedPush(callId: string): Promise<void> {
  return postCallNotify(callId, "missed")
}

/** Closes any OS notification for this call (tag call-<id>) shown on this
 *  device — used when the in-app overlay takes over while the ring is live. */
export async function closeCallPushNotices(callId: string): Promise<void> {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return
    }
    const registration = await navigator.serviceWorker.getRegistration("/")
    if (!registration) return
    const notices = await registration.getNotifications({ tag: `call-${callId}` })
    for (const notice of notices) notice.close()
  } catch {
    // Best-effort cleanup.
  }
}

export function formatCallDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const pad = (n: number) => n.toString().padStart(2, "0")
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`
}
