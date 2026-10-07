import { createServerClient } from "@/lib/supabase/server"
import { dispatchNotification } from "@/lib/notifications/dispatch"
import { describeOrderError } from "@/lib/cart"
import { orderStatusBody, orderStatusNotification } from "@/lib/orders"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const statusWord = z.enum([
  "pending",
  "confirmed",
  "ready",
  "pickup_ready",
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
      const code = message.includes("ORDER_FAILED:") ? message : ""
      if (message) {
        console.error("[orders/status] update_order_status failed:", message)
      }
      return NextResponse.json(
        {
          error: code ? describeOrderError(code) : "Couldn't update this order.",
          code,
        },
        { status: 400 },
      )
    }

    const row = (order ?? {}) as Record<string, unknown>

    // Fire-and-forget: a notification failure must never fail the status
    // update itself. Shop-driven changes tell the buyer; when the *buyer* acts
    // (their only write is cancelling) the shop is told instead.
    const buyerId = typeof row.buyer_id === "string" ? row.buyer_id : null
    const vendorId = typeof row.vendor_id === "string" ? row.vendor_id : null
    const reference = typeof row.reference === "string" ? row.reference : ""
    const actorIsBuyer = buyerId !== null && buyerId === user.id

    if (actorIsBuyer) {
      if (vendorId) {
        const { data: vendor } = await supabase
          .from("vendors")
          .select("user_id")
          .eq("id", vendorId)
          .maybeSingle()
        const vendorUserId =
          vendor && typeof vendor.user_id === "string" ? vendor.user_id : null
        if (vendorUserId) {
          void dispatchNotification(
            { userId: vendorUserId },
            {
              type: "order",
              refId: `order-status-${parsed.data.order_id}-cancelled-by-buyer`,
              dedupeWindowHours: 0,
              title: `Order ${reference} cancelled`,
              body: "The customer cancelled this order — no action needed.",
              link: "/vendor/orders",
            },
          ).catch((err) =>
            console.error("[orders/status] vendor notify failed:", err),
          )
        }
      }
    } else if (buyerId) {
      void dispatchNotification(
        { userId: buyerId },
        {
          type: "order",
          refId: `order-status-${parsed.data.order_id}-${parsed.data.status}`,
          dedupeWindowHours: 0,
          title: orderStatusNotification(parsed.data.status, reference),
          body: orderStatusBody(parsed.data.status),
          link: `/orders/${parsed.data.order_id}`,
        },
      ).catch((err) =>
        console.error("[orders/status] buyer notify failed:", err),
      )
    }

    return NextResponse.json({ order: row, status: parsed.data.status })
  } catch (err) {
    console.error("[orders/status] unhandled error:", err)
    return NextResponse.json(
      { error: "Something went wrong updating this order." },
      { status: 500 },
    )
  }
}
