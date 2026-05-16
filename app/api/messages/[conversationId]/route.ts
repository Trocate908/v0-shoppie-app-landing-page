import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { dispatchNotification } from "@/lib/notifications/dispatch"

export const runtime = "nodejs"

type Params = { params: Promise<{ conversationId: string }> }

// Verify the current user is a participant in this conversation
async function verifyParticipant(supabase: ReturnType<typeof createServerClient> extends Promise<infer T> ? T : never, conversationId: string, userId: string) {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, buyer_id, vendor_id")
    .eq("id", conversationId)
    .single()

  if (error || !data) return null
  if (data.buyer_id !== userId && data.vendor_id !== userId) return null
  return data
}

// GET /api/messages/[conversationId] — fetch messages
export async function GET(request: Request, { params }: Params) {
  const { conversationId } = await params
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const conversation = await verifyParticipant(supabase, conversationId, user.id)
  if (!conversation) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(request.url)
  const before = url.searchParams.get("before") // cursor-based pagination
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100)

  let query = supabase
    .from("messages")
    .select("id, conversation_id, sender_id, content, image_url, read, delivered, deleted, created_at, edited_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (before) {
    query = query.lt("created_at", before)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const incomingMessages = (data ?? []).filter((m) => m.sender_id !== user.id)

  // Mark undelivered incoming messages as delivered first (receiver is now online)
  const undeliveredIds = incomingMessages
    .filter((m) => !m.delivered)
    .map((m) => m.id)

  if (undeliveredIds.length > 0) {
    await supabase
      .from("messages")
      .update({ delivered: true })
      .in("id", undeliveredIds)
  }

  // Mark all unread incoming messages as read (conversation is open)
  const unreadIds = incomingMessages
    .filter((m) => !m.read)
    .map((m) => m.id)

  if (unreadIds.length > 0) {
    await supabase
      .from("messages")
      .update({ delivered: true, read: true })
      .in("id", unreadIds)
  }

  return NextResponse.json({ messages: (data ?? []).reverse(), current_user_id: user.id })
}

// POST /api/messages/[conversationId] — send a message
export async function POST(request: Request, { params }: Params) {
  const { conversationId } = await params
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const conversation = await verifyParticipant(supabase, conversationId, user.id)
  if (!conversation) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const { content, image_url } = body

  if (!content?.trim() && !image_url) {
    return NextResponse.json({ error: "Message must have content or image" }, { status: 400 })
  }

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content?.trim() ?? null,
      image_url: image_url ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Update last_message_at on the conversation
  await supabase
    .from("conversations")
    .update({ last_message_at: message.created_at })
    .eq("id", conversationId)

  // Fire a push notification to the other participant. We don't await the
  // result for token lookup before responding — but we DO await the dispatch
  // so failures are logged. Wrapped in try/catch so notification problems
  // never break the message send itself.
  const recipientId =
    conversation.buyer_id === user.id ? conversation.vendor_id : conversation.buyer_id

  try {
    // Look up the sender's display name (vendor shop name if vendor, otherwise email).
    const [{ data: senderVendor }, { data: senderProfile }] = await Promise.all([
      supabase.from("vendors").select("shop_name").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("full_name, username").eq("id", user.id).maybeSingle(),
    ])
    const senderName =
      senderVendor?.shop_name ??
      senderProfile?.full_name ??
      senderProfile?.username ??
      user.email?.split("@")[0] ??
      "Someone"

    const preview =
      (content?.trim() && content.trim().slice(0, 140)) ||
      (image_url ? "Sent you an image" : "New message")

    await dispatchNotification(
      { userId: recipientId },
      {
        type: "message",
        refId: message.id, // unique per message → never deduped
        dedupeWindowHours: 0,
        title: `New message from ${senderName}`,
        body: preview,
        link: `/?tab=messages&cid=${conversationId}`,
        data: {
          conversationId,
          messageId: message.id,
        },
      },
    )
  } catch (err) {
    console.error("[messages] notification dispatch failed", err)
  }

  return NextResponse.json({ message })
}

// PATCH /api/messages/[conversationId] — edit a message
export async function PATCH(request: Request, { params }: Params) {
  const { conversationId } = await params
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { message_id, content } = body

  if (!message_id || !content?.trim()) {
    return NextResponse.json({ error: "message_id and content are required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("messages")
    .update({ content: content.trim(), edited_at: new Date().toISOString() })
    .eq("id", message_id)
    .eq("conversation_id", conversationId)
    .eq("sender_id", user.id) // only sender can edit
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Not found or forbidden" }, { status: 403 })
  }

  return NextResponse.json({ message: data })
}

// DELETE /api/messages/[conversationId] — soft-delete a message
export async function DELETE(request: Request, { params }: Params) {
  const { conversationId } = await params
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { message_id } = body

  if (!message_id) {
    return NextResponse.json({ error: "message_id is required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("messages")
    .update({ deleted: true })
    .eq("id", message_id)
    .eq("conversation_id", conversationId)
    .eq("sender_id", user.id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Not found or forbidden" }, { status: 403 })
  }

  return NextResponse.json({ success: true })
}
