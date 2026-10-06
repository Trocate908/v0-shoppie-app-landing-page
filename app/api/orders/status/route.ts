import { createServerClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const statusWord = z.enum([
  "pending",
  "confirmed",
  "ready",
  "delivered",
  "cancelled",
])

const statusSchema = z.object({
  order_id: z.string().uuid(),
  status: statusWord,
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in to update this order." },
        { status: 401 },
      )
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      )
    }

    const parsed = statusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "That order status isn't valid." },
        { status: 400 },
      )
    }

    const { data: order, error } = await supabase.rpc("update_order_status", {
      p_order_id: parsed.data.order_id,
      p_status: parsed.data.status,
    })

    if (error) {
      const message = error.message ?? ""
      return NextResponse.json(
        {
          error: message || "Couldn't update this order.",
          code: message.includes("ORDER_FAILED:") ? message : "",
        },
        { status: 400 },
      )
    }

    const row = (order ?? {}) as Record<string, unknown>
    return NextResponse.json({ order: row, status: parsed.data.status })
  } catch (err) {
    console.error("[orders/status] unhandled error:", err)
    return NextResponse.json(
      { error: "Something went wrong updating this order." },
      { status: 500 },
    )
  }
}
