import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import {
  generateCloudflareIceServers,
  readCloudflareTurnConfig,
} from "@/lib/cloudflare-turn"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ICE server configuration for voice calls.
//
// Only authenticated users receive it. Two server-side options are supported:
//   1. Cloudflare Realtime TURN — mints short-lived credentials from a TURN key
//      (CLOUDFLARE_TURN_KEY_ID / CLOUDFLARE_TURN_API_TOKEN). The key itself never
//      leaves the server.
//   2. A static TURN provider — TURN_URLS / TURN_USERNAME / TURN_CREDENTIAL.
// Cloudflare wins when configured; if it is unavailable or misconfigured we
// fall back to static TURN, then to public STUN, so a relay outage never blocks
// call setup. See docs/voice-calls.md.

const DEFAULT_STUN = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
]

function parseUrls(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/[,\s]+/)
    .map((url) => url.trim())
    .filter((url) => /^(stun|stuns|turn|turns):/i.test(url))
}

function buildStaticIceConfig(): {
  iceServers: RTCIceServer[]
  turnConfigured: boolean
} {
  const stunUrls = parseUrls(
    process.env.STUN_URLS ?? process.env.NEXT_PUBLIC_STUN_URLS,
  )
  const iceServers: RTCIceServer[] = [
    { urls: stunUrls.length > 0 ? stunUrls : DEFAULT_STUN },
  ]

  const turnUrls = parseUrls(
    process.env.TURN_URLS ?? process.env.NEXT_PUBLIC_TURN_URLS,
  )
  const turnUsername =
    process.env.TURN_USERNAME ?? process.env.NEXT_PUBLIC_TURN_USERNAME
  const turnCredential =
    process.env.TURN_CREDENTIAL ?? process.env.NEXT_PUBLIC_TURN_CREDENTIAL

  if (turnUrls.length > 0) {
    iceServers.push({
      urls: turnUrls,
      ...(turnUsername ? { username: turnUsername } : {}),
      ...(turnCredential ? { credential: turnCredential } : {}),
    })
  }

  return { iceServers, turnConfigured: turnUrls.length > 0 }
}

function hasTurnUrl(servers: RTCIceServer[]): boolean {
  return servers.some((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls]
    return urls.some((url) => /^turns?:/i.test(url))
  })
}

const NO_STORE = { "Cache-Control": "private, no-store" }

export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cloudflare = readCloudflareTurnConfig()
  if (cloudflare) {
    try {
      const { iceServers, ttlSeconds } =
        await generateCloudflareIceServers(cloudflare)
      return NextResponse.json(
        {
          iceServers,
          turnConfigured: hasTurnUrl(iceServers),
          source: "cloudflare",
          ttlSeconds,
        },
        { headers: NO_STORE },
      )
    } catch (turnError) {
      // Keep calls working (STUN/static TURN) when the relay API is down.
      console.error(
        "[calls/ice-servers] Cloudflare TURN unavailable; using fallback:",
        turnError instanceof Error ? turnError.message : turnError,
      )
    }
  }

  const fallback = buildStaticIceConfig()
  return NextResponse.json(
    { ...fallback, source: "static" },
    { headers: NO_STORE },
  )
}
