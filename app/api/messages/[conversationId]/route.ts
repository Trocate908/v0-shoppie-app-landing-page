import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

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
    .select("id, conversation_id, sender_id, content, image_url, read, deleted, created_at, edited_at")
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

  // Mark unread messages as read (messages sent by the other party)
  const unreadIds = (data ?? [])
    .filter((m) => !m.read && m.sender_id !== user.id)
    .map((m) => m.id)

  if (unreadIds.length > 0) {
    await supabase
      .from("messages")
      .update({ read: true })
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
