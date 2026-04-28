import type { MetadataRoute } from "next"
import { createClient } from "@supabase/supabase-js"

// Revalidate sitemap daily (in seconds)
export const revalidate = 86400

const LAST_MODIFIED = new Date("2026-04-25")
const BASE_URL = "https://shoppieapp.co.zw"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: LAST_MODIFIED,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/browse`,
      lastModified: LAST_MODIFIED,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/locations`,
      lastModified: LAST_MODIFIED,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/vendor/login`,
      lastModified: LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/vendor/signup`,
      lastModified: LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ]

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.warn("Supabase credentials not configured, returning static pages only")
      return staticPages
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch all in-stock products (increased limit for better coverage)
    const { data: products, error } = await supabase
      .from("products")
      .select("id, updated_at")
      .eq("in_stock", true)
      .order("updated_at", { ascending: false })
      .limit(1000)

    if (error) {
      console.error("Error fetching products for sitemap:", error)
      return staticPages
    }

    const productPages: MetadataRoute.Sitemap =
      products?.map((product) => ({
        url: `${BASE_URL}/product/${product.id}`,
        lastModified: product.updated_at ? new Date(product.updated_at) : LAST_MODIFIED,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })) || []

    return [...staticPages, ...productPages]
  } catch (error) {
    console.error("Sitemap generation error:", error)
    return staticPages
  }
}
