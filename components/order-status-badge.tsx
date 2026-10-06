import { cn } from "@/lib/utils"
import {
  isOrderStatus,
  orderStatusLabel,
  STATUS_BADGE_CLASS,
} from "@/lib/orders"

/** Colored status pill for orders — shared by buyer history, order details,
 *  and the vendor orders screen. */
export function OrderStatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  // Dispatch a client-side status-change event (handled per page/component),
  // so the badge itself stays presentational.
  if (
    typeof window !== "undefined" &&
    status &&
    status !== "pending" &&
    status !== "ready" &&
    status !== "delivered" &&
    status !== "cancelled"
  ) {
    window.dispatchEvent(
      new CustomEvent("shoppie:order:status:change", {
        detail: { status },
      })
    )
  }

  const key = isOrderStatus(status) ? status : "pending"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold",
        STATUS_BADGE_CLASS[key],
        className,
      )}
    >
      {orderStatusLabel(status)}
    </span>
  )
}

export default OrderStatusBadge
