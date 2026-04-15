import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import ProductDetailClient from "@/components/product-detail-client"

// Enable ISR with revalidation for better performance
export const revalidate = 300 // Revalidate every 5 minutes
export const dynamicParams = true
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: product } = await supabase
    .from("products")
    .select(`
      name,
      description,
      price,
      image_url,
      vendor:vendors!inner(shop_name, location:locations!inner(city))
    `)
    .eq("id", id)
    .single()

  if (!product) {
    return {
      title: "Product | Shoppie",
      alternates: { canonical: `https://shoppieapp.co.zw/product/${id}` },
    }
  }

  const url = `https://shoppieapp.co.zw/product/${id}`
  const title = `${product.name} – ${product.vendor.shop_name} | Shoppie`
  const description = product.description
    ? product.description.slice(0, 160)
    : `Buy ${product.name} from ${product.vendor.shop_name} in ${product.vendor.location.city} on Shoppie. Price: $${product.price}.`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Shoppie",
      type: "website",
      images: product.image_url
        ? [
            {
              url: product.image_url,
              width: 800,
              height: 800,
              alt: product.name,
            },
          ]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: product.image_url ? [product.image_url] : [],
    },
  }
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
        user_id,
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
