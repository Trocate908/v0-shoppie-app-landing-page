import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import ProductDetailClient from "@/components/product-detail-client"

export const revalidate = 300
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
      images: product.image_url ? [{ url: product.image_url, width: 800, height: 800, alt: product.name }] : [],
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
    .select(`
      id, name, description, price, image_url, image_urls, in_stock, category,
      vendor:vendors!inner(
        id, user_id, shop_name, is_open, is_verified, verification_expires_at,
        whatsapp_number,
        location:locations!inner(id, country, city, market_name)
      )
    `)
    .eq("id", id)
    .single()

  if (error || !product) notFound()

  // Fetch same-category products AND same-vendor products in parallel
  const [{ data: categoryProducts }, { data: vendorProducts }] = await Promise.all([
    // Same category products from any shop (excluding current product)
    product.category
      ? supabase
          .from("products")
          .select(`id, name, description, price, image_url, image_urls, in_stock, category,
            vendor:vendors!inner(id, shop_name, is_open)`)
          .eq("category", product.category)
          .eq("in_stock", true)
          .neq("id", id)
          .order("created_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),

    // Same vendor products (for padding if category doesn't fill 8 slots)
    supabase
      .from("products")
      .select(`id, name, description, price, image_url, image_urls, in_stock, category,
        vendor:vendors!inner(id, shop_name, is_open)`)
      .eq("vendor_id", product.vendor.id)
      .neq("id", id)
      .order("created_at", { ascending: false })
      .limit(8),
  ])

  // Merge: same-category first, then fill with vendor products, dedup by id, cap at 8
  const seen = new Set<string>()
  const merged: typeof categoryProducts = []

  for (const p of [...(categoryProducts ?? []), ...(vendorProducts ?? [])]) {
    if (!seen.has(p.id) && merged.length < 8) {
      seen.add(p.id)
      merged.push(p)
    }
  }

  return (
    <ProductDetailClient
      product={product as Parameters<typeof ProductDetailClient>[0]["product"]}
      relatedProducts={merged as Parameters<typeof ProductDetailClient>[0]["relatedProducts"]}
    />
  )
}
