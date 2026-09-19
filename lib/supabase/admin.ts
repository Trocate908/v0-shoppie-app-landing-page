import "server-only"
import { createClient } from "@supabase/supabase-js"

/**
 * Supabase service-role client for trusted server-only operations.
 *
 * This client bypasses Row Level Security. Never import this module from a
 * client component and never use it as a substitute for vendor scoping.
 */
let cached: ReturnType<typeof createClient> | null = null

export function createAdminClient() {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      "[supabase/admin] Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    )
  }

  cached = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cached
}
