import { createServerClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const checkoutItems = z.array(
  z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(999),
    expected_price: z.number().min(0).max(1_000_000).optional(),
  }),
)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in to place your order." },
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

    const parsed = checkoutItems.safeParse(body.items)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Your cart contained an invalid item. Please refresh and try again." },
        { status: 400 },
      )
    }

    const note = typeof body.note === "string" && body.note.trim().length > 0
      ? body.note.trim().slice(0, 500)
      : null

    const { data: orders, error } = await supabase.rpc("create_order", {
      p_items: JSON.parse(JSON.stringify(parsed.data)),
      p_note: note,
    })

    if (error) {
      const message = error.message ?? ""
      const code = message.includes("ORDER_FAILED:") ? message : ""
      return NextResponse.json(
        {
          error: message || "Something went wrong placing your order.",
          code,
        },
        { status: 400 },
      )
    }

    const rows = (orders ?? []) as Array<{
      id: string
      reference: string
      vendor_id: string
      subtotal: number
      status: string
      fulfillment: string
    }>

    return NextResponse.json({ orders: rows })
  } catch (err) {
    console.error("[checkout] unhandled error:", err)
    return NextResponse.json(
      { error: "Something went wrong placing your order." },
      { status: 500 },
    )
  }
}
