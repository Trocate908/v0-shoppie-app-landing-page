import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET /api/messages/conversations — list all conversations for the current user
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("conversations")
    .select(`
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
      vendors:vendor_id (
        id,
        shop_name,
        profile_picture_url,
        is_verified,
        verification_expires_at
      )
    `)
    .or(`buyer_id.eq.${user.id},vendor_id.eq.${user.id}`)
    .order("last_message_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Attach unread count per conversation
  const conversationIds = (data ?? []).map((c) => c.id)
  let unreadCounts: Record<string, number> = {}

  if (conversationIds.length > 0) {
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
  }

  const enriched = (data ?? []).map((c) => ({
    ...c,
    unread_count: unreadCounts[c.id] ?? 0,
    is_buyer: c.buyer_id === user.id,
  }))

  return NextResponse.json({ conversations: enriched })
}

// POST /api/messages/conversations — create or fetch existing conversation
export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { product_id, vendor_id } = body

  if (!product_id || !vendor_id) {
    return NextResponse.json({ error: "product_id and vendor_id are required" }, { status: 400 })
  }

  if (user.id === vendor_id) {
    return NextResponse.json({ error: "Vendors cannot message themselves" }, { status: 400 })
  }

  // Upsert conversation — one per (product, buyer, vendor) triple
  const { data, error } = await supabase
    .from("conversations")
    .upsert(
      { product_id, buyer_id: user.id, vendor_id },
      { onConflict: "product_id,buyer_id,vendor_id", ignoreDuplicates: false }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ conversation: data })
}
