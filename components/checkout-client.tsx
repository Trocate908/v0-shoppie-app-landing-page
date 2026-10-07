"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, Package, ShieldCheck, ShoppingBag, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/empty-state"
import { useCart } from "@/components/cart-provider"
import { describeOrderError, grandTotal, groupLinesByVendor, type CheckoutItem } from "@/lib/cart"
import { CURRENCIES, formatPrice } from "@/lib/currency"
import { useToast } from "@/hooks/use-toast"

const money = (value: number) => formatPrice(value, CURRENCIES.USD)

export default function CheckoutClient() {
  const router = useRouter()
  const { lines, mode, count, ensureSession, refresh } = useCart()
  const [note, setNote] = useState("")
  const [placing, setPlacing] = useState(false)
  const { toast } = useToast()

  const groups = useMemo(() => groupLinesByVendor(lines), [lines])
  const total = grandTotal(lines)
  const hasUnavailable = lines.some((line) => !line.in_stock)

  async function handlePlaceOrder() {
    if (placing || lines.length === 0) return
    setPlacing(true)
    try {
      // Guests get a session first (anonymous sign-in — same pattern as
      // messaging), which also merges any local cart into the account.
      const hasSession = await ensureSession()
      if (!hasSession) {
        toast({
          title: "Couldn't start checkout",
          description:
            "We couldn't create a session for you. Please refresh and try again.",
          variant: "destructive",
        })
        setPlacing(false)
        return
      }

      // Only ids + quantities + a price-change guard. The server re-reads and
      // re-validates every price and stock level inside create_order().
      const items: CheckoutItem[] = lines.map((line) => ({
        product_id: line.product_id,
        quantity: line.quantity,
        expected_price: Number(line.price.toFixed(2)),
      }))

      let res: Response
      try {
        res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items, note: note.trim() || null }),
        })
      } catch (error) {
        // The request never completed, so the server saw nothing — a retry is
        // safe and this is a genuine connection problem.
        console.error("[checkout] place-order request failed:", error)
        toast({
          title: "Something went wrong",
          description: "Please check your connection and try again.",
          variant: "destructive",
        })
        return
      }

      const payload = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast({
          title: "Couldn't place order",
          description:
            typeof payload.error === "string"
              ? payload.error
              : describeOrderError(""),
          variant: "destructive",
        })
        // Price/stock problems change the cart — reload so the shopper sees
        // the current state instead of retrying against stale data.
        const code = typeof payload.code === "string" ? payload.code : ""
        if (
          code.includes("price_changed") ||
          code.includes("out_of_stock") ||
          code.includes("insufficient_stock") ||
          code.includes("unavailable_product")
        ) {
          await refresh()
        }
        return
      }

      const orders = (payload.orders ?? []) as { reference: string }[]
      // The order exists server-side from here on. refresh() never rejects,
      // and even if it did, failing the whole flow now would show the shopper
      // an error for an order that was actually placed — inviting a duplicate.
      await refresh()
      toast({
        title: orders.length > 1 ? `${orders.length} orders placed` : "Order placed",
        description:
          orders.length > 1
            ? "One order was created for each shop."
            : orders[0]?.reference
              ? `Reference ${orders[0].reference}`
              : "You can track it in My Orders.",
      })
      router.push("/orders?placed=1")
    } catch (error) {
      // Every step handles its own errors now, so reaching this means an
      // unexpected bug. Log it — the old empty catch made this toast
      // impossible to diagnose from the field.
      console.error("[checkout] place order failed:", error)
      toast({
        title: "Something went wrong",
        description: "Please check your connection and try again.",
        variant: "destructive",
      })
    } finally {
      setPlacing(false)
    }
  }

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/cart" className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary">
              <ArrowLeft className="h-4 w-4" />
              Back to cart
            </Link>
            <Link href="/" className="flex items-center gap-2">
              <Store className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold text-foreground">ShoppieApp</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center gap-3">
            <ShoppingBag className="h-8 w-8 text-primary" />
            <div>
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Checkout</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "loading"
                  ? "Preparing your order…"
                  : `${count} ${count === 1 ? "item" : "items"} across ${groups.length} ${groups.length === 1 ? "shop" : "shops"}`}
              </p>
            </div>
          </div>

          {mode === "loading" ? (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
          ) : lines.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Nothing to check out"
              description="Your cart is empty — add a few products first."
              action={<Button onClick={() => router.push("/?tab=store")}>Browse the store</Button>}
              minHeightClassName="min-h-[360px]"
            />
          ) : (
            <div className="space-y-4">
              {hasUnavailable && (
                <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  Some items are out of stock. Go back to your cart and remove
                  them to continue.
                </p>
              )}

              {/* One order per shop */}
              {groups.map((group) => (
                <Card key={group.vendor_id} className="overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
                    <Store className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">
                      {group.shop_name}
                    </span>
                    <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                      Separate order
                    </span>
                  </div>
                  <div className="px-4 py-3">
                    {group.lines.map((line) => (
                      <div
                        key={line.product_id}
                        className="flex items-start justify-between gap-3 py-1.5 text-sm"
                      >
                        <span className="min-w-0 flex-1 text-foreground">
                          <span className="mr-1.5 inline-flex min-w-6 justify-center rounded bg-muted px-1.5 py-0.5 text-xs font-bold text-muted-foreground">
                            {line.quantity}
                          </span>
                          {line.name}
                          {!line.in_stock && (
                            <span className="ml-1 text-xs font-semibold text-destructive">
                              · out of stock
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 font-semibold text-foreground">
                          {money(line.price * line.quantity)}
                        </span>
                      </div>
                    ))}
                    <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-xs">
                      <span className="text-muted-foreground">Shop subtotal</span>
                      <span className="font-bold text-foreground">
                        {money(group.subtotal)}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}

              {/* Order note */}
              <div className="space-y-2">
                <Label htmlFor="order-note" className="text-sm font-semibold text-foreground">
                  Note for the {groups.length === 1 ? "shop" : "shops"}{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="order-note"
                  placeholder="Delivery instructions, best time to call…"
                  value={note}
                  maxLength={500}
                  onChange={(e) => setNote(e.target.value)}
                  className="min-h-[88px] rounded-xl"
                />
                <p className="text-right text-xs text-muted-foreground">{note.length}/500</p>
              </div>

              {/* Trust note */}
              <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p>
                  Prices, stock and totals are validated on the server when you
                  place this order. Each shop receives its own order, with item
                  names and prices snapshotted at this moment.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Place order bar */}
      {lines.length > 0 && (
        <div className="sticky bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div>
              <p className="text-xs text-muted-foreground">
                Total · {groups.length} {groups.length === 1 ? "order" : "orders"}
              </p>
              <p className="text-xl font-extrabold leading-tight text-foreground">
                {money(total)}
              </p>
            </div>
            <Button
              size="lg"
              className="rounded-full"
              disabled={placing || hasUnavailable || mode === "loading"}
              onClick={handlePlaceOrder}
            >
              {placing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Placing order…
                </>
              ) : (
                <>
                  <Package className="mr-2 h-4 w-4" />
                  Place Order
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
