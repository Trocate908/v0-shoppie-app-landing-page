import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"
import { WebVitals } from "./web-vitals"
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
    icon: "/favicon.ico",
    apple: "/logo.png",
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
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <ThemeProvider>
          <WebVitals />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
