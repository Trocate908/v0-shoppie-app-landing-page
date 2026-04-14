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

  // Fetch conversations the user is a participant of
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
      )
    `
    )
    .or(`buyer_id.eq.${user.id},vendor_id.eq.${user.id}`)
    .order("last_message_at", { ascending: false, nullsFirst: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!conversations || conversations.length === 0) {
    return NextResponse.json({ conversations: [] })
  }

  // Collect all unique vendor_ids (auth user ids) to look up vendor profiles
  const vendorIds = [...new Set(conversations.map((c) => c.vendor_id))]

  const { data: vendorRows } = await supabase
    .from("vendors")
    .select("user_id, id, shop_name, profile_picture_url, is_verified, verification_expires_at")
    .in("user_id", vendorIds)

  // Build a lookup map keyed by vendor.user_id
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

  // Attach unread counts
  const conversationIds = conversations.map((c) => c.id)
  let unreadCounts: Record<string, number> = {}

  const { data: unreadData } = await supabase
    .from("messages")
    .select("conversation_id")
    .in("conversation_id", conversationIds)
    .eq("read", false)
    .eq("deleted", false)
    .neq("sender_id", user.id)

  for (const msg of unreadData ?? []) {
    unreadCounts[msg.conversation_id] = (unreadCounts[msg.conversation_id] ?? 0) + 1
  }

  // Fetch last message preview per conversation
  const { data: lastMessages } = await supabase
    .from("messages")
    .select("conversation_id, content, sender_id, created_at")
    .in("conversation_id", conversationIds)
    .eq("deleted", false)
    .order("created_at", { ascending: false })

  const lastMessageMap: Record<string, { content: string | null; sender_id: string }> = {}
  for (const msg of lastMessages ?? []) {
    if (!lastMessageMap[msg.conversation_id]) {
      lastMessageMap[msg.conversation_id] = {
        content: msg.content,
        sender_id: msg.sender_id,
      }
    }
  }

  const enriched = conversations.map((c) => ({
    ...c,
    vendors: vendorMap[c.vendor_id] ?? null,
    unread_count: unreadCounts[c.id] ?? 0,
    is_buyer: c.buyer_id === user.id,
    last_message: lastMessageMap[c.id] ?? null,
  }))

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

  // vendor_id may be the vendor row id (uuid from products.vendor_id) OR the
  // vendor's auth user_id. Resolve it to the auth user_id either way.
  let vendorAuthId: string = vendor_id

  // Try to find a vendor row where id = vendor_id (the row uuid case)
  const { data: vendorRow } = await supabase
    .from("vendors")
    .select("user_id")
    .eq("id", vendor_id)
    .maybeSingle()

  if (vendorRow?.user_id) {
    vendorAuthId = vendorRow.user_id
  } else {
    // Fallback: maybe vendor_id is already the user_id — verify it exists
    const { data: vendorByUserId } = await supabase
      .from("vendors")
      .select("user_id")
      .eq("user_id", vendor_id)
      .maybeSingle()

    if (!vendorByUserId) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 })
    }
    vendorAuthId = vendorByUserId.user_id
  }

  if (user.id === vendorAuthId) {
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
    .eq("vendor_id", vendorAuthId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ conversation: existing })
  }

  // Create new conversation
  const { data, error } = await supabase
    .from("conversations")
    .insert({ product_id, buyer_id: user.id, vendor_id: vendorAuthId })
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
        .eq("vendor_id", vendorAuthId)
        .maybeSingle()
      return NextResponse.json({ conversation: race })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ conversation: data })
}
