import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Toggles the authenticated vendor's open/closed status.
 *
 * Shop status is baked into several statically generated (ISR) pages, so a
 * direct client-side write to Supabase leaves every one of them serving stale
 * HTML until their own `revalidate` timer expires — and on `/products`, which
 * had no timer at all, indefinitely. Updating here lets us invalidate those
 * caches immediately after the write.
 *
 * The vendor is resolved from the caller's session rather than accepted from
 * the request body, so a vendor can only ever change their own shop.
 */
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const isOpen = (body as { isOpen?: unknown } | null)?.isOpen
  if (typeof isOpen !== "boolean") {
    return NextResponse.json({ error: "isOpen must be a boolean" }, { status: 400 })
  }

  // Ownership is derived from the session, not supplied by the caller.
  const { data: vendor, error: vendorError } = await supabase
    .from("vendors")
    .select("id, slug")
    .eq("user_id", user.id)
    .single()

  if (vendorError || !vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 })
  }

  const { error: updateError } = await supabase
    .from("vendors")
    .update({ is_open: isOpen })
    .eq("id", vendor.id)

  if (updateError) {
    console.error("[shop-status] update failed:", updateError)
    return NextResponse.json({ error: "Failed to update shop status" }, { status: 500 })
  }

  // Invalidate every surface that renders the shop's open/closed state.
  // `/shop/[slug]` is addressable by both slug and legacy UUID, so revalidate
  // whichever forms exist.
  revalidatePath("/")
  revalidatePath("/browse")
  revalidatePath("/products")
  revalidatePath(`/shop/${vendor.id}`)
  if (vendor.slug) {
    revalidatePath(`/shop/${vendor.slug}`)
  }

  return NextResponse.json({ isOpen })
}
