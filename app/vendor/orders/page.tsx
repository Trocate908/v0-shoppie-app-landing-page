import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { VendorOrdersClient } from "@/components/vendor-orders-client"
import type { VendorOrder } from "@/components/vendor-orders-client"

export const metadata = {
  title: "Orders - ShoppieApp",
  description: "View and manage incoming customer orders for your shop",
}

export default async function VendorOrdersPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) redirect("/vendor/login")

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, shop_name")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!vendor) redirect("/vendor/dashboard")

  // RLS scopes this to the caller's own shop; the explicit vendor_id filter
  // keeps the query index-friendly on top of it.
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
      delivery_address,
      payment_method,
      cancelled_by,
      source,
      created_at,
      confirmed_at,
      delivered_at,
      cancelled_at,
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
    .eq("vendor_id", vendor.id)
    .order("created_at", { ascending: false })
    .limit(200)

  // PostgREST returns the embedded vendor as an object (many-to-one) while
  // the untyped client conservatively infers an array — normalise the shape.
  const rows = (orders ?? []) as unknown as VendorOrder[]

  return <VendorOrdersClient orders={rows} shopName={vendor.shop_name} />
}
