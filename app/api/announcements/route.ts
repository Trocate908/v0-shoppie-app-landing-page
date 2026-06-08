import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const db = createAdminClient()
    const now = new Date().toISOString()

    const { data, error } = await db
      .from("announcements")
      .select("id, title, message, target_audience, created_at")
      .eq("is_active", true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("created_at", { ascending: false })
      .limit(5)

    if (error) {
      if (error.code === "42P01") return NextResponse.json({ announcements: [] })
      return NextResponse.json({ announcements: [] })
    }

    return NextResponse.json({ announcements: data ?? [] })
  } catch {
    return NextResponse.json({ announcements: [] })
  }
}
