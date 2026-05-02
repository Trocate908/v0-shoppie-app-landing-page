import { createServerClient } from "@/lib/supabase/server"
import { dispatchNotification } from "@/lib/notifications/dispatch"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

/**
 * POST /api/notifications/new-product
 *
 * Called by AddProductForm immediately after a product is successfully
 * inserted. Fires a push to all shoppers (once per day max, using
 * a daily refId so we don't spam users if many products are added in one day).
 *
 * Body: { productId, productName, shopName, imageUrl?, category? }
 */
export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: {
    productId?: string
    productName?: string
    shopName?: string
    imageUrl?: string | null
    category?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { productId, productName, shopName, imageUrl, category } = body
  if (!productId || !productName) {
    return NextResponse.json({ error: "productId and productName required" }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const vendorLabel = shopName?.trim() || "a local vendor"
  const categoryLabel = category?.trim() ? ` in ${category.trim()}` : ""

  dispatchNotification(
    { audience: "all_shoppers" },
    {
      type: "new_product",
      refId: `new-product-daily-${today}`,
      dedupeWindowHours: 22,
      title: `New product just added on ShoppieApp!`,
      body: `${vendorLabel} just listed "${productName}"${categoryLabel}. Tap to see it.`,
      url: `https://shoppieapp.co.zw/product/${productId}`,
      imageUrl: imageUrl ?? undefined,
    },
  ).catch((err) => console.error("[new-product notify] dispatch failed:", err))

  return NextResponse.json({ ok: true })
}
