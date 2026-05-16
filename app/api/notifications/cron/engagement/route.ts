import { createClient } from "@/lib/supabase/server"
import { dispatchNotification } from "@/lib/notifications/dispatch"
import { NextResponse, type NextRequest } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

/**
 * GET/POST /api/notifications/cron/engagement
 *
 * Called daily by Vercel Cron. Sends three types of engagement pushes
 * to bring users back to ShoppieApp:
 *
 *  1. Trending products       → all shoppers
 *  2. "Your products are loved" → vendors with views in the last 7 days
 *  3. "Start posting today"     → vendors with 0 products
 *
 * Authenticated by the CRON_SECRET environment variable. Vercel Cron sets
 * the Authorization: Bearer ${CRON_SECRET} header automatically.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authz = req.headers.get("authorization")
  if (secret && authz !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const supabase = await createClient()
  const summary: Record<string, unknown> = {}

  // ── 1) Trending products → shoppers ────────────────────────────────
  const { data: trending } = await supabase.rpc("get_trending_products", { limit_count: 5 })
  if (trending && trending.length > 0) {
    const top = trending[0] as { product_id: string; product_name: string; image_url: string | null; view_count: number }
    const otherCount = Math.max(0, trending.length - 1)
    const title = "New trending products on ShoppieApp"
    const body = otherCount > 0
      ? `"${top.product_name}" is hot right now — plus ${otherCount} more trending products near you.`
      : `"${top.product_name}" is trending. Tap to check it out.`

    summary.trending = await dispatchNotification(
      { audience: "all_shoppers" },
      {
        type: "trending",
        refId: `trending-${new Date().toISOString().slice(0, 10)}`,
        title,
        body,
        link: `/product/${top.product_id}`,
        imageUrl: top.image_url ?? undefined,
        dedupeWindowHours: 22,
      },
    )
  }

  // ── 2) "Your products are loved" → active vendors ──────────────────
  // Vendors whose products have been viewed in the last 7 days.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentViews } = await supabase
    .from("product_views")
    .select("product_id, products!inner(vendor_id, vendors!inner(user_id, shop_name))")
    .gte("viewed_at", sevenDaysAgo)
    .limit(5000)

  const vendorViewCounts = new Map<string, { userId: string; shopName: string; views: number }>()
  type ViewRow = {
    products: {
      vendor_id: string
      vendors: { user_id: string | null; shop_name: string | null }
    } | null
  }
  ;(recentViews as ViewRow[] | null)?.forEach((row) => {
    const vendor = row?.products?.vendors
    const vendorId = row?.products?.vendor_id
    if (!vendor?.user_id || !vendorId) return
    const existing = vendorViewCounts.get(vendorId) ?? {
      userId: vendor.user_id,
      shopName: vendor.shop_name ?? "your shop",
      views: 0,
    }
    existing.views += 1
    vendorViewCounts.set(vendorId, existing)
  })

  const lovedResults: unknown[] = []
  for (const [, info] of vendorViewCounts.entries()) {
    if (info.views < 5) continue // require some traction
    const r = await dispatchNotification(
      { userId: info.userId },
      {
        type: "product_loved",
        refId: `loved-${new Date().toISOString().slice(0, 10)}`,
        title: `Shoppers are loving ${info.shopName}!`,
        body: `Your products have ${info.views} new views this week. Keep posting to stay featured.`,
        link: "/vendor/dashboard",
        dedupeWindowHours: 70, // every ~3 days
      },
    )
    lovedResults.push(r)
  }
  summary.product_loved = { vendorsNotified: lovedResults.length }

  // ── 3) "Start posting today" → empty-shop vendors ──────────────────
  summary.start_posting = await dispatchNotification(
    { audience: "all_vendors_without_products" },
    {
      type: "start_posting",
      refId: `start-${new Date().toISOString().slice(0, 7)}`, // monthly cadence
      title: "Your shop is waiting on you",
      body: "Other vendors are getting orders. Add your first product in 60 seconds and start selling on ShoppieApp.",
      link: "/vendor/products/add",
      dedupeWindowHours: 24 * 7, // weekly
    },
  )

  return NextResponse.json({ ok: true, summary })
}

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}
