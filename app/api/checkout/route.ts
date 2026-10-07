import { createServerClient } from "@/lib/supabase/server"
import { dispatchNotification } from "@/lib/notifications/dispatch"
import { describeOrderError } from "@/lib/cart"
import { PAYMENT_METHODS } from "@/lib/orders"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const checkoutItems = z.array(
  z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(999),
    expected_price: z.number().min(0).max(1_000_000).optional(),
  }),
)

// How the buyer takes delivery of this order: collected from the shop, or
// brought to an address. Validated here and again inside create_order().
const checkoutDetails = z
  .object({
    fulfillment: z.enum(["pickup", "delivery"], {
      errorMap: () => ({ message: "Choose pickup or delivery for your order." }),
    }),
    delivery_address: z
      .string()
      .trim()
      .min(10, "Delivery addresses need at least 10 characters (street, suburb, city).")
      .max(500, "That delivery address is too long (max 500 characters).")
      .optional(),
    payment_method: z.enum(PAYMENT_METHODS, {
      errorMap: () => ({ message: "Choose how you'd like to pay." }),
    }),
  })
  .superRefine((value, ctx) => {
    if (value.fulfillment === "delivery" && !value.delivery_address) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["delivery_address"],
        message: "Add a delivery address so the shop can reach you.",
      })
    }
  })

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

    const details = checkoutDetails.safeParse({
      fulfillment: body.fulfillment ?? "pickup",
      delivery_address: body.delivery_address,
      payment_method: body.payment_method ?? "cash",
    })
    if (!details.success) {
      return NextResponse.json(
        {
          error:
            details.error.issues[0]?.message ??
            "Please review your checkout details.",
        },
        { status: 400 },
      )
    }

    const note = typeof body.note === "string" && body.note.trim().length > 0
      ? body.note.trim().slice(0, 500)
      : null

    const rpcArgs = {
      p_items: JSON.parse(JSON.stringify(parsed.data)),
      p_note: note,
      p_fulfillment: details.data.fulfillment,
      p_delivery_address:
        details.data.fulfillment === "delivery"
          ? details.data.delivery_address ?? null
          : null,
      p_payment_method: details.data.payment_method,
    }

    let { data: orders, error } = await supabase.rpc("create_order", rpcArgs)

    if (error && /function[\s\S]*create_order/i.test(error.message ?? "")) {
      // The database migration hasn't been applied yet, so only the legacy
      // 2-argument signature exists. Fall back so checkout keeps working —
      // orders placed this way stay pickup/cash until the migration in
      // supabase/migrations/add_cart_and_orders.sql has been run.
      console.error(
        "[checkout] create_order migration missing; using legacy signature:",
        error.message,
      )
      ;({ data: orders, error } = await supabase.rpc("create_order", {
        p_items: rpcArgs.p_items,
        p_note: note,
      }))
    }

    if (error) {
      const message = error.message ?? ""
      const code = message.includes("ORDER_FAILED:") ? message : ""
      console.error("[checkout] create_order failed:", message)
      return NextResponse.json(
        {
          error: code
            ? describeOrderError(code)
            : "Something went wrong placing your order.",
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

    // The confirmation screen promises "The shops have been notified" — make
    // it true. Fire-and-forget: a notification failure must never fail an
    // order that was already created.
    void notifyShops(supabase, rows).catch((err) =>
      console.error("[checkout] shop notifications failed:", err),
    )

    return NextResponse.json({ orders: rows })
  } catch (err) {
    console.error("[checkout] unhandled error:", err)
    return NextResponse.json(
      { error: "Something went wrong placing your order." },
      { status: 500 },
    )
  }
}

/** One in-app + push notification per shop, per order placed. */
async function notifyShops(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  orders: Array<{ id: string; reference: string; vendor_id: string; subtotal: number | string }>,
): Promise<void> {
  const vendorIds = [...new Set(orders.map((order) => order.vendor_id))]
  const { data: vendors, error } = await supabase
    .from("vendors")
    .select("id, user_id")
    .in("id", vendorIds)

  if (error) {
    console.error("[checkout] shop lookup for notifications failed:", error.message)
    return
  }

  const userIdByVendor = new Map(
    ((vendors ?? []) as Array<{ id: string; user_id: string | null }>).map((v) => [
      v.id,
      v.user_id,
    ]),
  )

  await Promise.all(
    orders.map((order) => {
      const userId = userIdByVendor.get(order.vendor_id)
      if (!userId) return Promise.resolve()
      const amount = Number(order.subtotal)
      return dispatchNotification(
        { userId },
        {
          type: "order",
          refId: `order-placed-${order.id}`,
          dedupeWindowHours: 0,
          title: `New order ${order.reference}`,
          body: `Worth $${amount.toFixed(2)} — open Orders to confirm it.`,
          link: "/vendor/orders",
        },
      ).catch((err) => console.error("[checkout] shop notify failed:", err))
    }),
  )
}
