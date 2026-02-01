import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/vendor/dashboard", "/vendor/products", "/vendor/add-product", "/wishlist"],
      },
    ],
    sitemap: "https://shoppieapp.co.zw/sitemap.xml", // Replace with your actual domain
  }
}
