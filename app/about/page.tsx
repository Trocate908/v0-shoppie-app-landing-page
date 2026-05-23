import Link from "next/link"
import Image from "next/image"
import ProfileButton from "@/components/profile-button"
import { Mail, Phone, MessageCircle, Code2, Globe, Sparkles } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "About Us - ShoppieApp | Milton Mukundwa - Developer & Founder",
  description: "Learn about ShoppieApp and its founder Milton Mukundwa, a young software developer from Zimbabwe born November 30, 2008. Connecting local vendors with buyers across communities.",
  keywords: "Milton Mukundwa, ShoppieApp developer, ShoppieApp founder, Zimbabwe software developer, local marketplace, vendor platform, ShoppieApp owner, ShoppieApp contact",
  authors: [{ name: "Milton Mukundwa", url: "mailto:miltonmukundwa6@gmail.com" }],
  creator: "Milton Mukundwa",
  publisher: "ShoppieApp",
  alternates: {
    canonical: "https://shoppieapp.co.zw/about",
  },
  openGraph: {
    title: "About ShoppieApp - Milton Mukundwa | Founder & Developer",
    description: "Meet Milton Mukundwa, the young developer behind ShoppieApp. Born November 30, 2008, empowering local businesses through technology.",
    type: "profile",
    locale: "en_US",
    siteName: "ShoppieApp",
  },
  twitter: {
    card: "summary_large_image",
    title: "About ShoppieApp - Milton Mukundwa | Founder & Developer",
    description: "Meet the developer behind ShoppieApp - empowering local vendors and communities through technology.",
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
  // Structured data for Google rich results
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        name: "Milton Mukundwa",
        birthDate: "2008-11-30",
        jobTitle: "Software Developer & Founder",
        email: "miltonmukundwa6@gmail.com",
        telephone: "+263787795039",
        url: "https://shoppieapp.com/about",
        nationality: "Zimbabwe",
        description: "Young software developer from Zimbabwe, founder of ShoppieApp - a platform connecting local vendors with buyers",
        sameAs: [
          "https://wa.me/263715907468"
        ],
        worksFor: {
          "@type": "Organization",
          name: "ShoppieApp"
        },
        contactPoint: [
          {
            "@type": "ContactPoint",
            telephone: "+263787795039",
            contactType: "Customer Service",
            availableLanguage: ["English"]
          },
          {
            "@type": "ContactPoint",
            telephone: "+263715907468",
            contactType: "Technical Support",
            availableLanguage: ["English"],
            contactOption: "WhatsApp"
          }
        ]
      },
      {
        "@type": "Organization",
        name: "ShoppieApp",
        url: "https://shoppieapp.com",
        logo: "https://shoppieapp.com/logo.png",
        description: "Connecting Local Vendors with Buyers Across Communities",
        founder: {
          "@type": "Person",
          name: "Milton Mukundwa"
        },
        email: "miltonmukundwa6@gmail.com",
        contactPoint: {
          "@type": "ContactPoint",
          telephone: "+263787795039",
          contactType: "Customer Support",
          email: "miltonmukundwa6@gmail.com",
          availableLanguage: ["English"]
        },
        address: {
          "@type": "PostalAddress",
          addressCountry: "ZW"
        }
      },
      {
        "@type": "WebPage",
        name: "About ShoppieApp",
        description: "Learn about ShoppieApp and its founder Milton Mukundwa",
        url: "https://shoppieapp.com/about",
        inLanguage: "en-US",
        isPartOf: {
          "@type": "WebSite",
          name: "ShoppieApp",
          url: "https://shoppieapp.com"
        }
      }
    ]
  }

  return (
    <>
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="flex min-h-screen flex-col bg-background">
        {/* Header */}
        <header className="border-b border-border bg-background">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <Image src="/logo.png" alt="ShoppieApp" width={32} height={32} className="h-8 w-8" />
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
                <Image src="/logo.png" alt="ShoppieApp Logo" width={120} height={120} className="h-30 w-30" />
              </div>
              <h1 className="text-3xl font-bold text-foreground sm:text-4xl mb-4">About ShoppieApp</h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Empowering Local Communities Through Technology
              </p>
            </div>

            {/* Mission Section */}
            <div className="mb-12 rounded-lg border border-border bg-card p-6 sm:p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-4">Our Mission</h2>
                  <p className="text-base text-muted-foreground leading-relaxed mb-4">
                    ShoppieApp is a revolutionary platform designed to bridge the gap between local vendors and buyers. We
                    empower small businesses by providing them with a digital storefront to showcase their products, while
                    making it incredibly easy for buyers to discover and purchase items from trusted vendors in their
                    community.
                  </p>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    Our mission is to support local economies, promote entrepreneurship, and create seamless shopping
                    experiences that benefit both vendors and customers. With features like product verification, multi-image
                    galleries, and direct WhatsApp communication, we're transforming how communities shop and do business.
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

            {/* Founder Section */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-foreground mb-6 text-center">Meet the Founder</h2>

              <div className="rounded-lg border border-border bg-card p-6 sm:p-8">
                <div className="flex items-start gap-4 mb-6">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Code2 className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-foreground mb-1">Milton Mukundwa</h3>
                    <p className="text-sm text-muted-foreground mb-2">Software Developer & Founder</p>
                    <p className="text-sm text-muted-foreground">Born: November 30, 2008 | Zimbabwe</p>
                  </div>
                </div>

                {/* Bio */}
                <div className="mb-6 border-l-4 border-primary pl-4 py-2">
                  <p className="text-base text-foreground leading-relaxed mb-4">
                    As a young software developer from Zimbabwe, I believe that technology has the power to transform
                    communities and create opportunities where they didn't exist before. ShoppieApp is my commitment to
                    empowering local businesses and making digital commerce accessible to everyone, regardless of their
                    technical background.
                  </p>
                  <p className="text-base text-foreground leading-relaxed">
                    I started ShoppieApp with a simple vision: to help local vendors compete in the digital age while
                    maintaining the personal touch that makes community commerce special. Every feature we build is
                    designed with both vendors and customers in mind, ensuring that technology serves people, not the
                    other way around.
                  </p>
                </div>

                {/* Contact Information */}
                <div>
                  <h4 className="text-lg font-semibold text-foreground mb-4">Get in Touch with the Developer</h4>
                  <div className="space-y-4">
                    {/* WhatsApp */}
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-background hover:bg-muted/50 transition-colors">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                        <MessageCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1">
                        <h5 className="font-semibold text-foreground">WhatsApp</h5>
                        <a
                          href="https://wa.me/263715907468"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                          itemProp="telephone"
                        >
                          +263 71 590 7468
                        </a>
                      </div>
                    </div>

                    {/* Call/SMS */}
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-background hover:bg-muted/50 transition-colors">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
                        <Phone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <h5 className="font-semibold text-foreground">Call / SMS</h5>
                        <a href="tel:+263787795039" className="text-sm text-primary hover:underline" itemProp="telephone">
                          +263 78 779 5039
                        </a>
                      </div>
                    </div>

                    {/* Email */}
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-background hover:bg-muted/50 transition-colors">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/20">
                        <Mail className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <h5 className="font-semibold text-foreground">Email</h5>
                        <a
                          href="mailto:miltonmukundwa6@gmail.com"
                          className="text-sm text-primary hover:underline break-all"
                          itemProp="email"
                        >
                          miltonmukundwa6@gmail.com
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Response Time Notice */}
                <div className="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm text-muted-foreground text-center">
                    I typically respond to inquiries within 24 hours. Feel free to reach out for partnership
                    opportunities, technical support, vendor inquiries, or general questions about ShoppieApp.
                  </p>
                </div>
              </div>
            </div>

            {/* Vision Section */}
            <div className="mb-12 rounded-lg border border-border bg-card p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">Our Vision</h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                We envision a future where every local vendor, regardless of size or technical expertise, has the tools
                to succeed in the digital marketplace. ShoppieApp is more than just a platform—it's a movement to
                strengthen local economies, preserve community connections, and make commerce more accessible and
                inclusive for everyone.
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border bg-background px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <p className="text-sm text-muted-foreground">&copy; 2026 ShoppieApp. All rights reserved.</p>
              <div className="flex gap-4">
                <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground">
                  About Us
                </Link>
                <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
                  Terms & Conditions
                </Link>
                <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground">
                  Contact
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
