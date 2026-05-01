/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "hebbkx1anhila5yf.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "photos.pexels.com" },
      { protocol: "https", hostname: "**.pexels.com" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "@/components/ui"],
    serverActions: {
      allowedOrigins: ["*.vusercontent.net"],
    },
  },
  allowedDevOrigins: [
    "*.vusercontent.net",
    "*.dev-vm.vusercontent.net",
    "*.spock.replit.dev",
    "*.replit.dev",
    "*.repl.co",
  ],
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Service Worker must be served with no-cache so browsers always
        // fetch the latest version, and Service-Worker-Allowed: / so it
        // can claim the full origin (required by some browsers).
        source: "/sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        // Manifest must be served as application/manifest+json for PWA install.
        source: "/manifest.json",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
    ]
  },
}

export default nextConfig
