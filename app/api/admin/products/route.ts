import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminEmail, logAuditAction } from "@/lib/admin"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = createAdminClient()
  const { searchParams } = new URL(req.url)
  const category = searchParams.get("category")
  const status = searchParams.get("status")

  // Try with admin columns first; fall back if columns don't exist yet
  let products: unknown[] | null = null
  let { data, error } = await db
    .from("products")
    .select(`id, name, price, category, image_url, in_stock, is_hidden, is_featured, created_at, vendor_id, vendors(shop_name)`)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error?.code === "42703") {
    // Columns not yet added — fetch without them
    const fallback = await db
      .from("products")
      .select(`id, name, price, category, image_url, in_stock, created_at, vendor_id, vendors(shop_name)`)
      .order("created_at", { ascending: false })
      .limit(200)
    if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 })
    products = fallback.data?.map(p => ({ ...p, is_hidden: false, is_featured: false })) ?? []
  } else if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    if (status === "hidden") data = data?.filter(p => p.is_hidden) ?? []
    if (status === "featured") data = data?.filter(p => p.is_featured) ?? []
    if (status === "out_of_stock") data = data?.filter(p => !p.in_stock) ?? []
    products = data ?? []
  }

  return NextResponse.json({ products: products })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: adminUser } } = await supabase.auth.getUser()
  if (!adminUser || !isAdminEmail(adminUser.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { action, productId } = await req.json()
  const db = createAdminClient()

  if (action === "hide") {
    const { error } = await db.from("products").update({ is_hidden: true }).eq("id", productId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (action === "restore") {
    const { error } = await db.from("products").update({ is_hidden: false }).eq("id", productId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (action === "feature") {
    const { error } = await db.from("products").update({ is_featured: true }).eq("id", productId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (action === "unfeature") {
    const { error } = await db.from("products").update({ is_featured: false }).eq("id", productId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (action === "delete") {
    const { error } = await db.from("products").delete().eq("id", productId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }

  await logAuditAction({
    adminId: adminUser.id,
    adminEmail: adminUser.email!,
    action: `product_${action}`,
    targetType: "product",
    targetId: productId,
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
