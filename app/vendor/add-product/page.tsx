import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AddProductForm } from "@/components/add-product-form"

export default async function AddProductPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/vendor/login")
  }

  const { data: vendor, error: vendorError } = await supabase
    .from("vendors")
    .select("id, shop_name, is_verified")
    .eq("user_id", user.id)
    .single()

  if (vendorError || !vendor) {
    redirect("/vendor/dashboard")
  }

  return <AddProductForm vendorId={vendor.id} shopName={vendor.shop_name} isVerified={vendor.is_verified || false} />
}
