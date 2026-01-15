import type { MetadataRoute } from "next"
import { createClient } from "@/lib/supabase/server"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://shoppieapp.co.zw" // Updated to actual production domain

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/browse`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/locations`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/vendor/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/vendor/signup`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ]

  try {
    const supabase = createClient()

    const { data: products } = await supabase.from("products").select("id, updated_at").eq("in_stock", true).limit(1000) // Limit for performance

    const productPages: MetadataRoute.Sitemap =
      products?.map((product) => ({
        url: `${baseUrl}/product/${product.id}`,
        lastModified: new Date(product.updated_at || new Date()),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })) || []

    return [...staticPages, ...productPages]
  } catch (error) {
    console.error("[v0] Error generating sitemap:", error)
    return staticPages
  }
}
