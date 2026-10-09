import { useEffect } from "react"
import { cn } from "@/lib/utils"
import {
  isOrderStatus,
  orderStatusLabel,
  STATUS_BADGE_CLASS,
} from "@/lib/orders"

/** Statuses that are not broadcast — they are the initial state or the end
 *  result of a transition, so there is nothing for surrounding UI to react to.
 *  Everything else (confirmed / pickup_ready today) is broadcast. */
const SILENT_STATUSES = new Set(["pending", "ready", "delivered", "cancelled"])

/** Colored status pill for orders — shared by buyer history, order details,
 *  and the vendor orders screen. Non-terminal status changes are broadcast on
 *  the `shoppie:order:status:change` window event so parent UI can react
 *  without the badge knowing anything about the surrounding page. */
export function OrderStatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  // Dispatch from an effect rather than during render: emitting an event is a
  // side effect, and render-phase dispatch can re-enter the renderer if a
  // listener updates state.
  useEffect(() => {
    if (status && !SILENT_STATUSES.has(status)) {
      window.dispatchEvent(
        new CustomEvent("shoppie:order:status:change", {
          detail: { status },
        }),
      )
    }
  }, [status])

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
