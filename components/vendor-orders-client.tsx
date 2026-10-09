"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Clock, Loader2, Package, Store, Check, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import OrderStatusBadge from "@/components/order-status-badge"
import {
  isOrderStatus,
  orderStatusLabel,
  paymentLabel,
  vendorActionsFor,
  type OrderStatus,
} from "@/lib/orders"
import { CURRENCIES, formatPrice } from "@/lib/currency"
import { describeOrderError } from "@/lib/cart"
import { useToast } from "@/hooks/use-toast"

const money = (value: number) => formatPrice(value, CURRENCIES.USD)

export type VendorOrder = {
  id: string
  reference: string
  status: string
  fulfillment_type: string
  delivery_address?: string | null
  payment_method?: string | null
  cancelled_by?: string | null
  subtotal: number | string
  customer_note: string | null
  source: string
  created_at: string
  confirmed_at?: string | null
  delivered_at?: string | null
  cancelled_at?: string | null
  order_items: Array<{
    id: string
    product_id: string | null
    product_name: string
    product_image: string | null
    unit_price: number | string
    quantity: number
    line_total: number | string
  }>
}

type Filter = "all" | OrderStatus

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "pickup_ready", label: "Pickup Ready" },
  { value: "ready", label: "Ready" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
]

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/** How long an order has been sitting with the shop. `stale` flags orders
 *  that have waited long enough to deserve attention in the list. */
