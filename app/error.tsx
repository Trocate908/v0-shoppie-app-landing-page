"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, Home, RefreshCw } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Keep the details in the console for debugging, never in the UI.
    console.error("[app] Error boundary caught:", error)
  }, [error])

  // The raw message can contain internal details (Supabase query text, host
  // names), so only surface it in development. The digest is safe to show and
  // is what support needs to trace the failure in the logs.
  const showDetails = process.env.NODE_ENV === "development" && !!error.message

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-9 w-9 text-destructive" aria-hidden />
        </div>

        <h1 className="text-2xl font-bold text-foreground">
          Something went wrong
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
          We hit an unexpected problem loading this page. It&apos;s usually
          temporary — try again, and if it keeps happening head back to the
          homepage.
        </p>

        {showDetails && (
          <p className="mt-4 break-words rounded-xl border border-border bg-card px-4 py-3 text-left text-xs text-muted-foreground">
            {error.message}
          </p>
        )}

        {error.digest && (
          <p className="mt-4 text-xs text-muted-foreground/70">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        )}

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={reset} className="rounded-full">
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            Try again
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => (window.location.href = "/")}
          >
            <Home className="mr-2 h-4 w-4" aria-hidden />
            Go home
          </Button>
        </div>
      </div>
    </div>
  )
}
