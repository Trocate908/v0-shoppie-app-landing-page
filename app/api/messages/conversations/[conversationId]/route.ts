import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

type Params = { params: Promise<{ conversationId: string }> }

// DELETE /api/messages/conversations/[conversationId]
// Deletes a conversation and all its messages (only if the current user is a participant)
export async function DELETE(_request: Request, { params }: Params) {
  const { conversationId } = await params
  const supabase = await createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Verify the user is a participant
  const { data: conversation, error: fetchError } = await supabase
    .from("conversations")
    .select("id, buyer_id, vendor_id")
    .eq("id", conversationId)
    .single()

  if (fetchError || !conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
  }

  if (conversation.buyer_id !== user.id && conversation.vendor_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Delete all messages in the conversation first (FK constraint)
  const { error: msgError } = await supabase
    .from("messages")
    .delete()
    .eq("conversation_id", conversationId)

  if (msgError) {
    return NextResponse.json({ error: msgError.message }, { status: 500 })
  }

  // Delete the conversation.
  // We chain .select() so we can verify rows were actually deleted — if RLS
  // silently blocks the delete, Supabase returns an empty array with no error,
  // which previously caused deleted chats to reappear on the next refresh.
  const { data: deleted, error: convoError } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .select("id")

  if (convoError) {
    return NextResponse.json({ error: convoError.message }, { status: 500 })
  }

  if (!deleted || deleted.length === 0) {
    return NextResponse.json(
      { error: "Conversation could not be deleted. Please try again." },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true })
}
