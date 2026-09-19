import "server-only"
import { createClient } from "@supabase/supabase-js"

/**
 * Service-role Supabase client.
 *
 * IMPORTANT: This client bypasses Row Level Security and must NEVER be
 * imported from client components. Use it only inside server-side code
 * that needs to read or write across users (e.g. the notification
 * dispatcher needs to read every recipient's push tokens, not just the
 * caller's own row).
 *
 * Falls back to the anon key with a warning if the service role key isn't
 * set, so the app still boots — but cross-user reads will silently return
 * empty results until the key is configured.
 */
let cached: ReturnType<typeof createClient> | null = null

export function createAdminClient() {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !serviceKey) {
    throw new Error(
      "[supabase/admin] Missing SUPABASE URL or service-role key. Set SUPABASE_SERVICE_ROLE_KEY in your env.",
    )
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_KEY) {
    console.warn(
      "[supabase/admin] SUPABASE_SERVICE_ROLE_KEY is not set — falling back to anon key. " +
        "Cross-user notification dispatch will not work until the service role key is configured.",
    )
  }

  cached = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cached
}
