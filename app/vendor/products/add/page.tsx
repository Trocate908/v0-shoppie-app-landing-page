import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AddProductForm } from "@/components/add-product-form"

export default async function AddProductPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/vendor/login")
  }

  // Fetch vendor data
  const { data: vendor } = await supabase.from("vendors").select("id, shop_name").eq("user_id", user.id).single()

  if (!vendor) {
    redirect("/vendor/signup")
  }

  return <AddProductForm vendorId={vendor.id} shopName={vendor.shop_name} />
}
