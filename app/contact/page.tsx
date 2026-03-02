import Link from "next/link"
import Image from "next/image"
import ProfileButton from "@/components/profile-button"
import { Mail, Phone, MessageCircle } from "lucide-react"

export const metadata = {
  title: "Contact Us - ShoppieApp",
  description: "Get in touch with the ShoppieApp team and developer",
  alternates: {
    canonical: "https://shoppieapp.co.zw/contact",
  },
}

export default function ContactPage() {
  return (
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
          <div className="text-center mb-12">
            <div className="flex justify-center mb-6">
              <Image src="/logo.png" alt="ShoppieApp Logo" width={120} height={120} className="h-30 w-30" />
            </div>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl mb-4">ShoppieApp</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Connecting Local Vendors with Buyers Across Communities
            </p>
          </div>

          <div className="mb-12 rounded-lg border border-border bg-card p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">About ShoppieApp</h2>
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

          <div className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6 text-center">Meet the Developer</h2>

            <div className="rounded-lg border border-border bg-gradient-to-br from-primary/5 to-primary/10 p-6 sm:p-8">
              {/* Developer Info */}
              <div className="space-y-6">
                {/* Personal Information */}
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">Milton Mukundwa</h3>
                  <p className="text-sm text-muted-foreground">Born: November 30, 2008</p>
                </div>

                {/* Professional Bio */}
                <div className="border-l-4 border-primary pl-4 py-2">
                  <p className="text-base text-foreground italic leading-relaxed">
                    "As a young software developer from Zimbabwe, I believe that technology has the power to transform
                    communities and create opportunities where they didn't exist before. ShoppieApp is my commitment to
                    empowering local businesses and making digital commerce accessible to everyone, regardless of their
                    technical background."
                  </p>
                </div>

                {/* Contact Information */}
                <div>
                  <h4 className="text-lg font-semibold text-foreground mb-4">Get in Touch</h4>
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
                        <a href="tel:+263787795039" className="text-sm text-primary hover:underline">
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
                    opportunities, technical support, or general questions about ShoppieApp.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-muted-foreground">&copy; 2025 ShoppieApp. All rights reserved.</p>
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
  )
}
