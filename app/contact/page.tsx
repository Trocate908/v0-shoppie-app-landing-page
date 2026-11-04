import Link from "next/link"
import Image from "next/image"
import ProfileButton from "@/components/profile-button"
import { Mail, Phone, MessageCircle } from "lucide-react"
import { AppFooter } from "@/components/app-footer"

export const metadata = {
  title: "Contact Us - ShoppieApp",
  description:
    "Get in touch with the ShoppieApp team via WhatsApp, phone, or email.",
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
          {/* Hero */}
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
              ShoppieApp
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Connecting Local Vendors with Buyers Across Communities
            </p>
          </div>

          {/* Get in Touch */}
          <div className="mb-12 rounded-lg border border-border bg-card p-6 sm:p-8 text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Get in Touch
            </h2>
            <p className="text-base text-muted-foreground mb-6">
              Reach out to the ShoppieApp team using any of the options below.
            </p>

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

            {/* Response Time Notice */}
            <div className="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm text-muted-foreground text-center">
                We typically respond to inquiries within 24 hours. Feel free to reach
                out for partnership opportunities, technical support, vendor inquiries,
                or general questions about ShoppieApp.
              </p>
            </div>
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  )
}
