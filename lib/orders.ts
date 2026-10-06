// Order status vocabulary shared by the buyer pages and the vendor orders
// screen. The transition rules here mirror update_order_status() in
// supabase/migrations/add_cart_and_orders.sql — the server remains the
// authority; this only drives which buttons we render.

export type OrderStatus = "pending" | "confirmed" | "ready" | "delivered" | "cancelled" | "pickup_ready"

export const PICKUP_STATUSES: OrderStatus[] = ["pickup_ready"]

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "ready",
  "delivered",
  "cancelled",
  "pickup_ready",
]

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  ready: "Ready",
  delivered: "Delivered",
  cancelled: "Cancelled",
  pickup_ready: "Pickup Ready",
}

export const STATUS_DESCRIPTION: Record<OrderStatus, string> = {
  pending: "Waiting for the shop to confirm",
  confirmed: "The shop has confirmed your order",
  ready: "Your order is ready",
  delivered: "Order completed",
  cancelled: "This order was cancelled",
  pickup_ready: "Pickup ready",
}

/** Badge classes follow the existing shadcn Badge palette. */
export const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  confirmed: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  ready: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30",
  pickup_ready: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
}

/** Happy-path timeline shown to buyers. */
export const STATUS_FLOW: OrderStatus[] = ["pending", "confirmed", "ready", "delivered"]

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as string[]).includes(value)
}

export function orderStatusLabel(value: string): string {
  return isOrderStatus(value) ? STATUS_LABEL[value] : value
}

/** Legal vendor-initiated transitions (matches the SQL transition matrix). */
export const VENDOR_ACTIONS: Record<
  OrderStatus,
  { status: OrderStatus; label: string; variant: "default" | "outline" | "destructive" }[]
> = {
  pending: [
    { status: "confirmed", label: "Confirm", variant: "default" },
    { status: "cancelled", label: "Cancel", variant: "destructive" },
  ],
  confirmed: [
    { status: "ready", label: "Mark Ready", variant: "default" },
    { status: "pickup_ready", label: "Mark Pickup Ready", variant: "default" },
    { status: "cancelled", label: "Cancel", variant: "destructive" },
  ],
  ready: [
    { status: "delivered", label: "Mark Delivered", variant: "default" },
    { status: "cancelled", label: "Cancel", variant: "destructive" },
  ],
  pickup_ready: [
    { status: "delivered", label: "Mark Delivered", variant: "default" },
    { status: "cancelled", label: "Cancel", variant: "destructive" },
  ],
  delivered: [],
  cancelled: [],
}

export function statusTimestampsFor(status: OrderStatus, order: {
  created_at: string
  confirmed_at?: string | null
  delivered_at?: string | null
  cancelled_at?: string | null
}): Partial<Record<OrderStatus, string | null>> {
  return {
    pending: order.created_at,
    confirmed: order.confirmed_at ?? null,
    delivered: order.delivered_at ?? null,
    cancelled: order.cancelled_at ?? null,
    ready: null,
  }
}
