"use client"

import { useState } from "react"
import { Check, Loader2, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useCart } from "@/components/cart-provider"

export type AddToCartProduct = {
  id: string
  name: string
  price: number
  image_url?: string | null
  in_stock: boolean
  vendor_id: string
  shop_name: string
}

/**
 * Add-to-cart control shared by the store grid and the product page.
 * Sends only ids/quantities — the server re-prices everything at checkout.
 */
export default function AddToCartButton({
  product,
  quantity = 1,
  showLabel = false,
  className,
  variant = "default",
  size = "icon",
  disabled,
}: {
  product: AddToCartProduct
  quantity?: number
  showLabel?: boolean
  className?: string
  variant?: "default" | "outline" | "secondary" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
  disabled?: boolean
}) {
  const { addLine, qtyOf } = useCart()
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()
  const inCart = qtyOf(product.id)
  const unavailable = !product.in_stock

  async function handleClick(event: React.MouseEvent) {
    // Cards wrap this control in a Link/div with a navigation onClick — block both
    // bubbling and the anchor's default navigation so the item is added in place.
    event.preventDefault()
    event.stopPropagation()
    if (busy || unavailable || disabled) return
    setBusy(true)
    try {
      await addLine(
        {
          product_id: product.id,
          name: product.name,
          price: product.price,
          image_url: product.image_url ?? null,
          in_stock: product.in_stock,
          vendor_id: product.vendor_id,
          shop_name: product.shop_name,
        },
        quantity,
      )
      toast({
        title: "Added to cart",
        description: quantity > 1 ? `${quantity} × ${product.name}` : product.name,
      })
    } catch {
      toast({
        title: "Couldn't update cart",
        description: "Please try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={busy || unavailable || disabled}
      aria-label={
        unavailable
          ? `${product.name} is out of stock`
          : `Add ${product.name} to cart`
      }
      className={
        (showLabel
          ? "relative gap-2 rounded-full "
          : "relative h-8 w-8 rounded-full shadow-sm ") + (className ?? "")
      }
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : unavailable ? (
        <ShoppingCart className="h-4 w-4 opacity-50" />
      ) : inCart > 0 && !showLabel ? (
        <Check className="h-4 w-4" />
      ) : (
        <ShoppingCart className="h-4 w-4" />
      )}
      {showLabel && (
        <span>
          {unavailable ? "Out of Stock" : inCart > 0 ? `In Cart · ${inCart}` : "Add to Cart"}
        </span>
      )}
      {!showLabel && inCart > 0 && !unavailable && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
          {inCart > 99 ? "99+" : inCart}
        </span>
      )}
    </Button>
  )
}
