import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { dispatchNotification } from "@/lib/notifications/dispatch"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

/**
 * POST /api/notifications/new-product
 *
 * Called by AddProductForm immediately after a product is successfully
 * inserted. Does two things in parallel:
 *
 * 1. Fires a push to all shoppers (once per day max, using a daily refId
 *    so we don't spam users if many products are added in one day).
 *
 * 2. Fires an immediate, per-product push to every follower of the vendor's
 *    shop (no daily dedup — each new product is its own notification for
 *    people who explicitly chose to follow that shop).
 *
 * Body: { productId, productName, shopName, vendorId?, imageUrl?, category? }
 */
export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: {
    productId?: string
    productName?: string
    shopName?: string
    vendorId?: string
    imageUrl?: string | null
    category?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { productId, productName, shopName, vendorId, imageUrl, category } = body
  if (!productId || !productName) {
    return NextResponse.json({ error: "productId and productName required" }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const vendorLabel = shopName?.trim() || "a local vendor"
  const categoryLabel = category?.trim() ? ` in ${category.trim()}` : ""
  const productUrl = `https://shoppieapp.co.zw/product/${productId}`

  const adminSupabase = createAdminClient()

  // 1. Broadcast to all shoppers (once per day)
  dispatchNotification(
    { audience: "all_shoppers" },
    {
      type: "new_product",
      refId: `new-product-daily-${today}`,
      dedupeWindowHours: 22,
      title: `New product just added on ShoppieApp!`,
      body: `${vendorLabel} just listed "${productName}"${categoryLabel}. Tap to see it.`,
      url: productUrl,
      imageUrl: imageUrl ?? undefined,
    },
  ).catch((err) => console.error("[new-product notify] broadcast failed:", err))

  // 2. Notify shop followers immediately (every new product, no daily dedup)
  if (vendorId) {
    adminSupabase
      .from("shop_follows")
      .select("user_id")
      .eq("vendor_id", vendorId)
      .then(({ data: follows }) => {
        if (!follows || follows.length === 0) return

        const followerIds = follows.map((f) => f.user_id as string).filter(Boolean)
        if (followerIds.length === 0) return

        return dispatchNotification(
          { userIds: followerIds },
          {
            type: "new_product",
            refId: `shop-follow-product-${productId}`,
            dedupeWindowHours: 0,
            title: `${vendorLabel} posted a new product!`,
            body: `"${productName}"${categoryLabel} — tap to check it out.`,
            link: productUrl,
            imageUrl: imageUrl ?? undefined,
          },
        )
      })
      .catch((err) => console.error("[new-product notify] follower dispatch failed:", err))
  }

  return NextResponse.json({ ok: true })
}
