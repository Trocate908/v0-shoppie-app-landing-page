/**
 * Discount and promotion rules for product pricing.
 *
 * The `products` table stores the price a shopper pays in `price`. A promotion
 * adds `original_price` (the "was" price) plus optional `promo_label` and
 * `promo_ends_at` on top of it. An active discount is simply
 * `original_price > price`.
 *
 * Every surface that renders a price goes through {@link getDiscountInfo} so
 * the "is this on sale" decision is made in exactly one place. The rules:
 *
 * - No `original_price`, or one that is not above `price` -> not a sale. The
 *   listed price is what shoppers see and pay.
 * - Promotion ended (`promo_ends_at` in the past) -> not a sale, and the price
 *   reverts to `original_price`. A finished flash sale stops advertising
 *   itself without the vendor editing the listing.
 * - Otherwise -> active sale: `price` is what shoppers pay, `original_price`
 *   is struck through, and the saving is shown as a percentage.
 */

/** The minimum fields needed to work out what a product costs right now. */
export interface Discountable {
  price: number
  original_price?: number | null
  promo_ends_at?: string | null
}

export interface DiscountInfo {
  /** True only while a promotion is live and actually cheaper. */
  isOnSale: boolean
  /** What the shopper pays right now. Never null. */
  currentPrice: number
  /** The struck-through "was" price, or null when not on sale. */
  originalPrice: number | null
  /** Whole-percent saving, or null when not on sale. */
  discountPercent: number | null
  promoLabel: string | null
  promoEndsAt: string | null
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** A promotion is over once its end time is strictly in the past. */
export function isPromoExpired(promoEndsAt?: string | null, now: Date = new Date()): boolean {
  if (!promoEndsAt) return false
  const end = new Date(promoEndsAt).getTime()
  if (!Number.isFinite(end)) return false
  return end < now.getTime()
}

export function getDiscountInfo(
  product: Discountable & { promo_label?: string | null },
  now: Date = new Date(),
): DiscountInfo {
  const price = toFiniteNumber(product.price) ?? 0
  const originalPrice = toFiniteNumber(product.original_price)
  const promoEndsAt = product.promo_ends_at ?? null
  const promoLabel = product.promo_label || null

  const notOnSale: DiscountInfo = {
    isOnSale: false,
    currentPrice: price,
    originalPrice: null,
    discountPercent: null,
    promoLabel: null,
    promoEndsAt: null,
  }

  // A "was" price that is missing, zero, or not actually above the selling
  // price is not a discount — treat the product as normally priced.
  if (originalPrice === null || originalPrice <= 0 || originalPrice <= price) {
    return notOnSale
  }

  // The promotion ran its course: fall back to the original price so shoppers
  // are not still shown a deal that has ended.
  if (isPromoExpired(promoEndsAt, now)) {
    return { ...notOnSale, currentPrice: originalPrice, promoLabel: null, promoEndsAt: null }
  }

  return {
    isOnSale: true,
    currentPrice: price,
    originalPrice,
    discountPercent: Math.round(((originalPrice - price) / originalPrice) * 100),
    promoLabel,
    promoEndsAt,
  }
}

/**
 * Price of a product excluding its promotion, used by price-range filters so
 * "under $5" matches what the shopper would actually pay.
 */
export function effectiveFilterPrice(product: Discountable, now: Date = new Date()): number {
  return getDiscountInfo(product, now).currentPrice
}
