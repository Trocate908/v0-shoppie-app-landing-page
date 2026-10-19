# In-app voice calls (Phase 1)

One-to-one voice calls between a buyer and the vendor they are already chatting
with. Audio travels browser-to-browser over WebRTC; Supabase is only used for
signaling and call state. No phone numbers, phone credit, video or group calls.

## What is included

- A phone button in the chat header for the open conversation.
- Incoming-call screen with **Accept** / **Decline**, ring timeout and missed-call
  handling, plus cancel while ringing.
- Active-call screen with elapsed time, connection status, mute/unmute, audio
  output switching (where the browser supports it) and **End call**.
- Microphone permission errors, missing/busy devices, offline, busy recipient,
  declined, unanswered and dropped connections.
- Automatic cleanup of the peer connection, microphone tracks, signaling channel
  and timers when a call ends or the app unmounts.
- Global call provider, so a call keeps working while the user moves between
  Store, Messages and Settings.

## 1. Apply the database migration

Run `supabase/migrations/add_voice_calls.sql` in the Supabase SQL editor (or via
`supabase db push`) **before** testing calls. It creates:

| Object | Purpose |
| --- | --- |
| `public.calls` | One row per call attempt: participants, status, timestamps, end reason. |
| `public.call_signals` | Private SDP / ICE rows, readable only by the two participants. |
| `start_call(conversation_id)` | Security-definer RPC. Derives the caller from `auth.uid()` and the recipient from `conversations`, expires stale rings, rejects busy users. |
| `respond_call(call_id, action, reason)` | Validates identity and status transitions for accept / decline / cancel / end / missed / fail. |
| `expire_stale_calls()` | Closes abandoned rings/calls and deletes leftover signaling rows. |

Both tables are added to the `supabase_realtime` publication.

### Access rules

- `calls`: authenticated users can `SELECT` only rows where they are the caller
  or callee. `INSERT`/`UPDATE`/`DELETE` are revoked — state changes go through the
  RPCs above.
- `call_signals`: participants can `SELECT`; `INSERT` additionally requires
  `sender_id = auth.uid()` and that the call is still `ringing` or `active`.
  Signaling payloads are deleted when a call reaches a terminal state.
- No service-role key is ever used in client code. The browser only has the
  public anon key and the signed-in user's session.

## 2. Environment variables

TURN credentials stay on the server and are handed to authenticated clients by
`GET /api/calls/ice-servers`.

```env
# Optional: override the default public STUN servers
STUN_URLS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302

# Required for reliable calls outside simple home/mobile networks
TURN_URLS=turn:your-turn-host:3478?transport=udp,turn:your-turn-host:3478?transport=tcp
TURN_USERNAME=your-turn-username
TURN_CREDENTIAL=your-turn-credential
```

`NEXT_PUBLIC_STUN_URLS`, `NEXT_PUBLIC_TURN_URLS`, `NEXT_PUBLIC_TURN_USERNAME`
and `NEXT_PUBLIC_TURN_CREDENTIAL` are also accepted as fallbacks, but they are
compiled into the client bundle. Prefer the server-only names.

The endpoint returns STUN only (with `turnConfigured: false`) when TURN is not
configured. Direct peer-to-peer calls still work on many networks, but mobile
carrier NATs frequently require a relay. **Do not assume direct connectivity.**

### Configuring TURN

Any standards-compliant TURN service works (coturn self-hosted, or a managed
provider such as Metered, Twilio Network Traversal, Cloudflare Calls, etc.):

1. Create the TURN server/credential in the provider dashboard.
2. Put its URLs and credentials in `TURN_URLS` / `TURN_USERNAME` /
   `TURN_CREDENTIAL` (production env vars too — sandbox `.env` values are not
   used in production).
3. For coturn, enable `turn:` on UDP 3478 **and** TCP/TLS 5349; TLS is strongly
   recommended for restrictive mobile networks.
4. Verify by joining a call with both devices on mobile data and checking
   `chrome://webrtc-internals` for a relay candidate pair.

Short-lived TURN credentials are not generated here; if your provider supports
them, mint them in `/api/calls/ice-servers` instead of using a static secret.

## 3. Browser and platform restrictions

These are browser/platform limits, not bugs:

- **The app must be open.** A browser/PWA cannot receive a WebRTC call while it
  is fully closed. Phase 1 rings only when ShoppieApp is open in a tab, installed
  PWA window, or a recently backgrounded tab whose realtime socket is still
  alive. Waking a closed app needs Web Push plus native CallKit (iOS) /
  ConnectionService (Android) through a native wrapper — that is outside Phase 1.
- **Background tabs are throttled.** Android Chrome may suspend timers and the
  Supabase socket after a while in the background. The ring can arrive late or
  be missed; the app catches up on resume and marks expired rings as missed.
- **Microphone requires a secure context.** HTTPS (or localhost) is mandatory.
  Permission must be granted per origin; if denied, the call is cancelled before
  the other side answers and the UI explains how to re-enable it.
- **iOS Safari** requires a user gesture before audio can play and does not
  support `setSinkId`, so the speaker/output button is hidden there. The audio
  route follows the device's current output (earpiece, Bluetooth, speaker).
- **Android Chrome** supports output selection on recent versions; Bluetooth
  routing can still be controlled by the OS, and `setSinkId` may throw despite
  being present. Failures surface as a clear toast rather than a silent no-op.
- **One tab should own a call.** Two open tabs could both show an incoming ring;
  the first to accept wins and the other closes. Reloading during an active call
  ends your side (media cannot resume), and the other participant sees the call
  drop.
- Audio is always encrypted in transit (DTLS-SRTP). The "Encrypted" badge refers
  to that transport encryption, not end-to-end verification of the peer device.

## 4. Testing checklist

Automated checks cover TypeScript and route availability. A real call needs two
signed-in identities on two devices:

1. Buyer opens a conversation and taps the phone button; vendor receives the
   incoming screen within ~1s. Accept → both timers run and audio flows.
2. Decline → caller sees "Call declined"; no lingering overlay.
3. Caller cancels while ringing → vendor's incoming screen closes.
4. Nobody answers for 45s → both see missed/no-answer; row status is `missed`.
5. Deny microphone permission → call never connects; caller/callee get the
   permission message; call row ends with `mic_denied`.
6. Mute → the other side hears silence; unmute restores audio.
7. Speaker button (Android Chrome) cycles outputs; unsupported browsers hide it.
8. Turn Wi-Fi/mobile data off during a call → "Reconnecting…" then "Call
   dropped"; peer connection and microphone are released.
9. Sign in as a third user and try to read another call's rows/signals via the
   Supabase client → RLS returns nothing. Attempt `start_call` on a conversation
   you are not part of → `not_a_participant`.
10. Call the same person from two accounts / while already in a call → second
    caller gets a "busy" message instead of overwriting the live call.
11. End the call → both overlays show "Call ended"; check
    `chrome://webrtc-internals` has no live peer connection afterwards.

## Known Phase 1 limitations

- No call-history screen yet (rows are stored in `public.calls` for a future
  history tab and for missed-call audits).
- No video, group calls, hold/transfer, ringing while the app is closed, or
  reconnect-after-reload.
- Signaling replays up to 200 rows per call; enough for a 1:1 call, not a
  conference.
