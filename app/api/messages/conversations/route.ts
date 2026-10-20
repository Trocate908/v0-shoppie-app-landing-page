import { createServerClient } from "@/lib/supabase/server"
import { NextResponse, after } from "next/server"

export const dynamic = "force-dynamic"

/**
 * How many conversations the list returns. The old query embedded up to 200
 * messages *per conversation*, so a busy inbox shipped tens of thousands of
 * rows (and megabytes of JSON) before the list could paint. Now each
 * conversation embeds exactly one row — its newest message — and unread counts
 * come from a single narrow query.
 */
const CONVERSATION_LIMIT = 60

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

  // One query for the conversations, their product, and only the latest
  // message in each (`limit(1, foreignTable)` applies per parent row).
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
      messages(id, content, sender_id, read, delivered, created_at)
    `
    )
    .or(`buyer_id.eq.${user.id},vendor_id.eq.${user.id}`)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, foreignTable: "messages" })
    .limit(CONVERSATION_LIMIT)
    .limit(1, { foreignTable: "messages" })

  if (error) {
    console.error("[messages/conversations] Query error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!conversations || conversations.length === 0) {
    return NextResponse.json({ conversations: [] })
  }

  const conversationIds = conversations.map((c) => c.id)
  const vendorIds = [...new Set(conversations.map((c) => c.vendor_id))]

  // Two narrow queries in parallel: shop details for the rows, and just the
  // ids/flags of incoming unread messages (no content, no history).
  const [{ data: vendorRows }, { data: unreadRows }] = await Promise.all([
    supabase
      .from("vendors")
      .select("user_id, id, shop_name, profile_picture_url, is_verified, verification_expires_at")
      .in("user_id", vendorIds),
    supabase
      .from("messages")
      .select("id, conversation_id, delivered")
      .in("conversation_id", conversationIds)
      .eq("read", false)
      .neq("sender_id", user.id),
  ])

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

  const unreadByConversation = new Map<string, number>()
  const undeliveredIds: string[] = []
  for (const row of unreadRows ?? []) {
    unreadByConversation.set(
      row.conversation_id,
      (unreadByConversation.get(row.conversation_id) ?? 0) + 1
    )
    if (!row.delivered) undeliveredIds.push(row.id)
  }

  const enriched = conversations.map((c) => {
    const messages = (c.messages ?? []) as Array<{
      id: string
      content: string | null
      sender_id: string
      delivered: boolean
      read: boolean
      created_at: string
    }>
    const lastMsg = messages.length > 0
      ? messages.reduce((a, b) => (b.created_at > a.created_at ? b : a))
      : null

    return {
      id: c.id,
      product_id: c.product_id,
      buyer_id: c.buyer_id,
      vendor_id: c.vendor_id,
      last_message_at: c.last_message_at,
      created_at: c.created_at,
      products: c.products,
      vendors: vendorMap[c.vendor_id] ?? null,
      unread_count: unreadByConversation.get(c.id) ?? 0,
      is_buyer: c.buyer_id === user.id,
      last_message: lastMsg
        ? {
            content: lastMsg.content,
            sender_id: lastMsg.sender_id,
          }
        : null,
    }
  })

  // Bookkeeping the list never reads back — run it after the response is sent.
  if (undeliveredIds.length > 0) {
    after(async () => {
      const { error: updateError } = await supabase
        .from("messages")
        .update({ delivered: true })
        .in("id", undeliveredIds)
      if (updateError) {
        console.error("[messages/conversations] Delivered update error:", updateError)
      }
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
