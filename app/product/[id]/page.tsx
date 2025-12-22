import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import ProductDetailClient from "@/components/product-detail-client"

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch the main product
  const { data: product, error } = await supabase
    .from("products")
    .select(
      `
      id,
      name,
      description,
      price,
      image_url,
      in_stock,
      vendor:vendors!inner(
        id,
        shop_name,
        is_open,
        location:locations!inner(
          id,
          country,
          city,
          market_name
        )
      )
    `,
    )
    .eq("id", id)
    .single()

  if (error || !product) {
    notFound()
  }

  // Fetch related products from the same vendor
  const { data: relatedProducts } = await supabase
    .from("products")
    .select(
      `
      id,
      name,
      description,
      price,
      image_url,
      in_stock,
      vendor:vendors!inner(
        id,
        shop_name,
        is_open
      )
    `,
    )
    .eq("vendor_id", product.vendor.id)
    .neq("id", id)
    .limit(8)

  return <ProductDetailClient product={product} relatedProducts={relatedProducts || []} />
}