function orderAge(
  createdAt: string,
  now: number,
): { label: string; stale: boolean } | null {
  const ms = now - new Date(createdAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  const stale = ms >= 6 * 60 * 60 * 1000
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return { label: `${Math.max(1, minutes)}m`, stale }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { label: `${hours}h`, stale }
  return { label: `${Math.floor(hours / 24)}d`, stale }
}

export function VendorOrdersClient({
  orders: initialOrders,
  shopName,
}: {
  orders: VendorOrder[]
  shopName: string
}) {
  const [orders, setOrders] = useState<VendorOrder[]>(initialOrders)
  const [filter, setFilter] = useState<Filter>("all")
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  // Ages come from the browser clock after mount so the server and client
  // render identical markup (no hydration mismatch).
  const [now, setNow] = useState<number | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    setNow(Date.now())
  }, [])

  const counts = useMemo(() => {
    const map: Record<Filter, number> = {
      all: orders.length,
      pending: 0,
      confirmed: 0,
      pickup_ready: 0,
      ready: 0,
      delivered: 0,
      cancelled: 0,
    }
    for (const order of orders) {
      if (isOrderStatus(order.status)) map[order.status] += 1
    }
    return map
  }, [orders])

  const visibleOrders = useMemo(
    () =>
      filter === "all"
        ? orders
        : orders.filter((order) => order.status === filter),
    [orders, filter],
  )

  async function handleStatusChange(order: VendorOrder, next: OrderStatus) {
    if (updatingId) return
    // Cancelling is destructive and irreversible from the shop's side, so ask
    // first — a mis-tap used to cancel the order immediately.
    if (
      next === "cancelled" &&
      !window.confirm(
        `Cancel order ${order.reference}? The customer will be notified and this can't be undone.`,
      )
    ) {
      return
    }
    setUpdatingId(order.id)
    try {
      const res = await fetch("/api/orders/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id, status: next }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: "Couldn't update order",
          description:
            typeof payload.error === "string"
              ? payload.error
              : describeOrderError(""),
          variant: "destructive",
        })
        return
      }
      const updated = payload.order as VendorOrder | undefined
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, ...(updated ?? { status: next }) } : o)),
      )
      toast({
        title: `Order ${order.reference}`,
        description: `Status updated to ${orderStatusLabel(next)}. The customer has been notified.`,
      })
    } catch {
      toast({
        title: "Something went wrong",
        description: "Please check your connection and try again.",
        variant: "destructive",
      })
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header — mirrors Manage Products */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/vendor/dashboard">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Orders</h1>
                <p className="text-sm text-muted-foreground">{shopName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                {counts.pending} pending
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl gap-1.5 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
          {FILTERS.map((tab) => {
            const active = filter === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setFilter(tab.value)}
                aria-pressed={active}
                className={
                  "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors " +
                  (active
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:text-foreground")
                }
              >
                {tab.label}
                <span className="ml-1.5 opacity-70">{counts[tab.value]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Order list */}
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        {visibleOrders.length === 0 ? (
          <Card className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {filter === "all" ? "No orders yet" : `No ${filter} orders`}
            </p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {filter === "all"
                ? "When customers check out, their orders show up here for you to confirm."
                : "Orders with this status will appear here."}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {visibleOrders.map((order) => {
              const actions = isOrderStatus(order.status)
                ? vendorActionsFor(order.status, order.fulfillment_type)
                : []
              const busy = updatingId === order.id
              const units = order.order_items.reduce(
                (sum, item) => sum + item.quantity,
                0,
              )
              // Only orders the shop still has to act on get an age chip.
              const needsAction =
                order.status === "pending" || order.status === "confirmed"
              const age = needsAction && now !== null
                ? orderAge(order.created_at, now)
                : null
              return (
                <Card key={order.id} className="overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
                    <Store className="h-4 w-4 text-primary" />
                    <span className="font-mono text-sm font-bold text-foreground">
                      {order.reference}
                    </span>
                    {order.fulfillment_type === "delivery" ? (
                      <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                        <Truck className="h-3 w-3" />
                        Delivery
                      </span>
                    ) : (
                      <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3 w-3" />
                        Pickup
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      · {formatDateTime(order.created_at)} · {units}{" "}
                      {units === 1 ? "item" : "items"}
                    </span>
                    {age && (
                      <span
                        className={
                          "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold " +
                          (age.stale
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                            : "bg-muted text-muted-foreground")
                        }
                        title="Time since this order was placed"
                      >
                        <Clock className="h-3 w-3" />
                        Waiting {age.label}
                      </span>
                    )}
                    <OrderStatusBadge status={order.status} className="ml-auto shrink-0" />
                  </div>

                  <div className="px-4 py-3">
                    {order.order_items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 py-1.5 text-sm"
                      >
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {item.product_image ? (
                            <Image
                              src={item.product_image}
                              alt={item.product_name}
                              fill
                              className="object-cover"
                              loading="lazy"
                              sizes="40px"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <span className="min-w-0 flex-1 truncate text-foreground">
                          <span className="mr-1.5 inline-flex min-w-5 justify-center rounded bg-muted px-1.5 py-0.5 text-xs font-bold text-muted-foreground">
                            {item.quantity}
                          </span>
                          {item.product_name}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {money(Number(item.unit_price))} each
                        </span>
                      </div>
                    ))}

                    {order.customer_note && (
                      <p className="mt-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        <span className="font-bold text-foreground">Customer note:</span>{" "}
                        {order.customer_note}
                      </p>
                    )}

                    {order.fulfillment_type === "delivery" &&
                      order.delivery_address && (
                        <p className="mt-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                          <span className="font-bold text-foreground">
                            Deliver to:
                          </span>{" "}
                          {order.delivery_address}
                        </p>
                      )}

                    <p className="mt-2 text-xs text-muted-foreground">
                      <span className="font-bold text-foreground">Payment:</span>{" "}
                      {paymentLabel(order.payment_method)}
                    </p>

                    {order.status === "cancelled" && order.cancelled_by && (
                      <p className="mt-2 text-xs font-semibold text-destructive">
                        Cancelled by the{" "}
                        {order.cancelled_by === "buyer" ? "customer" : "shop"}.
                      </p>
                    )}

                    <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                      <span className="text-xs text-muted-foreground">Order subtotal</span>
                      <span className="text-base font-extrabold text-foreground">
                        {money(Number(order.subtotal))}
                      </span>
                    </div>

                    {actions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {actions.map((action) => (
                          <Button
                            key={action.status}
                            size="sm"
                            variant={action.variant}
                            disabled={busy}
                            className="rounded-full"
                            onClick={() => handleStatusChange(order, action.status)}
                          >
                            {busy && action.variant !== "destructive" && (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            )}
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
