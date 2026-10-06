import { createServerClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import OrderDetailsClient, { type OrderDetails } from "@/components/order-details-client"

export const metadata = {
  title: "Order Details - ShoppieApp",
  description: "View the items, totals, and status of your order",
}

export default async function OrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/vendor/login")
  }

  // RLS only exposes orders where the caller is the buyer (or their vendor);
  // combined with the buyer_id filter this returns null for anyone else —
  // which we surface as a 404 rather than leaking existence.
  const { data: order } = await supabase
    .from("orders")
    .select(
      `
      id,
      reference,
      status,
      subtotal,
      customer_note,
      source,
      created_at,
      confirmed_at,
      delivered_at,
      cancelled_at,
      vendor:vendors (
        id,
        shop_name,
        slug,
        profile_picture_url,
        whatsapp_number,
        user_id,
        is_verified,
        verification_expires_at
      ),
      order_items (
        id,
        product_id,
        product_name,
        product_image,
        unit_price,
        quantity,
        line_total
      )
    `,
    )
    .eq("id", id)
    .eq("buyer_id", user.id)
    .maybeSingle()

  if (!order) {
    notFound()
  }

  // PostgREST returns the embedded vendor as an object (many-to-one) while
  // the untyped client conservatively infers an array — normalise the shape.
  const row = order as unknown as OrderDetails

  return <OrderDetailsClient order={row} />
}
