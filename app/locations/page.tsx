import { createClient } from "@/lib/supabase/server"
import LocationSelector from "@/components/location-selector"
import ProfileButton from "@/components/profile-button"
import Link from "next/link"
import { Store } from "lucide-react"

export const metadata = {
  title: "Select Location - ShoppieApp",
  description: "Choose your country and market to find local products",
}

async function getLocations() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("locations")
      .select("id, country, city, market_name")
      .order("country")
      .order("city")
      .order("market_name")

    if (error) {
      console.error("[v0] Error fetching locations:", error)
      throw new Error(`Failed to fetch locations: ${error.message}`)
    }

    return data || []
  } catch (error) {
    console.error("[v0] Exception in getLocations:", error)
    return []
  }
}

export default async function LocationsPage() {
  const locations = await getLocations()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Store className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">ShoppieApp</h1>
            </Link>
            <ProfileButton />
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="text-center">
            <h2 className="text-balance text-2xl font-bold text-foreground sm:text-3xl">Find Products Near You</h2>
            <p className="mt-2 text-pretty text-muted-foreground">Select your location to browse available products</p>
          </div>

          {locations.length === 0 ? (
            <div className="mt-8 rounded-lg border border-border bg-card p-6 text-center">
              <p className="text-muted-foreground">
                No locations available yet. Vendors will create locations when they sign up.
              </p>
            </div>
          ) : (
            <div className="mt-8">
              <LocationSelector locations={locations} />
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border bg-background px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-muted-foreground">&copy; 2025 ShoppieApp. All rights reserved.</p>
            <div className="flex gap-4">
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
                Terms & Conditions
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
