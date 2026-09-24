import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Compass, SearchX } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <SearchX className="h-9 w-9 text-primary" aria-hidden />
        </div>

        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          404
        </p>
        <h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
          We couldn&apos;t find that page
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
          The link may be broken, or the product or shop you&apos;re looking for
          is no longer listed.
        </p>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild className="rounded-full">
            <Link href="/">Back to home</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/products">
              <Compass className="mr-2 h-4 w-4" aria-hidden />
              Browse products
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
