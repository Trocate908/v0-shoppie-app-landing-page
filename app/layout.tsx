import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "ShoppieApp - Find Local Products Near You",
  description: "Connect with local vendors and discover products in your area",
  generator: "v0.app",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
