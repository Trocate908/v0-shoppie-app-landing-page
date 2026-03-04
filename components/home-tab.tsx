"use client"

import { Store, MapPin, User, Search, ShieldCheck, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"
import type { NavTab } from "@/components/bottom-nav"

interface HomeTabProps {
  onNavigate: (tab: NavTab) => void
}

export default function HomeTab({ onNavigate }: HomeTabProps) {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="ShoppieApp" width={28} height={28} className="h-7 w-7" priority />
            <span className="text-lg font-bold text-foreground">ShoppieApp</span>
          </div>
          <Link
            href="/vendor/login"
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            Vendor Login
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="px-6 pb-10 pt-12 text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/10">
            <Image src="/logo.png" alt="ShoppieApp" width={56} height={56} className="h-14 w-14" priority />
          </div>
          <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Find Local Products Near You
          </h1>
          <p className="mt-3 text-pretty text-base text-muted-foreground">
            Connect with trusted local vendors and discover products in your community
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="w-full gap-2 sm:w-auto"
              onClick={() => onNavigate("store")}
            >
              <Store className="h-5 w-5" />
              Browse Products
            </Button>
            <Link href="/locations" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full gap-2 bg-transparent">
                <MapPin className="h-5 w-5" />
                Find Products Near You
              </Button>
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-border bg-muted/40 px-4 py-10">
          <h2 className="mb-6 text-center text-xl font-bold text-foreground">Why ShoppieApp?</h2>
          <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-3">
            {[
              {
                icon: Search,
                title: "Easy Discovery",
                desc: "Search products from hundreds of local vendors in one place",
              },
              {
                icon: ShieldCheck,
                title: "Verified Vendors",
                desc: "Shop with confidence from verified and trusted sellers",
              },
              {
                icon: Zap,
                title: "Direct Contact",
                desc: "Message vendors directly on WhatsApp to complete purchases",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex flex-col items-center rounded-xl border border-border bg-card p-5 text-center"
              >
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-1 text-sm font-semibold text-foreground">{title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="px-4 py-10">
          <h2 className="mb-6 text-center text-xl font-bold text-foreground">How It Works</h2>
          <ol className="mx-auto max-w-md space-y-4">
            {[
              { step: "1", title: "Browse the Store", desc: "Tap the Store tab to see all available products" },
              { step: "2", title: "Find What You Need", desc: "Filter by location, category, or search by name" },
              { step: "3", title: "Contact the Vendor", desc: "Tap WhatsApp to message the seller directly" },
            ].map(({ step, title, desc }) => (
              <li key={step} className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {step}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{title}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Vendor CTA */}
        <section className="mx-4 mb-6 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-6 text-center">
          <User className="mx-auto mb-3 h-8 w-8 text-primary" />
          <h3 className="mb-1 font-bold text-foreground">Are you a vendor?</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            List your products and reach thousands of customers in your area
          </p>
          <Link href="/vendor/signup">
            <Button variant="default" size="sm" className="gap-2">
              Register Your Shop
            </Button>
          </Link>
        </section>
      </main>
    </div>
  )
}
