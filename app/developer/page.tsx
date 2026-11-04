import Image from "next/image"
import { Mail, Phone, MessageCircle, Code2 } from "lucide-react"
import type { Metadata } from "next"
import { AppFooter } from "@/components/app-footer"
import Script from "next/script"

export const metadata: Metadata = {
  title: "Milton Mukundwa — Developer & Founder | ShoppieApp",
  description:
    "Milton Mukundwa is the software developer and founder of ShoppieApp, a platform connecting local vendors with buyers across communities in Zimbabwe.",
  keywords:
    "Milton Mukundwa, ShoppieApp developer, ShoppieApp founder, Zimbabwe software developer, ShoppieApp",
  authors: [{ name: "Milton Mukundwa", url: "mailto:miltonmukundwa6@gmail.com" }],
  creator: "Milton Mukundwa",
  publisher: "ShoppieApp",
  alternates: { canonical: "https://shoppieapp.co.zw/developer" },
  openGraph: {
    title: "Milton Mukundwa — Developer & Founder | ShoppieApp",
    description:
      "Meet Milton Mukundwa, the young software developer and founder behind ShoppieApp.",
    type: "profile",
    locale: "en_US",
    siteName: "ShoppieApp",
  },
  twitter: {
    card: "summary_large_image",
    title: "Milton Mukundwa — Developer & Founder | ShoppieApp",
    description:
      "Meet Milton Mukundwa, the software developer and founder behind ShoppieApp.",
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

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      name: "Milton Mukundwa",
      birthDate: "2008-11-30",
      jobTitle: "Software Developer & Founder",
      email: "miltonmukundwa6@gmail.com",
      telephone: "+263789648840",
      url: "https://shoppieapp.co.zw/developer",
      nationality: "Zimbabwe",
      description:
        "Young software developer from Zimbabwe, founder of ShoppieApp — a platform connecting local vendors with buyers.",
      sameAs: ["https://wa.me/263789648840"],
      worksFor: {
        "@type": "Organization",
        name: "ShoppieApp",
      },
      contactPoint: [
        {
          "@type": "ContactPoint",
          telephone: "+263789648840",
          contactType: "Customer Service",
          availableLanguage: ["English"],
          contactOption: "WhatsApp",
        },
        {
          "@type": "ContactPoint",
          telephone: "+263789648840",
          contactType: "Technical Support",
          availableLanguage: ["English"],
          contactOption: "Telephone",
        },
      ],
    },
    {
      "@type": "Organization",
      name: "ShoppieApp",
      url: "https://shoppieapp.co.zw",
      logo: "https://shoppieapp.co.zw/logo.png",
      description: "Connecting Local Vendors with Buyers Across Communities",
      founder: {
        "@type": "Person",
        name: "Milton Mukundwa",
      },
      email: "miltonmukundwa6@gmail.com",
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+263789648840",
        contactType: "Customer Support",
        email: "miltonmukundwa6@gmail.com",
        availableLanguage: ["English"],
      },
      address: {
        "@type": "PostalAddress",
        addressCountry: "ZW",
      },
    },
    {
      "@type": "WebPage",
      name: "Milton Mukundwa — Developer & Founder",
      description:
        "Learn about Milton Mukundwa, the software developer and founder of ShoppieApp.",
      url: "https://shoppieapp.co.zw/developer",
      inLanguage: "en-US",
      isPartOf: {
        "@type": "WebSite",
        name: "ShoppieApp",
        url: "https://shoppieapp.co.zw",
      },
    },
  ],
}

export default function DeveloperPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="ShoppieApp"
                width={32}
                height={32}
                className="h-8 w-8"
              />
              <span className="text-xl font-bold">ShoppieApp</span>
            </a>
          </div>
        </div>
      </header>
      <Script
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Main Content */}
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          {/* Hero */}
          <div className="text-center mb-12">
            <Image
              src="/logo.png"
              alt="ShoppieApp Logo"
              width={120}
              height={120}
              className="h-30 w-30 mx-auto mb-6"
            />
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl mb-4">
              The Developer Behind ShoppieApp
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              The person, the work, and how to reach them.
            </p>
          </div>

          {/* Founder / bio */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
              Meet the Founder
            </h2>

            <div className="rounded-lg border border-border bg-card p-6 sm:p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Code2 className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground mb-1">
                    Milton Mukundwa
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Software Developer &amp; Founder
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Born: November 30, 2008 · Zimbabwe
                  </p>
                </div>
              </div>

              {/* Bio */}
              <div className="mb-6 border-l-4 border-primary pl-4 py-2">
                <p className="text-base text-foreground leading-relaxed mb-4">
                  As a young software developer from Zimbabwe, I believe that
                  technology has the power to transform communities and create
                  opportunities where they didn&apos;t exist before. ShoppieApp is
                  my commitment to empowering local businesses and making digital
                  commerce accessible to everyone, regardless of their technical
                  background.
                </p>
                <p className="text-base text-foreground leading-relaxed">
                  I started ShoppieApp with a simple vision: to help local vendors
                  compete in the digital age while maintaining the personal touch that
                  makes community commerce special. Every feature we build is designed
                  with both vendors and customers in mind, ensuring that technology
                  serves people, not the other way around.
                </p>
              </div>

              {/* Contact Information */}
              <div>
                <h4 className="text-lg font-semibold text-foreground mb-4">
                  Get in Touch with the Developer
                </h4>
                <div className="space-y-4">
                  {/* WhatsApp */}
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-background hover:bg-muted/50 transition-colors">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                      <MessageCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <h5 className="font-semibold text-foreground">WhatsApp</h5>
                      <a
                        href="https://wa.me/263789648840"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        +263 78 964 8840
                      </a>
                    </div>
                  </div>

                  {/* Call / SMS */}
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-background hover:bg-muted/50 transition-colors">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
                      <Phone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h5 className="font-semibold text-foreground">Call / SMS</h5>
                      <a
                        href="tel:+263789648840"
                        className="text-sm text-primary hover:underline"
                      >
                        +263 78 964 8840
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
                  I typically respond to inquiries within 24 hours. Feel free to
                  reach out for partnership opportunities, technical support, vendor
                  inquiries, or general questions about ShoppieApp.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  )
}
