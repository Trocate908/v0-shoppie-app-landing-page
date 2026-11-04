import Link from "next/link"
import Image from "next/image"
import ProfileButton from "@/components/profile-button"
import { Globe, Sparkles } from "lucide-react"
import type { Metadata } from "next"
import { AppFooter } from "@/components/app-footer"

export const metadata: Metadata = {
  title: "About ShoppieApp - Connecting Local Vendors with Buyers",
  description:
    "ShoppieApp connects local vendors with buyers across communities. Empowering small businesses with a digital storefront and seamless community commerce.",
  keywords: "ShoppieApp, local marketplace, vendors, buyers, community commerce",
  publisher: "ShoppieApp",
  alternates: {
    canonical: "https://shoppieapp.co.zw/about",
  },
  openGraph: {
    title: "About ShoppieApp - Connecting Local Vendors with Buyers",
    description:
      "ShoppieApp connects local vendors with buyers across communities. Empowering small businesses with a digital storefront and seamless community commerce.",
    locale: "en_US",
    siteName: "ShoppieApp",
  },
  twitter: {
    card: "summary_large_image",
    title: "About ShoppieApp - Connecting Local Vendors with Buyers",
    description:
      "ShoppieApp connects local vendors with buyers across communities. Empowering small businesses with a digital storefront and seamless community commerce.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
}

export default function AboutPage() {
  return (
    <>
      <div className="flex min-h-screen flex-col bg-background">
        {/* Header */}
        <header className="border-b border-border bg-background">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <Image
                  src="/logo.png"
                  alt="ShoppieApp"
                  width={32}
                  height={32}
                  className="h-8 w-8"
                />
                <h1 className="text-xl font-bold text-foreground">ShoppieApp</h1>
              </Link>
              <ProfileButton />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            {/* Hero Section */}
            <div className="text-center mb-12">
              <div className="flex justify-center mb-6">
                <Image
                  src="/logo.png"
                  alt="ShoppieApp Logo"
                  width={120}
                  height={120}
                  className="h-30 w-30"
                />
              </div>
              <h1 className="text-3xl font-bold text-foreground sm:text-4xl mb-4">
                About ShoppieApp
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Connecting Local Vendors with Buyers Across Communities
              </p>
            </div>

            {/* Mission Section */}
            <div className="mb-12 rounded-lg border border-border bg-card p-6 sm:p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-4">
                    Our Mission
                  </h2>
                  <p className="text-base text-muted-foreground leading-relaxed mb-4">
                    ShoppieApp is a revolutionary platform designed to bridge the gap
                    between local vendors and buyers. We empower small businesses by
                    providing them with a digital storefront to showcase their products,
                    while making it incredibly easy for buyers to discover and purchase
                    items from trusted vendors in their community.
                  </p>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    Our mission is to support local economies, promote entrepreneurship,
                    and create seamless shopping experiences that benefit both vendors and
                    customers. With features like product verification, multi-image
                    galleries, and direct WhatsApp communication, we're transforming how
                    communities shop and do business.
                  </p>
                </div>
              </div>
            </div>

            {/* What We Offer */}
            <div className="mb-12 rounded-lg border border-border bg-gradient-to-br from-primary/5 to-primary/10 p-6 sm:p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">What We Offer</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-background p-4">
                  <h3 className="font-semibold text-foreground mb-2">For Vendors</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Digital storefront with unlimited products</li>
                    <li>• Product verification badges</li>
                    <li>• Multi-image product galleries</li>
                    <li>• Direct customer communication via WhatsApp</li>
                    <li>• Analytics and insights</li>
                  </ul>
                </div>
                <div className="rounded-lg bg-background p-4">
                  <h3 className="font-semibold text-foreground mb-2">For Buyers</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Location-based product search</li>
                    <li>• Browse verified vendors</li>
                    <li>• Product comparisons</li>
                    <li>• Wishlist and favorites</li>
                    <li>• Direct vendor contact</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Vision Section */}
            <div className="mb-12 rounded-lg border border-border bg-card p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">Our Vision</h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                We envision a future where every local vendor, regardless of size or
                technical expertise, has the tools to succeed in the digital marketplace.
                ShoppieApp is more than just a platform—it's a movement to strengthen
                local economies, preserve community connections, and make commerce more
                accessible and inclusive for everyone.
              </p>
            </div>
          </div>
        </main>

        <AppFooter />
      </div>
    </>
  )
}
