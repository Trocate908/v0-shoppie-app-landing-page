/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'hebbkx1anhila5yf.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'photos.pexels.com' },
      { protocol: 'https', hostname: '**.pexels.com' },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@/components/ui'],
    serverActions: {
      allowedOrigins: ['*.vusercontent.net'],
    },
  },
  allowedDevOrigins: ['*.vusercontent.net', '*.dev-vm.vusercontent.net'],
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
}

export default nextConfig
