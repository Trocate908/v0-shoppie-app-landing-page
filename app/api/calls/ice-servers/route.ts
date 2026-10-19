import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ICE server configuration for voice calls.
//
// Only authenticated users receive it, and TURN credentials stay on the server
// (TURN_URLS / TURN_USERNAME / TURN_CREDENTIAL) so a static secret is never
// shipped in the client bundle. When TURN is not configured we still return
// public STUN so the call UI can try a direct connection.
//
// For production traffic a TURN service is strongly recommended — see
// docs/voice-calls.md.

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

export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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

  return NextResponse.json(
    { iceServers, turnConfigured: turnUrls.length > 0 },
    { headers: { "Cache-Control": "private, no-store" } },
  )
}
