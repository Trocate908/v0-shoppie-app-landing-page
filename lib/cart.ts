// Cart helpers shared by the cart provider, cart page, and checkout.
//
// Two cart modes exist (see components/cart-provider.tsx):
//   * guest  — no Supabase session; lines live in localStorage only
//   * server — a session exists (including anonymous buyers); lines live in
//     public.cart_items under RLS
// Guest lines are merged into the server cart on the first sign-in.
//
// Prices here are display-only. Checkout never sends a price it trusts — the
// server re-reads products.price inside create_order().

export const GUEST_CART_KEY = "shoppieapp_guest_cart_v1"

/** Mirrors the CHECK (quantity > 0 AND quantity <= 999) on cart_items.quantity. */
export const MAX_QTY = 999

export type GuestCartLine = {
  product_id: string
  quantity: number
}

/** Everything the UI needs to render a cart row. `price` is the current
 *  catalog price (USD base) used for display and as the expected_price guard
 *  at checkout — never as a charged amount. */
export type CartLine = {
  product_id: string
  quantity: number
  name: string
  price: number
  image_url: string | null
  in_stock: boolean
  vendor_id: string
  shop_name: string
}

export function clampQty(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1
  return Math.max(1, Math.min(MAX_QTY, Math.floor(quantity)))
}

export function readGuestCart(): GuestCartLine[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(GUEST_CART_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const lines: GuestCartLine[] = []
    const seen = new Set<string>()
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue
      const productId = (entry as { product_id?: unknown }).product_id
      const quantity = (entry as { quantity?: unknown }).quantity
      if (typeof productId !== "string" || !productId) continue
      if (seen.has(productId)) continue
      seen.add(productId)
      const qty =
        typeof quantity === "number" && Number.isFinite(quantity)
          ? clampQty(quantity)
          : 1
      lines.push({ product_id: productId, quantity: qty })
    }
    return lines
  } catch {
    return []
  }
}

export function writeGuestCart(lines: GuestCartLine[]): void {
  if (typeof window === "undefined") return
  try {
    if (lines.length === 0) {
      window.localStorage.removeItem(GUEST_CART_KEY)
    } else {
      window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(lines))
    }
  } catch {
    // Storage can be unavailable (private mode/quota) — the cart then simply
    // stays in memory for this visit.
  }
}

export function clearGuestCart(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(GUEST_CART_KEY)
  } catch {
    // ignore
  }
}

export type VendorGroup<T> = {
  vendor_id: string
  shop_name: string
  lines: T[]
  subtotal: number
}

/** Group cart lines by vendor so checkout can create one order per vendor —
 *  the same grouping create_order() performs server-side. */
export function groupLinesByVendor<
  T extends { vendor_id: string; shop_name: string; price: number; quantity: number },
>(lines: T[]): VendorGroup<T>[] {
  const groups = new Map<string, VendorGroup<T>>()
  for (const line of lines) {
    let group = groups.get(line.vendor_id)
    if (!group) {
      group = {
        vendor_id: line.vendor_id,
        shop_name: line.shop_name,
        lines: [],
        subtotal: 0,
      }
      groups.set(line.vendor_id, group)
    }
    group.lines.push(line)
    group.subtotal += line.price * line.quantity
  }
  return Array.from(groups.values())
}

export function totalQuantity(lines: { quantity: number }[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0)
}

export function grandTotal(lines: { price: number; quantity: number }[]): number {
  return lines.reduce((sum, line) => sum + line.price * line.quantity, 0)
}

/** Shape of the checkout payload. Only ids and quantities — no client price
 *  can set a charge; expected_price is a change-detection guard only. */
export type CheckoutItem = {
  product_id: string
  quantity: number
  expected_price?: number
}

/** Friendly copy for the ORDER_FAILED:* errors raised by create_order() /
 *  update_order_status() in supabase/migrations/add_cart_and_orders.sql. */
export function describeOrderError(raw: string | undefined | null): string {
  const message = raw ?? ""
  // Shape: ORDER_FAILED:<reason>[:<detail>]. Strip everything before the
  // prefix, then split on the FIRST colon only — splitting the whole string
  // on ":" would shred the prefix ("ORDER_FAILED") and silently defeat every
  // case below, leaking raw codes like ORDER_FAILED:not_found to shoppers.
  const body = message
    .replace(/^.*ORDER_FAILED:/, "ORDER_FAILED:")
    .slice("ORDER_FAILED:".length)
  const [reason, ...rest] = body.split(":")
  const code = `ORDER_FAILED:${reason}`
  const detail = rest.join(":")
  switch (code) {
    case "ORDER_FAILED:not_authenticated":
      return "Please sign in to place your order."
    case "ORDER_FAILED:empty_cart":
      return "Your cart is empty."
    case "ORDER_FAILED:too_many_items":
      return "That's too many different items for one order."
    case "ORDER_FAILED:note_too_long":
      return "Your note is too long (max 500 characters)."
    case "ORDER_FAILED:invalid_item":
      return "Your cart contained an invalid item. Please refresh and try again."
    case "ORDER_FAILED:out_of_stock":
      return detail ? `${detail} is out of stock.` : "An item in your order is out of stock."
    case "ORDER_FAILED:insufficient_stock":
      return detail
        ? `Not enough stock left for ${detail}.`
        : "There isn't enough stock left for an item in your order."
    case "ORDER_FAILED:price_changed":
      return detail
        ? `The price of ${detail} changed while you were checking out. Please review the updated total.`
        : "A price changed while you were checking out. Please review your order."
    case "ORDER_FAILED:unavailable_product":
      return "An item in your cart is no longer available and was removed."
    case "ORDER_FAILED:invalid_fulfillment":
      return "Choose pickup or delivery for your order."
    case "ORDER_FAILED:address_required":
      return "Add a delivery address so the shop can reach you."
    case "ORDER_FAILED:address_too_long":
      return "That delivery address is too long (max 500 characters)."
    case "ORDER_FAILED:invalid_payment_method":
      return "Choose how you'd like to pay."
    case "ORDER_FAILED:not_allowed":
      return "You can't change this order — as a buyer you can only cancel it while it's pending or confirmed."
    case "ORDER_FAILED:too_late_to_cancel":
      return "This order can no longer be cancelled. Contact the shop if you need help."
    case "ORDER_FAILED:wrong_fulfillment_flow":
      return "That action doesn't apply to this order's pickup/delivery type."
    case "ORDER_FAILED:invalid_status":
      return "That order status isn't valid."
    case "ORDER_FAILED:not_found":
      return "That order no longer exists."
    case "ORDER_FAILED:not_owner":
      return "You don't have permission to change this order."
    case "ORDER_FAILED:illegal_transition":
      return "That status change isn't allowed from the order's current state."
    default:
      return message || "Something went wrong placing your order."
  }
}
