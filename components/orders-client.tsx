"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import Image from "next/image"
import {
  ArrowRight,
  CheckCircle2,
  Package,
  ShoppingBag,
  Store,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/empty-state"
import ProfileButton from "@/components/profile-button"
import { AppFooter } from "@/components/app-footer"
import OrderStatusBadge from "@/components/order-status-badge"
import { CURRENCIES, formatPrice } from "@/lib/currency"

const money = (value: number) => formatPrice(value, CURRENCIES.USD)

export type OrderSummary = {
  id: string
  reference: string
  status: string
  fulfillment_type: string
  subtotal: number | string
  customer_note: string | null
  source: string
  created_at: string
  confirmed_at?: string | null
  delivered_at?: string | null
  cancelled_at?: string | null
  vendor: {
    id: string
    shop_name: string
    slug?: string | null
    profile_picture_url?: string | null
  } | null
  order_items: Array<{
    id: string
    product_name: string
    product_image: string | null
    unit_price: number | string
    quantity: number
    line_total: number | string
  }>
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function OrdersClient({
  orders,
  placed,
}: {
  orders: OrderSummary[]
  placed?: boolean
}) {
  const router = useRouter()
  const units = (order: OrderSummary) =>
    order.order_items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <>
      {/* Header — same chrome as the wishlist page */}
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
          {placed && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3.5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-sm font-bold text-foreground">
                  {orders.length > 1
                    ? `${orders.length} orders placed — one per shop`
                    : "Your order was placed"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  The shops have been notified and will confirm shortly. Track
                  each order below.
                </p>
              </div>
            </div>
          )}

          {/* Page title */}
          <div className="mb-6 flex items-center gap-3">
            <ShoppingBag className="h-8 w-8 text-primary" />
            <div>
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">My Orders</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {orders.length} {orders.length === 1 ? "order" : "orders"} placed
              </p>
            </div>
          </div>

          {orders.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No orders yet"
              description="Orders you place appear here with live status updates from each shop."
              action={
                <Button onClick={() => router.push("/?tab=store")}>Start shopping</Button>
              }
              minHeightClassName="min-h-[400px]"
            />
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <Link key={order.id} href={`/orders/${order.id}`}>
                  <Card className="mb-3 overflow-hidden p-4 transition-colors hover:bg-muted/40">
                    <div className="flex items-start gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">
                        {order.vendor?.profile_picture_url ? (
                          <Image
                            src={order.vendor.profile_picture_url}
                            alt={order.vendor.shop_name}
                            fill
                            className="object-cover"
                            loading="lazy"
                            sizes="48px"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Store className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-bold text-foreground">
                            {order.vendor?.shop_name ?? "Shop"}
                          </span>
                          <OrderStatusBadge status={order.status} className="ml-auto shrink-0" />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {order.reference} ·{" "}
                          {order.fulfillment_type === "delivery"
                            ? "Delivery"
                            : "Pickup"}{" "}
                          · {units(order)}{" "}
                          {units(order) === 1 ? "item" : "items"} · {formatDate(order.created_at)}
                        </p>
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          {order.order_items
                            .map((item) => `${item.quantity}× ${item.product_name}`)
                            .join(", ")}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="text-sm font-extrabold text-foreground">
                          {money(Number(order.subtotal))}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      <AppFooter />
    </>
  )
}
