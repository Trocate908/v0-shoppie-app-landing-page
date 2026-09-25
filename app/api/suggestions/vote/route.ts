import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { asAdmin, asUser } from "@/lib/supabase/dynamic"

function isMissingTable(error: { code?: string } | null): boolean {
  return !!error && (error.code === "42P01" || error.code === "PGRST205")
}

/** Add or remove the signed-in user's vote on a suggestion. */
export async function POST(req: NextRequest) {
  const supabase = asUser(await createClient())
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Sign in to vote on ideas." },
      { status: 401 },
    )
  }

  const body = await req.json().catch(() => ({}))
  const suggestionId = typeof body.suggestionId === "string" ? body.suggestionId : ""
  const remove = body.action === "remove"

  if (!suggestionId) {
    return NextResponse.json({ error: "Missing suggestionId" }, { status: 400 })
  }

  const db = asAdmin(createAdminClient())

  const { data: suggestion, error: suggestionError } = await db
    .from("suggestions")
    .select("id, user_id")
    .eq("id", suggestionId)
    .maybeSingle()

  if (isMissingTable(suggestionError)) {
    return NextResponse.json(
      { error: "Suggestions are not set up yet. Ask an admin to run DB Setup." },
      { status: 503 },
    )
  }
  if (suggestionError) return NextResponse.json({ error: suggestionError.message }, { status: 500 })
  if (!suggestion) return NextResponse.json({ error: "Suggestion not found" }, { status: 404 })

  // No self-voting — it would only inflate the number.
  if (!remove && suggestion.user_id === user.id) {
    return NextResponse.json(
      { error: "You cannot vote on your own idea." },
      { status: 400 },
    )
  }

  if (remove) {
    const { error } = await db
      .from("suggestion_votes")
      .delete()
      .eq("suggestion_id", suggestionId)
      .eq("user_id", user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await db
      .from("suggestion_votes")
      .upsert(
        { suggestion_id: suggestionId, user_id: user.id },
        { onConflict: "suggestion_id,user_id", ignoreDuplicates: true },
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Recount from the votes table so the counter can never drift.
  const { count } = await db
    .from("suggestion_votes")
    .select("id", { count: "exact", head: true })
    .eq("suggestion_id", suggestionId)

  const votes = count ?? 0

  const { error: updateError } = await db
    .from("suggestions")
    .update({ votes })
    .eq("id", suggestionId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true, votes, voted: !remove })
}
