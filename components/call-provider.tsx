"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import {
  acquireMicrophone,
  closeCallPushNotices,
  CONNECT_TIMEOUT_MS,
  DISCONNECT_GRACE_MS,
  describeMicError,
  isSecureCallContext,
  isVoiceCallSupported,
  loadIceConfig,
  mapCallError,
  requestCallMissedPush,
  requestCallRingPush,
  RING_TIMEOUT_MS,
  type CallRow,
  type CallSession,
  type CallSignalRow,
} from "@/lib/webrtc"
import { CallOverlay } from "@/components/call-overlay"
import { useNotifications } from "@/hooks/use-notifications"
import { useToast } from "@/hooks/use-toast"

// One root-level provider owns the whole call lifecycle:
//   • subscribes to public.calls for this user (incoming ring + hang-ups)
//   • exchanges SDP/ICE through public.call_signals (RLS-protected)
//   • owns the RTCPeerConnection, microphone stream and cleanup
//   • renders the incoming / active overlay above every route
// Supabase is the only signaling transport; audio flows peer-to-peer (or via
// TURN when the deployment configures one).

type SupabaseBrowserClient = ReturnType<typeof createBrowserClient>
type RealtimeChannel = ReturnType<SupabaseBrowserClient["channel"]>

let _client: SupabaseBrowserClient | null = null
function getClient(): SupabaseBrowserClient {
  if (!_client) _client = createBrowserClient()
  return _client
}

// Caller-side end reasons that mean the ring was never answered. When one of
// these ends a call, the callee's other devices get a "Missed call" push that
// replaces the incoming-call notification (server-gated on presence).
const RING_NEVER_ANSWERED_REASONS = new Set([
  "cancel",
  "timeout",
  "mic_denied",
  "setup_failed",
])

type PeerContext = {
  peerId: string
  peerName: string
  peerAvatarUrl: string | null
  productName: string | null
}

async function loadPeerContext(
  client: SupabaseBrowserClient,
  conversationId: string,
  selfId: string,
): Promise<PeerContext | null> {
  const { data, error } = await client
    .from("conversations")
    .select("id, buyer_id, vendor_id, products(name)")
    .eq("id", conversationId)
    .maybeSingle()

  if (error || !data) return null

  const isBuyer = data.buyer_id === selfId
  let peerName = isBuyer ? "Vendor" : "Customer"
  let peerAvatarUrl: string | null = null

  if (isBuyer) {
    // Same identity the conversation list shows for this vendor.
    const { data: vendor } = await client
      .from("vendors")
      .select("shop_name, profile_picture_url")
      .eq("user_id", data.vendor_id)
      .maybeSingle()
    if (vendor?.shop_name) peerName = vendor.shop_name
    peerAvatarUrl = vendor?.profile_picture_url ?? null
  }

  const rawProduct = data.products as
    | { name?: string | null }
    | Array<{ name?: string | null }>
    | null
  const productName = Array.isArray(rawProduct)
    ? rawProduct[0]?.name ?? null
    : rawProduct?.name ?? null

  return {
    peerId: isBuyer ? data.vendor_id : data.buyer_id,
    peerName,
    peerAvatarUrl,
    productName,
  }
}

function outroFor(row: CallRow, role: "caller" | "callee"): string {
  switch (row.status) {
    case "declined":
      return "Call declined"
    case "cancelled":
      return "Call cancelled"
    case "missed":
      return role === "callee" ? "Missed call" : "No answer"
    case "failed":
      return "Call dropped"
    default:
      return "Call ended"
  }
}

type StartCallInput = {
  conversationId: string
  peerName?: string
  peerAvatarUrl?: string | null
}

type CallContextValue = {
  session: CallSession | null
  busy: boolean
  speakerSupported: boolean
  startCall: (input: StartCallInput) => Promise<void>
  acceptCall: () => Promise<void>
  declineCall: () => Promise<void>
  endCall: () => Promise<void>
  toggleMute: () => void
  toggleSpeaker: () => Promise<void>
  dismiss: () => void
}

