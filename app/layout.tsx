import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Dancing_Script } from "next/font/google"
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"
import { WebVitals } from "./web-vitals"
import { PwaProvider } from "@/components/pwa-provider"
import InstallBanner from "@/components/install-banner"
import { NotificationProvider } from "@/components/notification-provider"
import "./globals.css"

const _geist = Geist({ 
  subsets: ["latin"],
  display: "swap",
  preload: true,
})
const _geistMono = Geist_Mono({ 
  subsets: ["latin"],
  display: "swap",
  preload: true,
})
const _dancingScript = Dancing_Script({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dancing",
})

const BASE_URL = "https://shoppieapp.co.zw"

export const metadata: Metadata = {
  title: "ShoppieApp - Find Local Products Near You",
  description: "Connect with local vendors and discover products in your area",
  generator: "v0.app",
  metadataBase: new URL(BASE_URL),
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
    shortcut: "/logo.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ShoppieApp",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "ShoppieApp",
    title: "ShoppieApp - Find Local Products Near You",
    description: "Connect with local vendors and discover products in your area",
    url: BASE_URL,
  },
  twitter: {
    card: "summary",
    title: "ShoppieApp",
    description: "Connect with local vendors and discover products in your area",
  },
  verification: {
    google: "kW0Ebp18QnxnqAPBGR1GxJzandt0F6vrZZ8C4wdbvOQ",
    other: {
      "msvalidate.01": "9946D807924AB47763F90C3042FDA1AD",
    },
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#ffffff" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ShoppieApp" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="msapplication-TileImage" content="/logo.png" />
        <meta name="msapplication-TileColor" content="#ffffff" />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <PwaProvider>
            <WebVitals />
            {children}
            <InstallBanner />
            <NotificationProvider />
            <Toaster />
          </PwaProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
