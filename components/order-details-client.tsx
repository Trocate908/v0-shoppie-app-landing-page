"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, Loader2, Package, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AppFooter } from "@/components/app-footer"
import ProfileButton from "@/components/profile-button"
import OrderStatusBadge from "@/components/order-status-badge"
import MessageSellerButton from "@/components/message-seller-button"
import WhatsAppButton from "@/components/whatsapp-button"
import { VerificationBadge } from "@/components/verification-badge"
import { describeOrderError } from "@/lib/cart"
import { useToast } from "@/hooks/use-toast"
import {
  OrderStatus,
  STATUS_LABEL,
  STATUS_DESCRIPTION,
  paymentLabel,
} from "@/lib/orders"
import { CURRENCIES, formatPrice } from "@/lib/currency"

const money = (value: number) => formatPrice(value, CURRENCIES.USD)

export type OrderDetails = {
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
  vendor: {
    id: string
    shop_name: string
    slug?: string | null
    profile_picture_url?: string | null
    whatsapp_number?: string | null
    user_id: string
    is_verified?: boolean | null
    verification_expires_at?: string | null
  } | null
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

function formatDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export default function OrderDetailsClient({ order }: { order: OrderDetails }) {
  const router = useRouter()
  const { toast } = useToast()
  const [cancelling, setCancelling] = useState(false)
  const isCancelled = order.status === "cancelled"
  const shopSlug = order.vendor?.slug ?? order.vendor?.id

  // Buyers may cancel their own order while the shop hasn't started
  // fulfilling it — the server enforces the same window.
  const canCancel =
    !isCancelled &&
    (order.status === "pending" || order.status === "confirmed")

  async function handleCancel() {
    if (cancelling) return
    if (
      !window.confirm(
        "Cancel this order? The shop will be notified right away.",
      )
    ) {
      return
    }
    setCancelling(true)
    try {
      const res = await fetch("/api/orders/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id, status: "cancelled" }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: "Couldn't cancel order",
          description:
            typeof payload.error === "string" && payload.error
              ? describeOrderError(payload.error)
              : "Please try again in a moment.",
          variant: "destructive",
        })
        return
      }
      toast({
        title: `Order ${order.reference} cancelled`,
        description: "The shop has been notified.",
      })
      router.refresh()
    } catch {
      toast({
        title: "Something went wrong",
        description: "Please check your connection and try again.",
        variant: "destructive",
      })
    } finally {
      setCancelling(false)
    }
  }

  // Pickup orders are a distinct flow: pending → confirmed (pickup-ready) →
  // delivered, with cancel from pending/confirmed. The `ready` step is
  // replaced by `pickup_ready` for pickup orders.
  const statusFlow = order.fulfillment_type === "pickup"
    ? ["pending", "confirmed", "pickup_ready", "delivered"]
    : ["pending", "confirmed", "ready", "delivered"]
  const steps = statusFlow.map((status) => {
    const done =
      status === "pending"
        ? true
        : status === "confirmed"
          ? order.status === "confirmed" ||
            order.status === "ready" ||
            order.status === "delivered" ||
            order.status === "pickup_ready"
          : status === "ready"
            ? order.status === "ready" ||
              order.status === "delivered" ||
              order.status === "pickup_ready"
            : status === "pickup_ready"
              ? order.status === "pickup_ready" ||
                order.status === "ready" ||
                order.status === "delivered"
              : order.status === "delivered"
    return { status, done }
  })
  const currentStep = isCancelled
    ? -1
    : steps.findIndex((step) => !step.done)

  const messageProductId =
    order.order_items.find((item) => item.product_id)?.product_id ?? null

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push("/orders")}
              className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              My Orders
            </button>
            <div className="flex items-center gap-1.5">
              <ProfileButton />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-4">
          {/* Title + status */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Order {order.reference}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Placed {formatDateTime(order.created_at)}
              </p>
              {order.fulfillment_type === "pickup" && (
                <p className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    Pickup — collect from {order.vendor?.shop_name ?? "the shop"}
                  </span>
                </p>
              )}
            </div>
            <OrderStatusBadge status={order.status} className="mt-1" />
          </div>

          {isCancelled && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {order.cancelled_by === "buyer"
                ? "You cancelled this order"
                : "The shop cancelled this order"}
              {formatDateTime(order.cancelled_at)
                ? ` on ${formatDateTime(order.cancelled_at)}`
                : ""}
              .
            </p>
          )}

          {canCancel && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={cancelling}
                onClick={handleCancel}
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {cancelling && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Cancel order
              </Button>
            </div>
          )}

          {/* Status timeline */}
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-bold text-foreground">Status</h3>
            <ol>
              {steps.map((step, index) => {
                const isCurrent = index === currentStep
                return (
                  <li key={step.status} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold " +
                          (step.done
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : isCurrent
                              ? "border-primary text-primary"
                              : "border-border text-muted-foreground")
                        }
                      >
                        {step.done ? <Check className="h-4 w-4" /> : index + 1}
                      </span>
                      {index < steps.length - 1 && (
                        <span
                          className={
                            "my-1 w-px flex-1 " +
                            (steps[index + 1].done ? "bg-emerald-500/60" : "bg-border")
                          }
                        />
                      )}
                    </div>
                    <div className={index < steps.length - 1 ? "pb-4" : ""}>
                      <p
                        className={
                          "text-sm " +
                          (step.done || isCurrent
                            ? "font-semibold text-foreground"
                            : "font-medium text-muted-foreground")
                        }
                      >
                        {STATUS_LABEL[step.status as OrderStatus]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {STATUS_DESCRIPTION[step.status as OrderStatus]}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </Card>

          {/* Items — snapshots taken when the order was placed */}
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
              <Store className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                {order.vendor?.shop_name ?? "Shop"}
              </span>
              {order.vendor?.is_verified && (
                <VerificationBadge
                  isVerified
                  verificationExpiresAt={order.vendor.verification_expires_at ?? null}
                  size="sm"
                  showTooltip={false}
                />
              )}
              {shopSlug && (
                <Link
                  href={`/shop/${shopSlug}`}
                  className="ml-auto text-xs font-semibold text-primary hover:underline"
                >
                  Visit shop
                </Link>
              )}
            </div>

            <div>
              {order.order_items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 border-b border-border/60 p-4 last:border-b-0"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {item.product_image ? (
                      <Image
                        src={item.product_image}
                        alt={item.product_name}
                        fill
                        className="object-cover"
                        loading="lazy"
                        sizes="56px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {item.product_id ? (
                      <Link
                        href={`/product/${item.product_id}`}
                        className="line-clamp-2 text-sm font-medium text-foreground hover:text-primary"
                      >
                        {item.product_name}
                      </Link>
                    ) : (
                      <p className="line-clamp-2 text-sm font-medium text-foreground">
                        {item.product_name}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {money(Number(item.unit_price))} × {item.quantity}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-foreground">
                    {money(Number(item.line_total))}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between bg-muted/20 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="text-base font-extrabold text-foreground">
                {money(Number(order.subtotal))}
              </span>
            </div>
          </Card>

          {/* Your note */}
          {order.customer_note && (
            <Card className="p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Your note
              </h3>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">
                {order.customer_note}
              </p>
            </Card>
          )}

          {/* Pickup note */}
          {order.fulfillment_type === "pickup" && (
            <Card className="p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Pickup details
              </h3>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">
                Collect your order from {order.vendor?.shop_name ?? "the shop"}.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Payment: {paymentLabel(order.payment_method)}
              </p>
            </Card>
          )}

          {/* Delivery details */}
          {order.fulfillment_type === "delivery" && (
            <Card className="p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Delivery details
              </h3>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">
                {order.delivery_address ??
                  "No delivery address was provided."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Payment: {paymentLabel(order.payment_method)}
              </p>
            </Card>
          )}

          {/* Contact the shop — reuses the existing chat/WhatsApp flows */}
          {order.vendor && (
            <Card className="p-4">
              <h3 className="mb-3 text-sm font-bold text-foreground">
                Need to reach the shop?
              </h3>
              <div className="space-y-2">
                {messageProductId && (
                  <MessageSellerButton
                    productId={messageProductId}
                    vendorId={order.vendor.user_id}
                    variant="outline"
                    size="default"
                    className="w-full"
                  />
                )}
                {order.vendor.whatsapp_number && (
                  <WhatsAppButton
                    phoneNumber={order.vendor.whatsapp_number}
                    shopName={order.vendor.shop_name}
                    productName={order.reference}
                    className="w-full"
                  />
                )}
              </div>
            </Card>
          )}
        </div>
      </main>

      <AppFooter />
    </>
  )
}
