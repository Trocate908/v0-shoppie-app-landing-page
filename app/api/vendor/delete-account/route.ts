import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function DELETE() {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get vendor ID to delete associated data
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("id")
      .eq("user_id", user.id)
      .single()

    if (vendorError || !vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 })
    }

    // Delete product views first (foreign key constraint)
    const { data: products } = await supabase.from("products").select("id").eq("vendor_id", vendor.id)

    if (products && products.length > 0) {
      const productIds = products.map((p) => p.id)

      // Delete all product views
      const { error: viewsError } = await supabase.from("product_views").delete().in("product_id", productIds)

      if (viewsError) {
        console.error("Error deleting product views:", viewsError)
      }
    }

    // Delete all products (will cascade due to foreign key)
    const { error: productsError } = await supabase.from("products").delete().eq("vendor_id", vendor.id)

    if (productsError) {
      return NextResponse.json({ error: "Failed to delete products" }, { status: 500 })
    }

    // Delete vendor record
    const { error: deleteVendorError } = await supabase.from("vendors").delete().eq("id", vendor.id)

    if (deleteVendorError) {
      return NextResponse.json({ error: "Failed to delete vendor" }, { status: 500 })
    }

    // Delete auth user (this will cascade delete everything else)
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(user.id)

    if (deleteUserError) {
      console.error("Error deleting auth user:", deleteUserError)
      // Even if auth deletion fails, we've deleted the vendor data
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting account:", error)
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 })
  }
}
