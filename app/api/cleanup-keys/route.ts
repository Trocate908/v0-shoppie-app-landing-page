import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    const supabase = await createServerClient()

    // Call the cleanup function
    const { error } = await supabase.rpc("cleanup_expired_verification_keys")

    if (error) {
      console.error("[v0] Error cleaning up expired keys:", error)
      return NextResponse.json({ error: "Failed to cleanup keys" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Expired keys cleaned up successfully" })
  } catch (error) {
    console.error("[v0] Error in cleanup endpoint:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Optional: Add manual trigger endpoint
export async function GET() {
  return NextResponse.json({
    message: "POST to this endpoint to manually trigger cleanup of expired verification keys",
  })
}
