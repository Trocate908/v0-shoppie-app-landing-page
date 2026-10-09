import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import OrdersClient, { type OrderSummary } from "@/components/orders-client"

export const metadata = {
  title: "My Orders - ShoppieApp",
  description: "Track and review your ShoppieApp orders",
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ placed?: string }>
}) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/vendor/login")
  }

  const { placed } = await searchParams

  const { data: orders } = await supabase
    .from("orders")
    .select(
      `
      id,
      reference,
      status,
      fulfillment_type,
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
        profile_picture_url
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
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100)

  // PostgREST returns the embedded vendor as an object (many-to-one) while
  // the untyped client conservatively infers an array — normalise the shape.
  const rows = (orders ?? []) as unknown as OrderSummary[]

  return <OrdersClient orders={rows} placed={placed === "1"} />
}
