import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/messages/unread-count
 *
 * The bottom-nav badge only needs counts, but it used to call the full
 * conversations endpoint — pulling every conversation *and* their message
 * history just to add up unread rows. This route reads one narrow column set
 * (RLS already restricts messages to conversations the user is part of) and
 * returns a tiny payload, so badge refreshes stay cheap.
 */
export async function GET() {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("messages")
    .select("conversation_id")
    .eq("read", false)
    .neq("sender_id", user.id)
    .limit(500)

  if (error) {
    console.error("[messages/unread-count] Query error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const byConversation: Record<string, number> = {}
  for (const row of data ?? []) {
    byConversation[row.conversation_id] =
      (byConversation[row.conversation_id] ?? 0) + 1
  }

  return NextResponse.json(
    {
      total: data?.length ?? 0,
      conversations: Object.keys(byConversation).length,
      byConversation,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  )
}
