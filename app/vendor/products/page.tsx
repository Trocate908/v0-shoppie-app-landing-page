import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ManageProductsClient } from "@/components/manage-products-client"

export default async function ManageProductsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/vendor/login")
  }

  // Fetch vendor data
  const { data: vendor } = await supabase.from("vendors").select("id, shop_name").eq("user_id", user.id).single()

  if (!vendor) {
    redirect("/vendor/signup")
  }

  // Fetch products
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("vendor_id", vendor.id)
    .order("created_at", { ascending: false })

  // For each product, get the view count
  const productsWithViews = await Promise.all(
    (products || []).map(async (product) => {
      const { count } = await supabase
        .from("product_views")
        .select("*", { count: "exact", head: true })
        .eq("product_id", product.id)

      return {
        ...product,
        view_count: count || 0,
      }
    }),
  )

  return <ManageProductsClient products={productsWithViews} shopName={vendor.shop_name} />
}
