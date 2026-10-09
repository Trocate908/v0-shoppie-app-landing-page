"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createBrowserClient } from "@/lib/supabase/client"
import { useCart, type NewCartLine } from "@/components/cart-provider"
import { useToast } from "@/hooks/use-toast"

/** A previous order's contents, as snapshotted in public.order_items. */
export type ReorderItem = {
  product_id: string | null
  quantity: number
}

type ProductRow = {
  id: string
  name: string
  price: number | string
  image_url: string | null
  in_stock: boolean
  vendor_id: string
  vendor: { id: string; shop_name: string } | null
}

/**
 * Re-adds a past order's items to the cart. Prices and stock are re-read from
 * the catalog rather than reused from the order snapshot, so a reorder never
 * resurrects a stale price; unavailable lines are skipped and reported.
 */
export default function ReorderButton({
  items,
  label = "Reorder",
  variant = "outline",
  size = "sm",
  className,
  goToCart = true,
}: {
  items: ReorderItem[]
  label?: string
  variant?: "default" | "outline" | "secondary"
  size?: "default" | "sm" | "lg"
  className?: string
  goToCart?: boolean
}) {
  const router = useRouter()
  const { addLines } = useCart()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  const productIds = Array.from(
    new Set(
      items
        .map((item) => item.product_id)
        .filter((id): id is string => Boolean(id)),
    ),
  )

  async function handleReorder() {
    if (busy) return
    if (productIds.length === 0) {
      toast({
        title: "Nothing to reorder",
        description: "These products are no longer listed.",
        variant: "destructive",
      })
      return
    }

    setBusy(true)
    try {
      const supabase = createBrowserClient()
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, image_url, in_stock, vendor_id, vendor:vendors ( id, shop_name )")
        .in("id", productIds)

      if (error) throw new Error(error.message)

      const byId = new Map<string, ProductRow>()
      for (const row of (data ?? []) as unknown as ProductRow[]) {
        if (row.vendor) byId.set(row.id, row)
      }

      const entries: Array<{ line: NewCartLine; quantity: number }> = []
      let skipped = 0
      for (const item of items) {
        const product = item.product_id ? byId.get(item.product_id) : undefined
        const vendor = product?.vendor
        if (!product || !vendor || !product.in_stock) {
          skipped += 1
          continue
        }
        entries.push({
          line: {
            product_id: product.id,
            name: product.name,
            price: Number(product.price),
            image_url: product.image_url,
            in_stock: product.in_stock,
            vendor_id: product.vendor_id,
            shop_name: vendor.shop_name,
          },
          quantity: item.quantity,
        })
      }

      if (entries.length === 0) {
        toast({
          title: "Nothing to reorder",
          description:
            "Everything from this order is out of stock or no longer listed.",
          variant: "destructive",
        })
        return
      }

      const added = await addLines(entries)
      toast({
        title: `${added} ${added === 1 ? "item" : "items"} added to your cart`,
        description:
          skipped > 0
            ? `${skipped} ${skipped === 1 ? "item" : "items"} from this order ${
                skipped === 1 ? "is" : "are"
              } unavailable right now and ${
                skipped === 1 ? "was" : "were"
              } skipped.`
            : undefined,
      })
      if (goToCart) router.push("/cart")
    } catch (error) {
      console.error("[reorder] failed:", error)
      toast({
        title: "Couldn't reorder",
        description: "Please try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={busy}
      onClick={handleReorder}
    >
      {busy ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <RotateCcw className="mr-2 h-4 w-4" />
      )}
      {busy ? "Adding…" : label}
    </Button>
  )
}
