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

  const url = new URL(request.url)
  const before = url.searchParams.get("before")
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100)

  // Run auth check and messages fetch in parallel — saves one full round trip
  let messagesQuery = supabase
    .from("messages")
    .select("id, conversation_id, sender_id, content, image_url, read, delivered, deleted, created_at, edited_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (before) {
    messagesQuery = messagesQuery.lt("created_at", before)
  }

  const [conversation, { data, error }] = await Promise.all([
    verifyParticipant(supabase, conversationId, user.id),
    messagesQuery,
  ])

  if (!conversation) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const messages = data ?? []
  const incomingMessages = messages.filter((m) => m.sender_id !== user.id)

  const undeliveredIds = incomingMessages.filter((m) => !m.delivered).map((m) => m.id)
  const unreadIds = incomingMessages.filter((m) => !m.read).map((m) => m.id)

  // Fire mark-as-read/delivered in the background — don't block the response
  if (undeliveredIds.length > 0) {
    supabase.from("messages").update({ delivered: true }).in("id", undeliveredIds).then(() => {})
  }
  if (unreadIds.length > 0) {
    supabase.from("messages").update({ delivered: true, read: true }).in("id", unreadIds).then(() => {})
  }

  // Respond immediately — marks happen in background
  return NextResponse.json({ messages: messages.reverse(), current_user_id: user.id })
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

  // Insert message and update last_message_at in parallel
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

  // Update conversation timestamp in background — don't block response
  supabase
    .from("conversations")
    .update({ last_message_at: message.created_at })
    .eq("id", conversationId)
    .then(() => {})

  // Fire push notification completely in background — never blocks the sender
  const recipientId =
    conversation.buyer_id === user.id ? conversation.vendor_id : conversation.buyer_id

  Promise.all([
    supabase.from("vendors").select("shop_name").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("full_name, username").eq("id", user.id).maybeSingle(),
  ]).then(([{ data: senderVendor }, { data: senderProfile }]) => {
    const senderName =
      senderVendor?.shop_name ??
      senderProfile?.full_name ??
      senderProfile?.username ??
      user.email?.split("@")[0] ??
      "Someone"

    const preview =
      (content?.trim() && content.trim().slice(0, 140)) ||
      (image_url ? "Sent you an image" : "New message")

    return dispatchNotification(
      { userId: recipientId },
      {
        type: "message",
        refId: message.id,
        dedupeWindowHours: 0,
        title: `New message from ${senderName}`,
        body: preview,
        link: `/?tab=messages&cid=${conversationId}`,
        data: { conversationId, messageId: message.id },
      },
    )
  }).catch((err) => {
    console.error("[messages] notification dispatch failed", err)
  })

  // Respond immediately — notification fires in background
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
    .eq("sender_id", user.id)
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
