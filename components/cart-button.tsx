"use client"

import Link from "next/link"
import { ShoppingCart } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCart } from "@/components/cart-provider"

/** Header cart shortcut with the live item count — used in the store header
 *  and the product page header, mirroring the wishlist/notification buttons. */
export default function CartButton({
  className,
  showCount = true,
}: {
  className?: string
  showCount?: boolean
}) {
  const { count } = useCart()

  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `Open cart, ${count} item${count === 1 ? "" : "s"}` : "Open cart"}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted",
        className,
      )}
    >
      <ShoppingCart className="h-5 w-5" />
      {showCount && count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  )
}
