import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import WishlistClient from "@/components/wishlist-client"

export const metadata = {
  title: "My Wishlist - ShoppieApp",
  description: "View your saved favorite products",
}

export default async function WishlistPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/vendor/login")
  }

  // Fetch user's favorite products
  const { data: favorites } = await supabase
    .from("favorites")
    .select(
      `
      id,
      created_at,
      product:products(
        id,
        name,
        description,
        price,
        category,
        image_url,
        in_stock,
        vendor:vendors(
          id,
          shop_name,
          is_open,
          whatsapp_number,
          location:locations(
            id,
            country,
            city,
            market_name
          )
        )
      )
    `,
    )
    .order("created_at", { ascending: false })

  const products = favorites?.map((fav: any) => fav.product).filter(Boolean) || []

  return <WishlistClient products={products} />
}
