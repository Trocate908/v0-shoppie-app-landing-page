import { createServerClient } from "@/lib/supabase/server"
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

  // Fetch conversations with their related data.
  // Messages are ordered newest-first and capped at 200 per conversation
  // so that unread counts are accurate without pulling unbounded history.
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
    `
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

  // Collect all unique vendor_ids to look up vendor profiles
  const vendorIds = [...new Set(conversations.map((c) => c.vendor_id))]

  const { data: vendorRows } = await supabase
    .from("vendors")
    .select("user_id, id, shop_name, profile_picture_url, is_verified, verification_expires_at")
    .in("user_id", vendorIds)

  // Build vendor lookup map
  const vendorMap: Record<
    string,
    {
      id: string
      shop_name: string
      profile_picture_url: string | null
      is_verified: boolean | null
      verification_expires_at: string | null
    }
  > = {}
  for (const v of vendorRows ?? []) {
    vendorMap[v.user_id] = {
      id: v.id,
      shop_name: v.shop_name,
      profile_picture_url: v.profile_picture_url ?? null,
      is_verified: v.is_verified ?? null,
      verification_expires_at: v.verification_expires_at ?? null,
    }
  }

  // Collect undelivered message IDs and compute stats from the already-fetched messages
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

    // Count unread messages from other users
    const unreadCount = messages.filter(
      (m) => !m.read && m.sender_id !== user.id
    ).length

    // Collect undelivered messages to batch update
    messages.forEach((m) => {
      if (!m.delivered && m.sender_id !== user.id) {
        undeliveredIds.push(m.id)
      }
    })

    // Get last message (most recent)
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
      last_message: lastMsg
        ? {
            content: lastMsg.content,
            sender_id: lastMsg.sender_id,
          }
        : null,
    }
  })

  // Batch update delivered status if needed (single query)
  if (undeliveredIds.length > 0) {
    await supabase
      .from("messages")
      .update({ delivered: true })
      .in("id", undeliveredIds)
      .then(({ error }) => {
        if (error) console.error("[messages/conversations] Delivered update error:", error)
      })
  }

  return NextResponse.json({ conversations: enriched })
}

// POST /api/messages/conversations — create or fetch existing conversation
export async function POST(request: Request) {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { product_id, vendor_id } = body

  if (!product_id || !vendor_id) {
    return NextResponse.json(
      { error: "product_id and vendor_id are required" },
      { status: 400 }
    )
  }

  if (user.id === vendor_id) {
    return NextResponse.json(
      { error: "Vendors cannot message themselves" },
      { status: 400 }
    )
  }

  // Check if conversation already exists
  const { data: existing } = await supabase
    .from("conversations")
    .select("id, product_id, buyer_id, vendor_id, last_message_at, created_at")
    .eq("product_id", product_id)
    .eq("buyer_id", user.id)
    .eq("vendor_id", vendor_id)
    .single()

  if (existing) {
    return NextResponse.json({ conversation: existing })
  }

  // Create new conversation
  const { data, error } = await supabase
    .from("conversations")
    .insert({ product_id, buyer_id: user.id, vendor_id })
    .select()
    .single()

  if (error) {
    // Handle race condition — another insert may have won
    if (error.code === "23505") {
      const { data: race } = await supabase
        .from("conversations")
        .select("id, product_id, buyer_id, vendor_id, last_message_at, created_at")
        .eq("product_id", product_id)
        .eq("buyer_id", user.id)
        .eq("vendor_id", vendor_id)
        .single()
      return NextResponse.json({ conversation: race })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ conversation: data })
}
