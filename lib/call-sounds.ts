// Ring tones for in-app voice calls, synthesised with the Web Audio API.
//
// No audio asset ships with the bundle: a double-tone ring is a handful of
// oscillators, loops cleanly and works offline in the installed PWA. Every
// entry point is best-effort — an autoplay policy that blocks the AudioContext
// (iOS Safari before the first tap) simply leaves the ring silent; the visual
// overlay and the vibration pattern still fire.

/** Cadence per mode: how long each burst sounds, then the pause before the
 *  next one. "ring" is what the callee hears; "ringback" is the caller's
 *  "it's ringing on their end" tone. */
const CADENCE: Record<"ring" | "ringback", { onMs: number; offMs: number }> = {
  ring: { onMs: 450, offMs: 1_800 },
  ringback: { onMs: 1_000, offMs: 3_000 },
}

/** The classic ring pair — a slightly detuned second tone adds body. */
const TONE_HZ = [425, 452]
/** Keep it gentle; the phone is usually at the ear or on a table. */
const GAIN_PEAK = 0.16
/** Vibration pattern for an incoming ring (Android honours it; iOS ignores
 *  navigator.vibrate entirely, which is fine — the overlay still shows). */
const VIBRATE_PATTERN = [600, 700]

let audioContext: AudioContext | null = null
let mode: "ring" | "ringback" | null = null
let burstTimer: ReturnType<typeof setTimeout> | null = null
let vibrateTimer: ReturnType<typeof setInterval> | null = null
/** Holds references to gains that may still be sounding, with the timeout
 *  that will release each one, so `stopCallSounds` can fade them mid-burst
 *  instead of letting a still-queued burst finish at full volume. */
const gainDisposableNodesRef: {
  current: Array<{ gain: GainNode; timer: ReturnType<typeof setTimeout> }> | null
} = { current: null }

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  const ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!ctor) return null
  if (!audioContext) audioContext = new ctor()
  return audioContext
}

/** Creates/resumes the AudioContext from inside a user gesture (the call tap)
 *  so a later async ring isn't blocked by autoplay policy. Safe to call
 *  repeatedly. */
export function primeCallAudio(): void {
  const audio = getAudioContext()
  if (audio && audio.state === "suspended") {
    void audio.resume().catch(() => {})
  }
}

/** Plays one burst of the current mode's tone, if audio is currently allowed. */
function playBurst() {
  if (!mode) return
  const audio = getAudioContext()
  // Blocked by autoplay policy: stay silent rather than throwing per burst.
  if (!audio || audio.state !== "running") return

  const { onMs } = CADENCE[mode]
  const duration = onMs / 1000
  const now = audio.currentTime

  const gain = audio.createGain()
  // Gentle attack/release so bursts don't click.
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(GAIN_PEAK, now + 0.02)
  gain.gain.setValueAtTime(GAIN_PEAK, now + duration - 0.03)
  gain.gain.linearRampToValueAtTime(0, now + duration)
  gain.connect(audio.destination)

  for (const hz of TONE_HZ) {
    const oscillator = audio.createOscillator()
    oscillator.type = "sine"
    oscillator.frequency.value = hz
    oscillator.connect(gain)
    oscillator.start(now)
    oscillator.stop(now + duration)
    oscillator.onended = () => oscillator.disconnect()
  }
  const timeout = setTimeout(() => {
    if (gainDisposableNodesRef.current) {
      gainDisposableNodesRef.current = gainDisposableNodesRef.current.filter((e) => e.gain !== gain)
    }
    try {
      gain.disconnect()
    } catch {
      // already disconnected
    }
  }, duration * 1000 + 100)

  // If the call was already ended by the time this burst began (a stop inside
  // a previous fade, a race in the teardown path, etc.), fade it out
  // immediately so it never sounds past the stop point.
  if (!mode) {
    const releaseMs = 0.04
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(gain.gain.value, now)
    gain.gain.linearRampToValueAtTime(0, now + releaseMs)
  } else {
    // Track the still-sounding gains so stopCallSounds can fade them out
    // mid-burst without leaving a hard cut.
    if (!gainDisposableNodesRef.current) gainDisposableNodesRef.current = []
    gainDisposableNodesRef.current.push({ gain, timer: timeout })
  }
}

function scheduleBursts() {
  if (!mode) return
  const { onMs, offMs } = CADENCE[mode]
  burstTimer = setTimeout(() => {
    if (!mode) return
    playBurst()
    scheduleBursts()
  }, onMs + offMs)
}

function startVibration() {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return
  }
  const patternDuration = VIBRATE_PATTERN.reduce((sum, ms) => sum + ms, 0)
  // A vibrate(pattern) call plays the pattern once, so re-fire it on a loop.
  navigator.vibrate(VIBRATE_PATTERN)
  vibrateTimer = setInterval(() => navigator.vibrate(VIBRATE_PATTERN), patternDuration)
}

/** The callee's ring: tone loop + vibration, until answered or dismissed. */
export function startIncomingRing(): void {
  if (typeof window === "undefined") return
  stopCallSounds()
  mode = "ring"
  playBurst()
  scheduleBursts()
  startVibration()
}

/** The caller's ringback tone while waiting for the other side to answer. */
export function startRingback(): void {
  if (typeof window === "undefined") return
  stopCallSounds()
  mode = "ringback"
  playBurst()
  scheduleBursts()
}

/** Stops every tone and the vibration loop. Idempotent — safe to call from
 *  every path that ends a call.
 *
 *  Because `playBurst` schedules its finish 450–1000ms in the future, a
 *  burst that is mid-sound when the call is answered would otherwise finish at
 *  full volume after the overlay closes. We fade the currently-playing gain
 *  instead, so the ring eases to silence rather than cutting off inside a
 *  syllable. Future bursts are also killed in their announce stage: `playBurst`
 *  itself fades when it starts to find `mode` already null. */
export function stopCallSounds(): void {
  mode = null
  if (burstTimer) {
    clearTimeout(burstTimer)
    burstTimer = null
  }
  if (vibrateTimer) {
    clearInterval(vibrateTimer)
    vibrateTimer = null
  }
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(0)
  }
  // Fade out every burst currently sounding — fast enough to feel instant,
  // short enough to avoid a hard click when the gain ramp is interrupted.
  const audio = getAudioContext()
  if (audio && audio.state === "running") {
    const now = audio.currentTime
    const releaseMs = 0.04
    gainDisposableNodesRef.current?.forEach((entry) => {
      try {
        if (entry.gain.gain.value > 0) {
          entry.gain.gain.cancelScheduledValues(now)
          entry.gain.gain.setValueAtTime(entry.gain.gain.value, now)
          entry.gain.gain.linearRampToValueAtTime(0, now + releaseMs)
        }
      } catch {
        // already stopped / disconnected
      }
    })
  }
}
