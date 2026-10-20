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
- **Push notifications for an absent callee.** When a call starts, the callee's
  devices receive an "Incoming call from X" web push — but only when they are
  not already looking at ShoppieApp (a fresh in-app ring overlay means no OS
  popup). If nobody answers or the caller cancels, the notification is replaced
  with "Missed call from X". See §3 for the exact gating and limits.

## 1. Apply the database migration

Run `supabase/migrations/add_voice_calls.sql` **and**
`supabase/migrations/add_user_presence.sql` in the Supabase SQL editor (or via
`supabase db push`) **before** testing calls. The calls migration creates:

| Object | Purpose |
| --- | --- |
| `public.calls` | One row per call attempt: participants, status, timestamps, end reason. |
| `public.call_signals` | Private SDP / ICE rows, readable only by the two participants. |
| `start_call(conversation_id)` | Security-definer RPC. Derives the caller from `auth.uid()` and the recipient from `conversations`, expires stale rings, rejects busy users. |
| `respond_call(call_id, action, reason)` | Validates identity and status transitions for accept / decline / cancel / end / missed / fail. |
| `expire_stale_calls()` | Closes abandoned rings/calls and deletes leftover signaling rows. |

The presence migration adds `public.user_presence`, a per-user heartbeat
(rewritten every 30 seconds while the app is visible) that
`POST /api/calls/notify` reads to decide whether a callee needs a push.

