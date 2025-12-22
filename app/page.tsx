import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Store, User, MapPin } from "lucide-react"
import ProfileButton from "@/components/profile-button"
import Image from "next/image"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
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
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-background px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-8 flex justify-center">
              <Image src="/logo.png" alt="ShoppieApp" width={120} height={120} className="h-24 w-24 sm:h-30 sm:w-30" />
            </div>
            <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Find Local Products Near You
            </h2>
            <p className="mt-4 text-pretty text-base text-muted-foreground sm:mt-6 sm:text-lg">
              Connect with local vendors and discover products in your area
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/browse" className="w-full sm:w-auto">
                <Button size="lg" className="w-full gap-2 sm:w-auto">
                  <Store className="h-5 w-5" />
                  Browse All Products
                </Button>
              </Link>
              <Link href="/locations" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full gap-2 sm:w-auto bg-transparent">
                  <MapPin className="h-5 w-5" />
                  Find Products Near You
                </Button>
              </Link>
              <Link href="/vendor/login" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full gap-2 sm:w-auto bg-transparent">
                  <User className="h-5 w-5" />
                  Vendor Login
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="border-t border-border bg-muted/50 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <h3 className="text-balance text-center text-2xl font-bold text-foreground sm:text-3xl">How It Works</h3>
            <div className="mt-8 grid gap-6 sm:mt-12 sm:grid-cols-3 sm:gap-8">
              {/* Step 1 */}
              <div className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  1
                </div>
                <h4 className="mt-4 text-lg font-semibold text-foreground">Search Products</h4>
                <p className="mt-2 text-pretty text-sm text-muted-foreground">
                  Enter your location to find vendors and products available near you
                </p>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  2
                </div>
                <h4 className="mt-4 text-lg font-semibold text-foreground">Browse & Compare</h4>
                <p className="mt-2 text-pretty text-sm text-muted-foreground">
                  View product details, prices, and vendor information in one place
                </p>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  3
                </div>
                <h4 className="mt-4 text-lg font-semibold text-foreground">Connect Directly</h4>
                <p className="mt-2 text-pretty text-sm text-muted-foreground">
                  Contact vendors directly to complete your purchase or inquire about products
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl text-center">
          <p className="text-sm text-muted-foreground">&copy; 2025 ShoppieApp. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
