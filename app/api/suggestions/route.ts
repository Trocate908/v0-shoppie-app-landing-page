import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { asAdmin, asUser } from "@/lib/supabase/dynamic"
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_SUGGESTIONS_PER_HOUR,
  MAX_TITLE_LENGTH,
  SUGGESTION_CATEGORY_VALUES,
  SUGGESTION_STATUS_VALUES,
} from "@/lib/feedback"

type SuggestionRow = {
  id: string
  user_id: string | null
  author_name: string | null
  title: string
  description: string
  category: string
  status: string
  admin_note: string | null
  votes: number
  created_at: string
  updated_at: string | null
}

function isMissingTable(error: { code?: string } | null): boolean {
  return !!error && (error.code === "42P01" || error.code === "PGRST205")
}

/** Public board of suggestions, or the signed-in user's own submissions. */
export async function GET(req: NextRequest) {
  const supabase = asUser(await createClient())
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { searchParams } = new URL(req.url)
  const scope = searchParams.get("scope") === "mine" ? "mine" : "board"
  const status = searchParams.get("status")
  const category = searchParams.get("category")
  const sort = searchParams.get("sort") === "recent" ? "recent" : "votes"

  const db = asAdmin(createAdminClient())

  if (scope === "mine") {
    if (!user) return NextResponse.json({ suggestions: [], votedIds: [] })

    const { data, error } = await db
      .from("suggestions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (isMissingTable(error)) {
      return NextResponse.json(
        { error: "Suggestions are not set up yet. Ask an admin to run DB Setup." },
        { status: 503 },
      )
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ suggestions: (data ?? []) as SuggestionRow[], votedIds: [] })
  }

  let query = db
    .from("suggestions")
    .select("*")
    // "Not planned" ideas stay off the public board so it reads as a roadmap.
    .neq("status", "declined")

  if (status && SUGGESTION_STATUS_VALUES.includes(status)) {
    query = query.eq("status", status)
  }
  if (category && SUGGESTION_CATEGORY_VALUES.includes(category)) {
    query = query.eq("category", category)
  }

  query =
    sort === "recent"
      ? query.order("created_at", { ascending: false })
      : query.order("votes", { ascending: false }).order("created_at", { ascending: false })

  const { data, error } = await query.limit(100)

  if (isMissingTable(error)) {
    return NextResponse.json(
      { error: "Suggestions are not set up yet. Ask an admin to run DB Setup." },
      { status: 503 },
    )
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const suggestions = (data ?? []) as SuggestionRow[]

  // Tell the client which of these the viewer already voted for.
  let votedIds: string[] = []
  if (user && suggestions.length > 0) {
    const { data: votes } = await db
      .from("suggestion_votes")
      .select("suggestion_id")
      .eq("user_id", user.id)
      .in(
        "suggestion_id",
        suggestions.map((s) => s.id),
      )

    votedIds = (votes ?? []).map((v: { suggestion_id: string }) => v.suggestion_id)
  }

  return NextResponse.json({ suggestions, votedIds })
}

export async function POST(req: NextRequest) {
  const supabase = asUser(await createClient())
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const body = await req.json().catch(() => ({}))
  const title = typeof body.title === "string" ? body.title.trim() : ""
  const description = typeof body.description === "string" ? body.description.trim() : ""
  const category = typeof body.category === "string" ? body.category : "feature"

  if (title.length < 4) {
    return NextResponse.json({ error: "Give your idea a title of at least 4 characters." }, { status: 400 })
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return NextResponse.json({ error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer.` }, { status: 400 })
  }
  if (description.length < 10) {
    return NextResponse.json({ error: "Tell us a bit more — at least 10 characters." }, { status: 400 })
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json(
      { error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.` },
      { status: 400 },
    )
  }
  if (!SUGGESTION_CATEGORY_VALUES.includes(category)) {
    return NextResponse.json({ error: "Pick a valid category." }, { status: 400 })
  }

  const db = asAdmin(createAdminClient())
  const authorName =
    (typeof body.authorName === "string" ? body.authorName.trim() : "") ||
    (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "") ||
    (user?.email ? user.email.split("@")[0] : "Guest")

  // Spam guard: at most a handful of ideas per hour per person.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await db
    .from("suggestions")
    .select("id", { count: "exact", head: true })
    .gte("created_at", oneHourAgo)

  if (user) {
    const { count: userCount } = await db
      .from("suggestions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneHourAgo)

    if ((userCount ?? 0) >= MAX_SUGGESTIONS_PER_HOUR) {
      return NextResponse.json(
        { error: "You have sent several ideas already. Please try again in an hour." },
        { status: 429 },
      )
    }
  } else if ((count ?? 0) >= MAX_SUGGESTIONS_PER_HOUR * 10) {
    return NextResponse.json(
      { error: "Too many ideas right now. Please try again later." },
      { status: 429 },
    )
  }

  const { data, error } = await db
    .from("suggestions")
    .insert({
      user_id: user?.id ?? null,
      author_name: authorName.slice(0, 60),
      title: title.slice(0, MAX_TITLE_LENGTH),
      description: description.slice(0, MAX_DESCRIPTION_LENGTH),
      category,
      status: "submitted",
      votes: 0,
    })
    .select()
    .single()

  if (isMissingTable(error)) {
    return NextResponse.json(
      { error: "Suggestions are not set up yet. Ask an admin to run DB Setup." },
      { status: 503 },
    )
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, suggestion: data }, { status: 201 })
}