`calls` and `call_signals` are added to the `supabase_realtime` publication;
`user_presence` is deliberately not (clients poll it via upserts, so no
realtime subscription or RLS read of other users' rows is needed).

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
# Optional: override the default STUN servers (Metered STUN + Google STUN)
STUN_URLS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302

# Option A (recommended): Cloudflare Realtime TURN — short-lived credentials
CLOUDFLARE_TURN_KEY_ID=your-turn-key-id
CLOUDFLARE_TURN_API_TOKEN=your-turn-key-api-token
# Optional, default 86400 seconds / 24h (clamped to 300–86400)
CLOUDFLARE_TURN_TTL_SECONDS=86400

# Option B: any static TURN provider
TURN_URLS=turn:your-turn-host:3478?transport=udp,turn:your-turn-host:3478?transport=tcp
TURN_USERNAME=your-turn-username
TURN_CREDENTIAL=your-turn-credential
```

`TURN_KEY_ID` / `TURN_KEY_API_TOKEN` are accepted as aliases for the Cloudflare
names. `NEXT_PUBLIC_STUN_URLS`, `NEXT_PUBLIC_TURN_URLS`,
`NEXT_PUBLIC_TURN_USERNAME` and `NEXT_PUBLIC_TURN_CREDENTIAL` are accepted as
legacy fallbacks, but they are compiled into the client bundle. Prefer the
server-only names.

**Priority:** Cloudflare TURN (if both variables are set) → static TURN → public
STUN. The endpoint returns `source: "cloudflare"` or `source: "static"` so you
can confirm which path was used. If the Cloudflare API is down or rejects the
credentials, the endpoint logs it and falls back instead of breaking call setup.
With no TURN configured the endpoint returns STUN only (`turnConfigured: false`):
direct calls still work on many networks, but mobile carrier NATs frequently
need a relay. **Do not assume direct connectivity.**

A free starting point is the Metered Open Relay, whose free tier hands out the
static credentials a browser app needs:

```env
TURN_URLS=turn:global.relay.metered.ca:80,turn:global.relay.metered.ca:80?transport=tcp,turn:global.relay.metered.ca:443,turns:global.relay.metered.ca:443?transport=tcp
TURN_USERNAME=your-metered-username
TURN_CREDENTIAL=your-metered-credential
```

Keep those credentials in the environment (sandbox `.env.local` and the
production environment), never in git: `.env*` is gitignored, and a hardcoded
credential trips the GitGuardian check on every pull request. The free relay is
shared and best-effort — move to Cloudflare or your own TURN server for relayed
traffic you depend on.

### Cloudflare Realtime TURN (recommended free option)

Cloudflare's TURN service includes **1,000 GB/month of free egress shared with
the Realtime SFU**, then **$0.05/GB**. Relayed audio is only tens of MB per hour,
so the free allowance is large for a small app. You need a Cloudflare account and
a TURN key; there is no per-call SDK or change to the Supabase signaling flow.

1. In the Cloudflare dashboard, open **Realtime → TURN** and create a TURN key.
2. Copy the **TURN Key ID** and **API token** into `CLOUDFLARE_TURN_KEY_ID` and
   `CLOUDFLARE_TURN_API_TOKEN` in the sandbox and production environments. Never
   put the TURN key in a `NEXT_PUBLIC_*` variable or client code.
3. Restart the preview / redeploy. The route now calls
   `POST https://rtc.live.cloudflare.com/v1/turn/keys/<key>/credentials/generate-ice-servers`
   with the configured TTL and returns Cloudflare's STUN + TURN URLs and the
   short-lived username/credential. URLs on port 53 are filtered out because
   browsers block that port.
4. Verify a relay path with two devices on mobile data and
   `chrome://webrtc-internals` (look for a `relay` candidate pair).

The credential is minted per call, and the client deliberately does not cache it
for the page lifetime, so an open PWA cannot reuse an expired relay credential.
The default TTL is 24 hours, longer than any normal voice call, because a relay
credential must not expire mid-call. Lower `CLOUDFLARE_TURN_TTL_SECONDS` if you
prefer shorter-lived credentials and know your maximum call length.

### Other TURN providers

Any standards-compliant TURN service works (coturn self-hosted, or a managed
provider such as Metered, Xirsys, Twilio Network Traversal, etc.):

1. Create the TURN server/credential in the provider dashboard.
2. Put its URLs and credentials in `TURN_URLS` / `TURN_USERNAME` /
   `TURN_CREDENTIAL` (production env vars too — sandbox `.env` values are not
   used in production).
3. For coturn, enable `turn:` on UDP 3478 **and** TCP/TLS 5349; TLS is strongly
   recommended for restrictive mobile networks.
4. Verify by joining a call with both devices on mobile data and checking
   `chrome://webrtc-internals` for a relay candidate pair.

Do not use a shared public TURN credential from a tutorial in production; use a
provider-issued free tier or your own authenticated coturn instance.

## 3. Browser and platform restrictions

These are browser/platform limits, not bugs:

- **The app must be open to *answer*.** A browser/PWA cannot receive a WebRTC
  call while it is fully closed. Phase 1 rings live when ShoppieApp is open in
  a tab, installed PWA window, or a recently backgrounded tab whose realtime
  socket is still alive. When the callee is **not** in the app (backgrounded
  tab, locked phone, minimized PWA), the caller's client asks
  `POST /api/calls/notify`, which sends a web push — "Incoming call from X" —
  to the callee's registered devices, but only if their presence heartbeat is
  stale (they are not looking at the app). The push links into the chat, where
  the ring is recovered if it is still live, and is replaced by a "Missed
  call" notification once the ring dies. The push has a short TTL so an
  undelivered ring cannot surface an hour later. Each call gets at most one
  ring push and one missed push, and only the caller of record can trigger
  them. Answering a WebRTC call still requires opening the app within the 60s
  ring window; native CallKit (iOS) / ConnectionService (Android) wake-up is
  outside Phase 1.
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
12. **Absent-callee push:** background ShoppieApp on the callee's device (or
    lock the phone) for a minute, then call. The callee's device shows an
    "Incoming call from X" push; tapping it opens the chat and recovers the
    ring if it is still within 60s. Cancel the call → the push is replaced by
    "Missed call from X". With the callee's app open in the foreground, no OS
    notification appears — only the in-app ring overlay.
13. **No duplicate/late pushes:** each call produces at most one ring push and
    one missed push (checked via the `call_ring` / `call_missed` rows in
    `notification_sends`), and the ring push cannot be delivered after its
    ~90s TTL.

## Known Phase 1 limitations

- No call-history screen yet (rows are stored in `public.calls` for a future
  history tab and for missed-call audits).
- No video, group calls, hold/transfer, native wake-up of a fully closed app
  (iOS CallKit / Android ConnectionService), or reconnect-after-reload.
- Signaling replays up to 200 rows per call; enough for a 1:1 call, not a
  conference.
