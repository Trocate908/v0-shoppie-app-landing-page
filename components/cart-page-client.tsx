"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ArrowRight, Minus, Package, Plus, ShoppingCart, Store, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/empty-state"
import ProfileButton from "@/components/profile-button"
import { useCart } from "@/components/cart-provider"
import { grandTotal, groupLinesByVendor } from "@/lib/cart"
import { CURRENCIES, formatPrice } from "@/lib/currency"
import { useToast } from "@/hooks/use-toast"

const money = (value: number) => formatPrice(value, CURRENCIES.USD)

export default function CartPageClient() {
  const router = useRouter()
  const { lines, mode, count, setQuantity, removeLine } = useCart()
  const [busyLine, setBusyLine] = useState<string | null>(null)
  const { toast } = useToast()

  const groups = useMemo(() => groupLinesByVendor(lines), [lines])
  const total = grandTotal(lines)
  const hasUnavailable = lines.some((line) => !line.in_stock)

  async function changeQuantity(productId: string, quantity: number) {
    setBusyLine(productId)
    try {
      await setQuantity(productId, quantity)
    } catch {
      toast({
        title: "Couldn't update cart",
        description: "Please try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setBusyLine(null)
    }
  }

  async function handleRemove(productId: string) {
    setBusyLine(productId)
    try {
      await removeLine(productId)
    } catch {
      toast({
        title: "Couldn't update cart",
        description: "Please try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setBusyLine(null)
    }
  }

  return (
    <>
      {/* Header — mirrors the wishlist page chrome */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Store className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">ShoppieApp</h1>
            </Link>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => router.push("/?tab=store")}>
                Continue shopping
              </Button>
              <ProfileButton />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          {/* Page title */}
          <div className="mb-6 flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-primary" />
            <div>
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">My Cart</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "loading"
                  ? "Loading your cart…"
                  : `${count} ${count === 1 ? "item" : "items"} · ${groups.length} ${groups.length === 1 ? "shop" : "shops"}`}
              </p>
            </div>
          </div>

          {mode === "loading" ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
          ) : lines.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Your cart is empty"
              description="Browse the marketplace and add products from any shop — your cart keeps items from different shops together."
              action={
                <Button onClick={() => router.push("/?tab=store")}>
                  Browse the store
                </Button>
              }
              minHeightClassName="min-h-[400px]"
            />
          ) : (
            <div className="space-y-4">
              {hasUnavailable && (
                <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  Some items are out of stock. Remove them to continue to checkout.
                </p>
              )}

              {groups.map((group) => (
                <Card key={group.vendor_id} className="overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
                    <Store className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">
                      {group.shop_name}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {group.lines.length} {group.lines.length === 1 ? "item" : "items"}
                    </span>
                  </div>

                  <div>
                    {group.lines.map((line) => {
                      const busy = busyLine === line.product_id
                      return (
                        <div
                          key={line.product_id}
                          className="flex gap-3 border-b border-border/60 p-4 last:border-b-0"
                        >
                          <Link
                            href={`/product/${line.product_id}`}
                            className="shrink-0"
                            aria-label={`View ${line.name}`}
                          >
                            <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-muted sm:h-20 sm:w-20">
                              {line.image_url ? (
                                <Image
                                  src={line.image_url}
                                  alt={line.name}
                                  fill
                                  className="object-cover"
                                  loading="lazy"
                                  sizes="80px"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center">
                                  <Package className="h-6 w-6 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                          </Link>

                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/product/${line.product_id}`}
                              className="line-clamp-2 text-sm font-medium text-foreground hover:text-primary"
                            >
                              {line.name}
                            </Link>
                            <p className="mt-0.5 text-sm font-semibold text-foreground">
                              {money(line.price)}
                            </p>
                            {!line.in_stock && (
                              <p className="mt-1 text-xs font-semibold text-destructive">
                                Out of stock
                              </p>
                            )}

                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
                                <button
                                  type="button"
                                  aria-label={`Decrease quantity of ${line.name}`}
                                  disabled={busy}
                                  onClick={() => changeQuantity(line.product_id, line.quantity - 1)}
                                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-6 text-center text-sm font-semibold text-foreground">
                                  {busy ? (
                                    <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    line.quantity
                                  )}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`Increase quantity of ${line.name}`}
                                  disabled={busy || line.quantity >= 999}
                                  onClick={() => changeQuantity(line.product_id, line.quantity + 1)}
                                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleRemove(line.product_id)}
                                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Remove
                              </button>
                            </div>
                          </div>

                          <div className="hidden w-20 shrink-0 text-right text-sm font-bold text-foreground sm:block">
                            {money(line.price * line.quantity)}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex items-center justify-between bg-muted/20 px-4 py-2.5 text-xs">
                    <span className="text-muted-foreground">
                      Subtotal · {group.shop_name}
                    </span>
                    <span className="font-bold text-foreground">
                      {money(group.subtotal)}
                    </span>
                  </div>
                </Card>
              ))}

              <p className="px-1 text-xs text-muted-foreground">
                One order is created per shop at checkout. Prices and stock are
                confirmed on the server when you place the order.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Sticky order bar */}
      {lines.length > 0 && (
        <div className="sticky bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div>
              <p className="text-xs text-muted-foreground">
                Total · {count} {count === 1 ? "item" : "items"}
              </p>
              <p className="text-xl font-extrabold leading-tight text-foreground">
                {money(total)}
              </p>
            </div>
            <Button
              size="lg"
              className="rounded-full"
              disabled={mode === "loading" || hasUnavailable}
              onClick={() => router.push("/checkout")}
            >
              Proceed to Checkout
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
