import "server-only"
import { createServerClient } from "@/lib/supabase/server"

export type VendorScope = {
  id: string
  user_id: string
}

/**
 * Resolve the vendor owned by the currently authenticated user.
 * The caller must not use a client-provided vendor_id as an ownership check.
 */
export async function getAuthenticatedVendor(): Promise<{
  user: NonNullable<Awaited<ReturnType<ReturnType<typeof createServerClient>["auth"]["getUser"]>>["data"]["user"]>
  vendor: VendorScope
} | null> {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return null

  const { data: vendor, error } = await supabase
    .from("vendors")
    .select("id, user_id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) throw new Error(`[vendor-scope] Failed to resolve vendor: ${error.message}`)
  if (!vendor) return null

  return { user, vendor }
}

/**
 * Resolve a vendor reference used by legacy marketplace APIs. The reference
 * may be either vendors.id or the vendor owner's auth user id. The returned
 * vendor is always loaded from the database and must be used for validation.
 */
export async function resolveVendorReference(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  reference: string,
): Promise<VendorScope | null> {
  const byId = await supabase
    .from("vendors")
    .select("id, user_id")
    .eq("id", reference)
    .maybeSingle()

  if (byId.error) throw new Error(`[vendor-scope] Failed to resolve vendor: ${byId.error.message}`)
  if (byId.data) return byId.data

  const byUserId = await supabase
    .from("vendors")
    .select("id, user_id")
    .eq("user_id", reference)
    .maybeSingle()

  if (byUserId.error) throw new Error(`[vendor-scope] Failed to resolve vendor: ${byUserId.error.message}`)
  return byUserId.data ?? null
}
