import { Tag } from "lucide-react"
import { getDiscountInfo, type Discountable } from "@/lib/pricing"
import { cn } from "@/lib/utils"

/**
 * Renders a product price, including the strikethrough "was" price and the
 * saving badge when a promotion is live.
 *
 * All surfaces (product cards, carousels, the detail page, the vendor's own
 * product list) go through this so a discount always looks the same and the
 * on-sale decision always comes from {@link getDiscountInfo}.
 *
 * `format` is injected because the storefront shows USD on most pages but
 * converts to the shopper's local currency in the store tab.
 */

export type PriceSize = "sm" | "md" | "lg"

const SIZE_CLASSES: Record<PriceSize, { current: string; original: string; badge: string }> = {
  sm: {
    current: "text-sm font-bold",
    original: "text-[11px]",
    badge: "px-1.5 py-0.5 text-[9px]",
  },
  md: {
    current: "text-base font-extrabold",
    original: "text-xs",
    badge: "px-2 py-0.5 text-[10px]",
  },
  lg: {
    current: "text-3xl font-bold",
    original: "text-base",
    badge: "px-2.5 py-1 text-xs",
  },
}

interface PriceDisplayProps {
  /** What the shopper pays right now. */
  price: number
  /** The struck-through "was" price, or null when not on sale. */
  originalPrice?: number | null
  discountPercent?: number | null
  promoLabel?: string | null
  /** Rendered as a chip next to the price while the promotion is live. */
  showPromoLabel?: boolean
  size?: PriceSize
  className?: string
  format?: (value: number) => string
}

export function PriceDisplay({
  price,
  originalPrice,
  discountPercent,
  promoLabel,
  showPromoLabel = false,
  size = "md",
  className,
  format = (value) => `$${value.toFixed(2)}`,
}: PriceDisplayProps) {
  const styles = SIZE_CLASSES[size]
  const onSale = originalPrice != null && originalPrice > price && discountPercent != null

  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      <span className={cn("text-primary", styles.current)}>{format(price)}</span>

      {onSale && (
        <>
          <span className={cn("text-muted-foreground line-through", styles.original)}>
            {format(originalPrice)}
          </span>
          {discountPercent != null && discountPercent > 0 && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full bg-destructive font-bold uppercase tracking-wide text-destructive-foreground",
                styles.badge,
              )}
            >
              {discountPercent}% off
            </span>
          )}
        </>
      )}

      {onSale && showPromoLabel && promoLabel && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
          <Tag className="h-3 w-3" />
          {promoLabel}
        </span>
      )}
    </div>
  )
}

interface ProductPriceProps {
  product: Discountable & { promo_label?: string | null }
  showPromoLabel?: boolean
  size?: PriceSize
  className?: string
  format?: (value: number) => string
  /** Pin the "is it still on sale" check to a fixed instant (tests/SSR). */
  now?: Date
}

/** Convenience wrapper that derives every value from the product itself. */
export function ProductPrice({
  product,
  showPromoLabel = false,
  size = "md",
  className,
  format,
  now,
}: ProductPriceProps) {
  const info = getDiscountInfo(product, now)

  return (
    <PriceDisplay
      price={info.currentPrice}
      originalPrice={info.originalPrice}
      discountPercent={info.discountPercent}
      promoLabel={info.promoLabel}
      showPromoLabel={showPromoLabel}
      size={size}
      className={className}
      format={format}
    />
  )
}
