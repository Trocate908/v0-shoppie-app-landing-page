import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import ProductDetailClient from "@/components/product-detail-client"

// Enable ISR with revalidation
export const revalidate = 3600 // Revalidate every hour
export const dynamicParams = true

// Generate static params for popular products
export async function generateStaticParams() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("products")
    .select("id")
    .limit(20) // Pre-render top 20 products
  
  return (data || []).map((product) => ({
    id: product.id,
  }))
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: product, error } = await supabase
    .from("products")
    .select(
      `
      id,
      name,
      description,
      price,
      image_url,
      image_urls,
      in_stock,
      vendor:vendors!inner(
        id,
        shop_name,
        is_open,
        is_verified,
        verification_expires_at,
        whatsapp_number,
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

  const { data: relatedProducts } = await supabase
    .from("products")
    .select(
      `
      id,
      name,
      description,
      price,
      image_url,
      image_urls,
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
