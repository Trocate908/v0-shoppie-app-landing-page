"use client"

import { useEffect, useState } from "react"
import { WifiOff, ShoppingBag, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"

interface SavedProduct {
  id: string
  name: string
  price: number
  image_url: string | null
  shop_name: string
  viewedAt: number
}

export default function OfflineClient() {
  const [savedProducts, setSavedProducts] = useState<SavedProduct[]>([])
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Load recently viewed products from localStorage
    try {
      const raw = localStorage.getItem("shoppie_recently_viewed")
      if (raw) {
        const products: SavedProduct[] = JSON.parse(raw)
        setSavedProducts(products.slice(0, 12))
      }
    } catch {
      // ignore
    }

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const handleRetry = () => {
    window.location.href = "/"
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-background px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
          <WifiOff className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">You are offline</p>
          <p className="text-xs text-muted-foreground">Showing saved products from your last visit</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRetry}
          className="ml-auto gap-2"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      </div>

      {/* Online banner */}
      {isOnline && (
        <div className="flex items-center justify-between bg-green-50 dark:bg-green-950 px-4 py-2.5 text-sm text-green-700 dark:text-green-300">
          <span>You are back online!</span>
          <Button size="sm" variant="ghost" onClick={handleRetry} className="h-7 text-green-700 dark:text-green-300">
            Go to store
          </Button>
        </div>
      )}

      {/* Saved products */}
      <div className="flex-1 p-4">
        {savedProducts.length > 0 ? (
          <>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Recently viewed ({savedProducts.length})
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {savedProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                  className="group rounded-xl border border-border bg-card p-3 transition-shadow hover:shadow-md"
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
                    {product.image_url ? (
                      <Image
                        src={product.image_url}
                        alt={product.name}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                        sizes="(max-width: 640px) 45vw, 30vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ShoppingBag className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-medium text-foreground">{product.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{product.shop_name}</p>
                  <p className="mt-1 text-sm font-semibold text-primary">
                    ${product.price.toFixed(2)}
                  </p>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <ShoppingBag className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-foreground">No saved products</h2>
            <p className="max-w-xs text-sm text-muted-foreground">
              Browse products while online and they will be saved here for offline viewing.
            </p>
            <Button onClick={handleRetry} className="mt-6 gap-2">
              <RefreshCw className="h-4 w-4" />
              Try reconnecting
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
