import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminEmail, logAuditAction } from "@/lib/admin"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const category = searchParams.get("category")
  const status = searchParams.get("status")
  const db = createAdminClient()

  let { data, error } = await db
    .from("products")
    .select("id, name, price, category, image_url, in_stock, is_hidden, is_featured, created_at, vendor_id, vendors(shop_name)")
    .order("created_at", { ascending: false })
    .limit(200)

  if (error?.code === "42703") {
    const fallback = await db
      .from("products")
      .select("id, name, price, category, image_url, in_stock, created_at, vendor_id, vendors(shop_name)")
      .order("created_at", { ascending: false })
      .limit(200)
    if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 })
    data = fallback.data?.map((p) => ({ ...p, is_hidden: false, is_featured: false })) as typeof data
    error = null
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let products = data ?? []
  if (category) products = products.filter((p) => p.category === category)
  if (status === "hidden") products = products.filter((p) => p.is_hidden)
  if (status === "featured") products = products.filter((p) => p.is_featured)
  if (status === "out_of_stock") products = products.filter((p) => !p.in_stock)

  return NextResponse.json({ products })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { action, productId } = await req.json()
  const db = createAdminClient()

  const updates: Record<string, unknown> = {}
  if (action === "hide") updates.is_hidden = true
  else if (action === "unhide") updates.is_hidden = false
  else if (action === "feature") updates.is_featured = true
  else if (action === "unfeature") updates.is_featured = false
  else if (action === "delete") {
    const { error } = await db.from("products").delete().eq("id", productId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logAuditAction({ adminId: user.id, adminEmail: user.email!, action: "delete_product", targetType: "product", targetId: productId })
    return NextResponse.json({ ok: true })
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }

  const { error } = await db.from("products").update(updates).eq("id", productId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAuditAction({ adminId: user.id, adminEmail: user.email!, action: `${action}_product`, targetType: "product", targetId: productId })
  return NextResponse.json({ ok: true })
}