const CallContext = createContext<CallContextValue | null>(null)

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext)
  if (!ctx) throw new Error("useCall must be used inside <CallProvider>")
  return ctx
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast()
  const { notify } = useNotifications()

  const [session, setSessionState] = useState<CallSession | null>(null)
  const sessionRef = useRef<CallSession | null>(null)
  const selfIdRef = useRef<string | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const signalChannelRef = useRef<RealtimeChannel | null>(null)

  const seenSignalsRef = useRef<Set<number>>(new Set())
  const signalChainRef = useRef<Promise<void>>(Promise.resolve())
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([])
  const remoteDescSetRef = useRef(false)
  const restartAttemptedRef = useRef(false)
  const incomingSeenRef = useRef<Set<string>>(new Set())
  const iceConfigRef = useRef<{ turnConfigured: boolean }>({ turnConfigured: false })

  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const outroTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [speakerSupported, setSpeakerSupported] = useState(false)
  // iOS can refuse programmatic playback after async signaling; the overlay
  // offers an explicit tap in that case.
  const [audioBlocked, setAudioBlocked] = useState(false)

  const setSession = useCallback((next: CallSession | null) => {
    sessionRef.current = next
    setSessionState(next)
  }, [])

  const patch = useCallback(
    (
      update:
        | Partial<CallSession>
        | ((current: CallSession) => Partial<CallSession>),
    ) => {
      const current = sessionRef.current
      if (!current) return
      const next = {
        ...current,
        ...(typeof update === "function" ? update(current) : update),
      }
      sessionRef.current = next
      setSessionState(next)
    },
    [],
  )

  const clearTimers = useCallback(() => {
    for (const ref of [
      ringTimerRef,
      connectTimerRef,
      disconnectTimerRef,
      outroTimerRef,
    ]) {
      if (ref.current) {
        clearTimeout(ref.current)
        ref.current = null
      }
    }
  }, [])

  const clearRingTimer = useCallback(() => {
    if (ringTimerRef.current) {
      clearTimeout(ringTimerRef.current)
      ringTimerRef.current = null
    }
  }, [])

  const teardown = useCallback(() => {
    clearTimers()

    const pc = pcRef.current
    pcRef.current = null
    if (pc) {
      pc.onicecandidate = null
      pc.ontrack = null
      pc.onconnectionstatechange = null
      pc.oniceconnectionstatechange = null
      try {
        pc.close()
      } catch {
        // already closed
      }
    }

    // Always release the microphone — otherwise the OS keeps the recording
    // indicator on after a call ends.
    localStreamRef.current?.getTracks().forEach((track) => {
      try {
        track.stop()
      } catch {
        // ignore
      }
    })
    localStreamRef.current = null

    if (audioRef.current) audioRef.current.srcObject = null

    pendingCandidatesRef.current = []
    remoteDescSetRef.current = false
    restartAttemptedRef.current = false
    seenSignalsRef.current.clear()
    signalChainRef.current = Promise.resolve()

    if (signalChannelRef.current) {
      getClient().removeChannel(signalChannelRef.current)
      signalChannelRef.current = null
    }
  }, [clearTimers])

  const finishCall = useCallback(
    (outro: string, endReason: string | null) => {
      teardown()
      const current = sessionRef.current
      if (!current) return
      if (current.phase === "ended") return
      const next: CallSession = {
        ...current,
        phase: "ended",
        outro,
        connection: "closed",
        muted: false,
        speakerOn: false,
        notice: null,
      }
      sessionRef.current = next
      setSessionState(next)
      setAudioBlocked(false)
      outroTimerRef.current = setTimeout(() => {
        if (sessionRef.current?.phase === "ended") {
          sessionRef.current = null
          setSessionState(null)
        }
      }, 5000)
      // Only the caller needs this; the callee chose to decline.
      if (endReason === "declined" && current.role === "caller") {
        toast({
          title: "Call declined",
          description: `${current.peerName} couldn't take the call.`,
        })
      }

      // The in-app overlay makes any OS notification for this ring redundant
      // on this device; the callee's other devices are handled by tag
      // replacement and the missed-call update below.
      void closeCallPushNotices(current.id)
      // A ring that was never answered (cancel, timeout, mic/setup failure)
      // becomes a "Missed call" push on the callee's devices. The server
      // skips it when the callee is in the app right now.
      if (
        current.role === "caller" &&
        endReason !== null &&
        RING_NEVER_ANSWERED_REASONS.has(endReason)
      ) {
        void requestCallMissedPush(current.id)
      }
    },
    [teardown, toast],
  )

  async function callRpc(
    fn: "start_call" | "respond_call" | "expire_stale_calls",
    args: Record<string, unknown> = {},
  ) {
    return getClient().rpc(fn, args)
  }

  const sendSignal = useCallback(
    async (
      callId: string,
      kind: CallSignalRow["kind"],
      payload: RTCSessionDescriptionInit | RTCIceCandidateInit,
    ) => {
      const selfId = selfIdRef.current
      if (!selfId) return
      const { error } = await getClient()
        .from("call_signals")
        .insert({ call_id: callId, sender_id: selfId, kind, payload })
      if (error) {
        console.warn("[calls] signal send failed:", error.message)
      }
    },
    [],
  )

  async function flushCandidates(pc: RTCPeerConnection) {
    const queue = pendingCandidatesRef.current
    pendingCandidatesRef.current = []
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(candidate)
      } catch {
        // A candidate can arrive after a renegotiation; safe to skip.
      }
    }
  }

  async function attemptIceRestart(callId: string): Promise<boolean> {
    const pc = pcRef.current
    if (!pc || pc.signalingState === "closed") return false
    if (restartAttemptedRef.current) return false
    restartAttemptedRef.current = true
    patch({ notice: "Reconnecting…" })
    try {
      const offer = await pc.createOffer({ iceRestart: true })
      await pc.setLocalDescription(offer)
      await sendSignal(callId, "offer", {
        type: offer.type,
        sdp: offer.sdp,
      })
      return true
    } catch (error) {
      console.warn("[calls] ICE restart failed:", error)
      return false
    }
  }

  async function handleConnectionState(callId: string) {
    const pc = pcRef.current
    const current = sessionRef.current
    if (!pc || !current || current.id !== callId) return

    const state = pc.connectionState
    patch({ connection: state })

    if (state === "connected") {
      clearTimers()
      patch({ notice: null })
      return
    }

    if (state === "disconnected") {
      patch({ notice: "Reconnecting…" })
      if (!disconnectTimerRef.current) {
        disconnectTimerRef.current = setTimeout(() => {
          disconnectTimerRef.current = null
          const latest = sessionRef.current
          if (!latest || latest.id !== callId) return
          void callRpc("respond_call", {
            p_call_id: callId,
            p_action: "fail",
            p_reason: "connection_lost",
          })
          finishCall("Call dropped", "connection_lost")
        }, DISCONNECT_GRACE_MS)
      }
      return
    }

    if (state === "failed") {
      const restarted = await attemptIceRestart(callId)
      if (!restarted) {
        void callRpc("respond_call", {
          p_call_id: callId,
          p_action: "fail",
          p_reason: "connection_lost",
        })
        finishCall("Call dropped", "connection_lost")
      }
    }
  }

  const createPeer = useCallback(
    async (callId: string): Promise<RTCPeerConnection> => {
      const ice = await loadIceConfig()
      iceConfigRef.current = ice
      patch({ turnConfigured: ice.turnConfigured })

      const pc = new RTCPeerConnection({
        iceServers: ice.iceServers,
        iceCandidatePoolSize: 4,
      })
      pcRef.current = pc

      const stream = localStreamRef.current
      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream))
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          void sendSignal(callId, "ice", event.candidate.toJSON())
        }
      }

      pc.ontrack = (event) => {
        const [remote] = event.streams
        const audio = audioRef.current
        if (!remote || !audio) return
        audio.srcObject = remote
        // The call was started by a tap, so autoplay with sound is allowed on
        // most browsers. iOS may still block it; surface a tap-to-listen pill.
        audio
          .play()
          .then(() => setAudioBlocked(false))
          .catch(() => setAudioBlocked(true))
      }

      pc.onconnectionstatechange = () => {
        void handleConnectionState(callId)
      }
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed") {
          void handleConnectionState(callId)
        }
      }

      return pc
    },
    [patch, sendSignal],
  )

  const handleSignal = useCallback(
    async (row: CallSignalRow) => {
      if (row.sender_id === selfIdRef.current) return
      if (seenSignalsRef.current.has(row.id)) return
      seenSignalsRef.current.add(row.id)

      const pc = pcRef.current
      if (!pc || pc.signalingState === "closed") return
      const payload = row.payload ?? ({} as CallSignalRow["payload"])

      if (row.kind === "offer") {
        // Also handles an ICE-restart offer mid-call.
        if (pc.signalingState !== "stable" && pc.signalingState !== "have-local-offer") {
          return
        }
        try {
          await pc.setRemoteDescription({ type: "offer", sdp: payload.sdp })
          remoteDescSetRef.current = true
          await flushCandidates(pc)
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          await sendSignal(row.call_id, "answer", {
            type: answer.type,
            sdp: answer.sdp,
          })
          patch((current) =>
            current.phase === "active"
              ? {}
              : { phase: "connecting", notice: "Connecting audio…" },
          )
        } catch (error) {
          console.warn("[calls] failed to apply offer:", error)
        }
        return
      }

      if (row.kind === "answer") {
        if (pc.signalingState !== "have-local-offer") return
        try {
          await pc.setRemoteDescription({ type: "answer", sdp: payload.sdp })
          remoteDescSetRef.current = true
          await flushCandidates(pc)
        } catch (error) {
          console.warn("[calls] failed to apply answer:", error)
        }
        return
      }

      const candidate: RTCIceCandidateInit = {
        candidate: payload.candidate ?? "",
        sdpMid: payload.sdpMid ?? null,
        sdpMLineIndex: payload.sdpMLineIndex ?? null,
        usernameFragment: payload.usernameFragment ?? null,
      }
      if (!candidate.candidate) return
      if (!remoteDescSetRef.current) {
        pendingCandidatesRef.current.push(candidate)
        return
      }
      try {
        await pc.addIceCandidate(candidate)
      } catch {
        // Candidate for a previous description — harmless.
      }
    },
    [patch, sendSignal],
  )

  const enqueueSignal = useCallback(
    (row: CallSignalRow) => {
      // SDP must be applied in order; ICE can follow. Chaining avoids
      // setRemoteDescription racing with itself.
      signalChainRef.current = signalChainRef.current
        .then(() => handleSignal(row))
        .catch((error) => console.warn("[calls] signal handling failed:", error))
    },
    [handleSignal],
  )

  const joinSignaling = useCallback(
    async (callId: string) => {
      const client = getClient()
      if (signalChannelRef.current) {
        client.removeChannel(signalChannelRef.current)
      }

      const channel = client
        .channel(`call_signals:${callId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "call_signals",
            filter: `call_id=eq.${callId}`,
          },
          (payload) => {
            enqueueSignal(payload.new as CallSignalRow)
          },
        )
        .subscribe()
      signalChannelRef.current = channel

      // Subscribe first, then replay history so nothing falls between the two.
      const { data, error } = await client
        .from("call_signals")
        .select("id, call_id, sender_id, kind, payload, created_at")
        .eq("call_id", callId)
        .order("created_at", { ascending: true })
        .limit(200)

      if (error) {
        console.warn("[calls] could not load signals:", error.message)
        return
      }
      for (const row of (data ?? []) as CallSignalRow[]) {
        enqueueSignal(row)
      }
    },
    [enqueueSignal],
  )

  const startRingTimer = useCallback(() => {
    clearRingTimer()
    ringTimerRef.current = setTimeout(() => {
      const current = sessionRef.current
      if (
        !current ||
        (current.phase !== "incoming" && current.phase !== "ringing-out")
      ) {
        return
      }
      void callRpc("respond_call", {
        p_call_id: current.id,
        p_action: "missed",
        p_reason: "timeout",
      })
      if (current.role === "callee") {
        notify({
          title: `Missed call from ${current.peerName}`,
          body: "You missed a Shoppie voice call.",
          tag: `call-${current.id}`,
        })
      }
      finishCall(current.role === "callee" ? "Missed call" : "No answer", "timeout")
    }, RING_TIMEOUT_MS)
  }, [clearRingTimer, finishCall, notify])

  const startConnectTimer = useCallback(
    (callId: string) => {
      if (connectTimerRef.current) clearTimeout(connectTimerRef.current)
      connectTimerRef.current = setTimeout(() => {
        const current = sessionRef.current
        if (!current || current.id !== callId) return
        if (current.phase === "ended" || current.phase === "ending") return
        void attemptIceRestart(callId).then((restarted) => {
          if (restarted) return
          void callRpc("respond_call", {
            p_call_id: callId,
            p_action: "fail",
            p_reason: "connect_timeout",
          })
          finishCall("Couldn't connect the call", "connect_timeout")
        })
      }, CONNECT_TIMEOUT_MS)
    },
    [finishCall],
  )

  const handleIncoming = useCallback(
    async (row: CallRow) => {
      const selfId = selfIdRef.current
      if (!selfId || row.caller_id === selfId) return
      // Guards against duplicate dialogs from a repeated INSERT/UPDATE pair or
      // from React's development double-subscribe.
      if (incomingSeenRef.current.has(row.id)) return
      incomingSeenRef.current.add(row.id)

      // The ring overlay takes over from any OS notification this device
      // received (e.g. the callee returned to the app just in time).
      void closeCallPushNotices(row.id)

      const age = Date.now() - new Date(row.created_at).getTime()
      if (age > RING_TIMEOUT_MS) {
        void callRpc("respond_call", {
          p_call_id: row.id,
          p_action: "missed",
          p_reason: "timeout",
        })
        return
      }

      const existing = sessionRef.current
      if (existing) {
        if (existing.phase !== "ended") {
          // Busy: reject on the user's behalf instead of interrupting the call.
          void callRpc("respond_call", {
            p_call_id: row.id,
            p_action: "decline",
            p_reason: "busy",
          })
          return
        }
        // The previous call's "ended" card is still fading out; that should
        // not make the user look busy.
        setSession(null)
      }

      if (!isVoiceCallSupported() || !isSecureCallContext()) {
        void callRpc("respond_call", {
          p_call_id: row.id,
          p_action: "decline",
          p_reason: "unsupported",
        })
        return
      }

      // Show the ring immediately. Waiting for the profile lookup used to
      // leave a window where a caller who cancelled during the lookup produced
      // a stale dialog; with a provisional session the cancel UPDATE lands on
      // the live session and closes it.
      const next: CallSession = {
        id: row.id,
        conversationId: row.conversation_id,
        role: "callee",
        phase: "incoming",
        peerId: row.caller_id,
        peerName: "Incoming caller",
        peerAvatarUrl: null,
        productName: null,
        startedAt: null,
        muted: false,
        speakerOn: false,
        connection: "idle",
        notice: null,
        outro: null,
        turnConfigured: iceConfigRef.current.turnConfigured,
      }
      sessionRef.current = next
      setSessionState(next)
      startRingTimer()

      const context = await loadPeerContext(
        getClient(),
        row.conversation_id,
        selfId,
      )

      // The call may have ended while the profile loaded. Never resurrect it.
      const current = sessionRef.current
      if (!current || current.id !== row.id || current.phase === "ended") {
        return
      }

      if (!context) {
        void callRpc("respond_call", {
          p_call_id: row.id,
          p_action: "decline",
          p_reason: "unavailable",
        })
        finishCall("Call declined", "unavailable")
        return
      }

      patch({
        peerName: context.peerName,
        peerAvatarUrl: context.peerAvatarUrl,
        productName: context.productName,
      })
      notify({
        title: `Incoming call from ${context.peerName}`,
        body: "Open ShoppieApp to answer.",
        tag: `call-${row.id}`,
      })
    },
    [finishCall, notify, patch, setSession, startRingTimer],
  )

  const handleCallRow = useCallback(
    (row: CallRow, event: "INSERT" | "UPDATE") => {
      const selfId = selfIdRef.current
      if (!selfId) return
      const current = sessionRef.current

      if (!current || current.id !== row.id) {
        if (event === "INSERT" && row.callee_id === selfId) {
          void handleIncoming(row)
        }
        return
      }

      if (row.status === "active") {
        clearRingTimer()
        if (current.role === "callee" && current.phase === "incoming") {
          // Answered on another device/tab.
          finishCall("Call answered elsewhere", "answered_elsewhere")
          return
        }
        if (
          current.phase === "incoming" ||
          current.phase === "ringing-out" ||
          current.phase === "connecting"
        ) {
          patch({
            phase: "active",
            startedAt:
              current.startedAt ??
              (row.answered_at ? new Date(row.answered_at).getTime() : Date.now()),
            notice: null,
          })
          startConnectTimer(row.id)
        }
        return
      }

      if (row.status === "ringing") return
      if (current.phase === "ended" || current.phase === "ending") return

      finishCall(outroFor(row, current.role), row.end_reason ?? row.status)
    },
    [clearRingTimer, finishCall, handleIncoming, patch, startConnectTimer],
  )

  const startCall = useCallback(
    async ({
      conversationId,
      peerName: hintedName,
      peerAvatarUrl: hintedAvatar,
    }: StartCallInput) => {
      const existing = sessionRef.current
      if (existing && existing.phase !== "ended") {
        toast({
          title: "You're already in a call",
          description: "End the current call before starting another.",
        })
        return
      }
      if (existing) setSession(null)

      if (!isVoiceCallSupported()) {
        toast({
          title: "Calls aren't supported here",
          description:
            "Open ShoppieApp in a modern browser (Chrome, Safari, Firefox or Edge) to make voice calls.",
          variant: "destructive",
        })
        return
      }
      if (!isSecureCallContext()) {
        toast({
          title: "Calls need a secure connection",
          description: "Voice calls only work over HTTPS.",
          variant: "destructive",
        })
        return
      }
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        toast({
          title: "You're offline",
          description: "Connect to Wi-Fi or mobile data to call.",
          variant: "destructive",
        })
        return
      }

      const client = getClient()
      const { data: auth } = await client.auth.getUser()
      const selfId = auth.user?.id ?? null
      selfIdRef.current = selfId
      if (!selfId) {
        toast({
          title: "Sign in to make calls",
          description: "Voice calls use your Shoppie account.",
          variant: "destructive",
        })
        return
      }

      // Server-side validation: caller = auth.uid(), recipient = the other
      // participant of this conversation. Both are derived in Postgres.
      const { data, error } = await callRpc("start_call", {
        p_conversation_id: conversationId,
      })
      if (error) {
        toast({
          title: "Couldn't start the call",
          description: mapCallError(error.message),
          variant: "destructive",
        })
        return
      }
      const row = (Array.isArray(data) ? data[0] : data) as CallRow | null
      if (!row) {
        toast({
          title: "Couldn't start the call",
          description: "Please try again.",
          variant: "destructive",
        })
        return
      }

      // Push the callee's devices — the server sends it only when their
      // presence heartbeat shows they are not already in the app.
      void requestCallRingPush(row.id)

      const context = await loadPeerContext(client, conversationId, selfId)
      const next: CallSession = {
        id: row.id,
        conversationId,
        role: "caller",
        phase: "ringing-out",
        peerId: row.callee_id,
        peerName: context?.peerName ?? hintedName ?? "Vendor",
        peerAvatarUrl: context?.peerAvatarUrl ?? hintedAvatar ?? null,
        productName: context?.productName ?? null,
        startedAt: null,
        muted: false,
        speakerOn: false,
        connection: "idle",
        notice: null,
        outro: null,
        turnConfigured: false,
      }
      sessionRef.current = next
      setSessionState(next)
      setAudioBlocked(false)

      let stream: MediaStream
      try {
        stream = await acquireMicrophone()
      } catch (error) {
        toast({
          title: "Microphone unavailable",
          description: describeMicError(error),
          variant: "destructive",
        })
        void callRpc("respond_call", {
          p_call_id: row.id,
          p_action: "cancel",
          p_reason: "mic_denied",
        })
        finishCall("Call cancelled", "mic_denied")
        return
      }
      localStreamRef.current = stream

      try {
        await joinSignaling(row.id)
        const pc = await createPeer(row.id)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await sendSignal(row.id, "offer", {
          type: offer.type,
          sdp: offer.sdp,
        })
        startRingTimer()
      } catch (error) {
        console.warn("[calls] failed to open peer connection:", error)
        toast({
          title: "Couldn't start the call",
          description: "Your browser couldn't open a voice connection.",
          variant: "destructive",
        })
        void callRpc("respond_call", {
          p_call_id: row.id,
          p_action: "cancel",
          p_reason: "setup_failed",
        })
        finishCall("Call cancelled", "setup_failed")
      }
    },
    [
      createPeer,
      finishCall,
      joinSignaling,
      sendSignal,
      setSession,
      startRingTimer,
      toast,
    ],
  )

  const acceptCall = useCallback(async () => {
    const current = sessionRef.current
    if (!current || current.phase !== "incoming") return

    patch({ phase: "connecting", notice: "Connecting…" })
    setAudioBlocked(false)

    let stream: MediaStream
    try {
      stream = await acquireMicrophone()
    } catch (error) {
      toast({
        title: "Microphone unavailable",
        description: describeMicError(error),
        variant: "destructive",
      })
      void callRpc("respond_call", {
        p_call_id: current.id,
        p_action: "decline",
        p_reason: "mic_denied",
      })
      finishCall("Call declined", "mic_denied")
      return
    }
    localStreamRef.current = stream

    const { data: accepted, error } = await callRpc("respond_call", {
      p_call_id: current.id,
      p_action: "accept",
    })
    if (error) {
      toast({
        title: "Couldn't answer the call",
        description: mapCallError(error.message),
        variant: "destructive",
      })
      teardown()
      setSession(null)
      return
    }

    // A ring older than 60s comes back already marked missed (the server keeps
    // that state instead of raising), so don't open a dead peer connection.
    const acceptedRow = (Array.isArray(accepted) ? accepted[0] : accepted) as
      | CallRow
      | null
    if (!acceptedRow || acceptedRow.status !== "active") {
      toast({
        title: "That call was missed",
        description: "The caller stopped ringing before you answered.",
      })
      finishCall("Missed call", acceptedRow?.end_reason ?? "timeout")
      return
    }

    clearRingTimer()
    patch({
      phase: "connecting",
      startedAt: Date.now(),
      notice: "Connecting audio…",
    })

    try {
      // Peer first, then the signaling channel: the queued offer needs somewhere
      // to land as soon as it is replayed from the table.
      await createPeer(current.id)
      await joinSignaling(current.id)
      startConnectTimer(current.id)
    } catch (error) {
      console.warn("[calls] failed to answer:", error)
      toast({
        title: "Couldn't connect the call",
        description: "Your browser couldn't open a voice connection.",
        variant: "destructive",
      })
      void callRpc("respond_call", {
        p_call_id: current.id,
        p_action: "fail",
        p_reason: "setup_failed",
      })
      finishCall("Call dropped", "setup_failed")
    }
  }, [
    clearRingTimer,
    createPeer,
    finishCall,
    joinSignaling,
    patch,
    setSession,
    startConnectTimer,
    teardown,
    toast,
  ])

  const endCall = useCallback(async () => {
    const current = sessionRef.current
    if (!current || current.phase === "ended" || current.phase === "ending") {
      return
    }

    const action =
      current.phase === "incoming"
        ? "decline"
        : current.phase === "ringing-out"
          ? "cancel"
          : "end"
    patch({ phase: "ending", notice: null })

    // Ending must feel instant even if the network stalls; the overlay is
    // released locally either way and the row is closed server-side when able.
    await Promise.race([
      callRpc("respond_call", {
        p_call_id: current.id,
        p_action: action,
        p_reason: action === "decline" ? "declined" : "hangup",
      }),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ])

    finishCall(
      action === "cancel"
        ? "Call cancelled"
        : action === "decline"
          ? "Call declined"
          : "Call ended",
      action,
    )
  }, [finishCall, patch])

  const dismiss = useCallback(() => {
    if (sessionRef.current?.phase === "ended") {
      setSession(null)
    }
  }, [setSession])

  const enableAudio = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return
    try {
      await audio.play()
      setAudioBlocked(false)
    } catch {
      setAudioBlocked(true)
    }
  }, [])

  const toggleMute = useCallback(() => {
    const current = sessionRef.current
    if (!current || current.phase === "ended") return
    const nextMuted = !current.muted
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted
    })
    patch({ muted: nextMuted })
  }, [patch])

  const toggleSpeaker = useCallback(async () => {
    const current = sessionRef.current
    const audio = audioRef.current
    if (!current || !audio) return

    const element = audio as HTMLAudioElement & {
      setSinkId?: (sinkId: string) => Promise<void>
      sinkId?: string
    }
    if (typeof element.setSinkId !== "function") {
      toast({
        title: "Speaker control isn't available",
        description:
          "Use your phone's volume or Bluetooth controls to change the audio output.",
      })
      return
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const outputs = devices.filter((device) => device.kind === "audiooutput")
      if (outputs.length <= 1) {
        toast({
          title: "No other audio output found",
          description: "Connect headphones or a speaker, then try again.",
        })
        return
      }
      const currentId = element.sinkId ?? ""
      const index = outputs.findIndex((device) => device.deviceId === currentId)
      const next = outputs[(index + 1) % outputs.length]
      await element.setSinkId(next.deviceId)
      patch({ speakerOn: next.deviceId !== "default" && next.deviceId !== "" })
      toast({ title: `Audio: ${next.label || "selected output"}` })
    } catch {
      toast({
        title: "Couldn't switch audio output",
        description: "Your browser blocked the change.",
        variant: "destructive",
      })
    }
  }, [patch, toast])

  // Resolve the signed-in user (and keep it fresh across sign-in/out).
  useEffect(() => {
    const client = getClient()
    let cancelled = false
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      selfIdRef.current = nextSession?.user?.id ?? null
    })
    client.auth
      .getUser()
      .then(({ data: auth }) => {
        if (!cancelled) selfIdRef.current = auth.user?.id ?? null
      })
      .catch(() => {})
    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [])

  // Heartbeat so /api/calls/notify can tell whether a callee is already in
  // the app: while visible, stamp public.user_presence every 30s, and stamp
  // once when backgrounded so the "away" clock starts then. Failures are
  // silent — until add_user_presence.sql runs, the notify route fails open
  // and pushes anyway.
  useEffect(() => {
    const client = getClient()
    let cancelled = false
    let uid: string | null = null
    let warned = false

    async function beat(force = false) {
      if (!uid) return
      if (!force && document.visibilityState !== "visible") return
      const { error } = await client
        .from("user_presence")
        .upsert(
          { user_id: uid, last_seen_at: new Date().toISOString() },
          { onConflict: "user_id" },
        )
      if (error && !warned) {
        warned = true
        const missingTable =
          error.code === "42P01" ||
          String(error.message).includes("user_presence")
        if (!missingTable) {
          console.warn("[calls] presence heartbeat failed:", error.message)
        }
      }
    }

    const { data: authSub } = client.auth.onAuthStateChange(
      (_event, session) => {
        const next = session?.user?.id ?? null
        if (next !== uid) {
          uid = next
          if (uid) void beat()
        }
      },
    )
    client.auth
      .getUser()
      .then(({ data: auth }) => {
        if (cancelled) return
        const next = auth.user?.id ?? null
        if (next !== uid) {
          uid = next
          if (uid) void beat()
        }
      })
      .catch(() => {})

    const interval = setInterval(() => void beat(), 30_000)
    const onVisibility = () => void beat(document.visibilityState !== "visible")
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibility)
      authSub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (typeof HTMLMediaElement === "undefined") return
    setSpeakerSupported("setSinkId" in HTMLMediaElement.prototype)
  }, [])

  // Incoming calls + hang-ups for this user. Filters are separate because
  // postgres_changes supports a single filter per listener.
  useEffect(() => {
    const client = getClient()
    let cancelled = false
    let channel: RealtimeChannel | null = null

    // Catches a ring that arrived while the tab was backgrounded, offline or
    // just reloaded — realtime inserts are not replayed to a sleeping socket.
    async function recoverRinging() {
      const uid = selfIdRef.current
      if (!uid || cancelled) return
      const { data } = await client
        .from("calls")
        .select("*")
        .eq("callee_id", uid)
        .eq("status", "ringing")
        .order("created_at", { ascending: false })
        .limit(1)
      if (!cancelled) {
        for (const row of (data ?? []) as CallRow[]) {
          handleCallRow(row, "INSERT")
        }
      }
    }

    async function attach() {
      const { data: auth } = await client.auth.getUser()
      if (cancelled) return
      const uid = auth.user?.id ?? null
      selfIdRef.current = uid
      if (!uid) return

      // Closes rings left over from a closed tab and drops stale signals.
      void callRpc("expire_stale_calls")

      const callsChannel = client
        .channel(`calls:${uid}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "calls",
            filter: `callee_id=eq.${uid}`,
          },
          (payload) => {
            if (!cancelled) handleCallRow(payload.new as CallRow, "INSERT")
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "calls",
            filter: `callee_id=eq.${uid}`,
          },
          (payload) => {
            if (!cancelled) handleCallRow(payload.new as CallRow, "UPDATE")
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "calls",
            filter: `caller_id=eq.${uid}`,
          },
          (payload) => {
            if (!cancelled) handleCallRow(payload.new as CallRow, "UPDATE")
          },
        )
      channel = callsChannel

      // Wait for the socket before recovering: a ring inserted between the
      // query and subscription readiness would otherwise be lost.
      await new Promise<void>((resolve) => {
        let settled = false
        const timer = setTimeout(() => finish(), 5000)
        function finish() {
          if (settled) return
          settled = true
          clearTimeout(timer)
          resolve()
        }
        callsChannel.subscribe((status) => {
          if (
            status === "SUBSCRIBED" ||
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            finish()
          }
        })
      })

      await recoverRinging()
    }

    void attach()

    const onOnline = () => {
      if (cancelled) return
      void callRpc("expire_stale_calls")
      void recoverRinging()
    }
    const onVisible = () => {
      if (!document.hidden) onOnline()
    }
    window.addEventListener("online", onOnline)
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      cancelled = true
      window.removeEventListener("online", onOnline)
      document.removeEventListener("visibilitychange", onVisible)
      if (channel) client.removeChannel(channel)
    }
  }, [handleCallRow])

  // Release the microphone/peer if the provider itself unmounts.
  useEffect(() => () => teardown(), [teardown])

  // Keep the page behind the call from scrolling on mobile.
  useEffect(() => {
    if (!session) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [session])

  const value = useMemo<CallContextValue>(
    () => ({
      session,
      busy: !!session && session.phase !== "ended",
      speakerSupported,
      startCall,
      acceptCall,
      declineCall: endCall,
      endCall,
      toggleMute,
      toggleSpeaker,
      dismiss,
    }),
    [
      acceptCall,
      dismiss,
      endCall,
      session,
      speakerSupported,
      startCall,
      toggleMute,
      toggleSpeaker,
    ],
  )

  return (
    <CallContext.Provider value={value}>
      {children}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      <CallOverlay
        session={session}
        speakerSupported={speakerSupported}
        audioBlocked={audioBlocked}
        onAccept={() => void acceptCall()}
        onDecline={() => void endCall()}
        onEnd={() => void endCall()}
        onToggleMute={toggleMute}
        onToggleSpeaker={() => void toggleSpeaker()}
        onEnableAudio={() => void enableAudio()}
        onDismiss={dismiss}
      />
    </CallContext.Provider>
  )
}
