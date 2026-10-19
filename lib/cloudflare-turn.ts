// Server-only helper for Cloudflare Realtime TURN.
//
// Cloudflare TURN keys are long-lived secrets that can mint unlimited
// short-lived credentials. They must never be sent to the browser. The
// authenticated `/api/calls/ice-servers` route calls this helper and returns
// only the expiring credentials.
//
// Docs: https://developers.cloudflare.com/realtime/turn/generate-credentials/

export type CloudflareTurnConfig = {
  keyId: string
  apiToken: string
  ttlSeconds: number
  /** Override for tests / self-hosted gateways. Defaults to Cloudflare. */
  apiBase?: string
}

export type CloudflareTurnCredentials = {
  iceServers: RTCIceServer[]
  ttlSeconds: number
}

const DEFAULT_API_BASE = "https://rtc.live.cloudflare.com"
// Cloudflare asks for a TTL longer than the longest expected call. A voice
// call should never outlive its relay credential, so default to the maximum.
const DEFAULT_TTL_SECONDS = 86_400
const MIN_TTL_SECONDS = 300
const MAX_TTL_SECONDS = 86_400

/**
 * Reads the Cloudflare TURN settings from the server environment. Returns null
 * unless *both* the key id and API token are present, so a half-configured
 * deployment gracefully continues with STUN/static TURN instead of failing
 * call setup.
 */
export function readCloudflareTurnConfig(
  env: Record<string, string | undefined> = process.env,
): CloudflareTurnConfig | null {
  // `||` (not `??`) so an empty CLOUDFLARE_* value still falls back to the
  // shorter alias rather than disabling TURN entirely.
  const keyId = (env.CLOUDFLARE_TURN_KEY_ID || env.TURN_KEY_ID || "").trim()
  const apiToken = (
    env.CLOUDFLARE_TURN_API_TOKEN ||
    env.TURN_KEY_API_TOKEN ||
    ""
  ).trim()
  if (!keyId || !apiToken) return null

  const rawTtl = Number(
    env.CLOUDFLARE_TURN_TTL_SECONDS ?? env.TURN_CREDENTIAL_TTL_SECONDS,
  )
  const ttlSeconds =
    Number.isFinite(rawTtl) && rawTtl > 0
      ? Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, Math.round(rawTtl)))
      : DEFAULT_TTL_SECONDS

  return { keyId, apiToken, ttlSeconds }
}

/** Drops port 53 URLs: browsers block that port, and Cloudflare's trickle-ICE
 *  guidance recommends filtering it out. */
function isPort53(url: string): boolean {
  return /:53(?:[/?]|$)/.test(url)
}

/**
 * Validates and normalizes the TURN payload returned by Cloudflare. Keeps only
 * real STUN/TURN URLs and the auth fields needed by RTCPeerConnection.
 */
export function sanitizeCloudflareIceServers(value: unknown): RTCIceServer[] {
  if (!Array.isArray(value)) return []

  const servers: RTCIceServer[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue

    const rawUrls = (entry as { urls?: unknown }).urls
    const list = Array.isArray(rawUrls) ? rawUrls : [rawUrls]
    const urls = list
      .filter((url): url is string => typeof url === "string")
      .map((url) => url.trim())
      .filter((url) => /^(stun|stuns|turn|turns):/i.test(url))
      .filter((url) => !isPort53(url))

    if (urls.length === 0) continue

    const server: RTCIceServer = { urls }
    const username = (entry as { username?: unknown }).username
    const credential = (entry as { credential?: unknown }).credential
    if (typeof username === "string" && username.length > 0) {
      server.username = username
    }
    if (typeof credential === "string" && credential.length > 0) {
      server.credential = credential
    }
    servers.push(server)
  }

  return servers
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/**
 * Mints a short-lived ICE server configuration from Cloudflare.
 *
 * @param config   TURN key id / API token (server-only) and credential TTL.
 * @param fetchImpl Injectable fetch so the credential exchange can be tested
 *                  without a Cloudflare account.
 */
export async function generateCloudflareIceServers(
  config: CloudflareTurnConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<CloudflareTurnCredentials> {
  const apiBase = (config.apiBase ?? DEFAULT_API_BASE).replace(/\/+$/, "")
  const url = `${apiBase}/v1/turn/keys/${encodeURIComponent(
    config.keyId,
  )}/credentials/generate-ice-servers`

  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ ttl: config.ttlSeconds }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  })

  if (!response.ok) {
    // Include only a short server-provided reason; never log the token.
    const detail = truncate(await response.text().catch(() => ""), 200)
    throw new Error(
      `Cloudflare TURN credential request failed (${response.status})${
        detail ? `: ${detail}` : ""
      }`,
    )
  }

  const payload = (await response.json()) as { iceServers?: unknown }
  const iceServers = sanitizeCloudflareIceServers(payload.iceServers)
  if (iceServers.length === 0) {
    throw new Error("Cloudflare TURN returned no usable ICE servers")
  }

  return { iceServers, ttlSeconds: config.ttlSeconds }
}
