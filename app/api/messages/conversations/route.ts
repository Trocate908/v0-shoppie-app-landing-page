import { createServerClient } from "@/lib/supabase/server"
import { resolveVendorReference } from "@/lib/shoppiechat/vendor-scope"
import { NextResponse } from "next/server"

// GET /api/messages/conversations — list all conversations for the current user
export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select(
      `
      id,
      product_id,
      buyer_id,
      vendor_id,
      last_message_at,
      created_at,
      products:product_id (
        id,
        name,
        image_url,
        price
      ),
      messages(id, content, sender_id, delivered, read, created_at)
    `,
    )
    .or(`buyer_id.eq.${user.id},vendor_id.eq.${user.id}`)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, foreignTable: "messages" })
    .limit(100)
    .limit(200, { foreignTable: "messages" })

  if (error) {
    console.error("[messages/conversations] Query error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!conversations || conversations.length === 0) {
    return NextResponse.json({ conversations: [] })
  }

  const vendorIds = [...new Set(conversations.map((c) => c.vendor_id))]
  const { data: vendorRows } = await supabase
    .from("vendors")
    .select("user_id, id, shop_name, profile_picture_url, is_verified, verification_expires_at")
    .in("id", vendorIds)

  const vendorMap: Record<string, (typeof vendorRows extends (infer T)[] | null ? T : never)> = {}
  for (const v of vendorRows ?? []) vendorMap[v.id] = v

  const undeliveredIds: string[] = []
  const enriched = conversations.map((c) => {
    const messages = (c.messages ?? []) as Array<{
      id: string
      content: string | null
      sender_id: string
      delivered: boolean
      read: boolean
      created_at: string
    }>

    const unreadCount = messages.filter((m) => !m.read && m.sender_id !== user.id).length
    messages.forEach((m) => {
      if (!m.delivered && m.sender_id !== user.id) undeliveredIds.push(m.id)
    })
    const lastMsg = messages.length > 0 ? messages[0] : null

    return {
      id: c.id,
      product_id: c.product_id,
      buyer_id: c.buyer_id,
      vendor_id: c.vendor_id,
      last_message_at: c.last_message_at,
      created_at: c.created_at,
      products: c.products,
      vendors: vendorMap[c.vendor_id] ?? null,
      unread_count: unreadCount,
      is_buyer: c.buyer_id === user.id,
      last_message: lastMsg ? { content: lastMsg.content, sender_id: lastMsg.sender_id } : null,
    }
  })

  if (undeliveredIds.length > 0) {
    await supabase
      .from("messages")
      .update({ delivered: true })
      .in("id", undeliveredIds)
      .then(({ error: updateError }) => {
        if (updateError) console.error("[messages/conversations] Delivered update error:", updateError)
      })
  }

  return NextResponse.json({ conversations: enriched })
}

// POST /api/messages/conversations — create or fetch an existing conversation
export async function POST(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { product_id, vendor_id } = body
  if (typeof product_id !== "string" || typeof vendor_id !== "string") {
    return NextResponse.json({ error: "product_id and vendor_id are required" }, { status: 400 })
  }

  const vendor = await resolveVendorReference(supabase, vendor_id)
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 })
  if (vendor.user_id === user.id) {
    return NextResponse.json({ error: "Vendors cannot message themselves" }, { status: 400 })
  }

  // Prevent a client from pairing a product with an unrelated vendor.
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, vendor_id")
    .eq("id", product_id)
    .eq("vendor_id", vendor.id)
    .maybeSingle()

  if (productError) return NextResponse.json({ error: productError.message }, { status: 500 })
  if (!product) return NextResponse.json({ error: "Product does not belong to this vendor" }, { status: 400 })

  // Preserve the database's canonical vendor foreign-key value.
  const canonicalVendorId = vendor.id
  const { data: existing } = await supabase
    .from("conversations")
    .select("id, product_id, buyer_id, vendor_id, last_message_at, created_at")
    .eq("product_id", product_id)
    .eq("buyer_id", user.id)
    .eq("vendor_id", canonicalVendorId)
    .maybeSingle()

  if (existing) return NextResponse.json({ conversation: existing })

  const { data, error } = await supabase
    .from("conversations")
    .insert({ product_id: product.id, buyer_id: user.id, vendor_id: canonicalVendorId })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      const { data: race } = await supabase
        .from("conversations")
        .select("id, product_id, buyer_id, vendor_id, last_message_at, created_at")
        .eq("product_id", product_id)
        .eq("buyer_id", user.id)
        .eq("vendor_id", canonicalVendorId)
        .maybeSingle()
      return NextResponse.json({ conversation: race })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ conversation: data })
}
