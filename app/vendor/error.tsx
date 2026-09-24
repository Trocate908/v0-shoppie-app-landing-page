"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, LogIn, RefreshCw } from "lucide-react"

export default function VendorError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[vendor] Error boundary caught:", error)
  }, [error])

  const showDetails = process.env.NODE_ENV === "development" && !!error.message

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-9 w-9 text-destructive" aria-hidden />
        </div>

        <h1 className="text-2xl font-bold text-foreground">
          We couldn&apos;t load your dashboard
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
          Something went wrong on our side. Try again, and if it persists sign
          in again to refresh your session.
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
            onClick={() => (window.location.href = "/vendor/login")}
          >
            <LogIn className="mr-2 h-4 w-4" aria-hidden />
            Sign in again
          </Button>
        </div>
      </div>
    </div>
  )
}
