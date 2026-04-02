import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

/**
 * Admin endpoint to manually verify/confirm a user by email
 * POST /api/admin/verify-user
 * Body: { email: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Check if user exists in Supabase Auth
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()

    if (listError) {
      return NextResponse.json(
        { error: `Failed to list users: ${listError.message}` },
        { status: 500 }
      )
    }

    const user = users.find((u) => u.email === email)

    if (!user) {
      return NextResponse.json(
        { error: `User with email ${email} not found` },
        { status: 404 }
      )
    }

    // Update user's email_confirmed_at to confirm email
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true,
    })

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to confirm user: ${updateError.message}` },
        { status: 500 }
      )
    }

    // Check if user has a vendor profile
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("id, shop_name, is_verified")
      .eq("user_id", user.id)
      .maybeSingle()

    if (vendorError && vendorError.code !== "PGRST116") {
      return NextResponse.json(
        { error: `Failed to check vendor status: ${vendorError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `User ${email} has been confirmed`,
      user: {
        id: user.id,
        email: user.email,
        email_confirmed_at: updatedUser.user?.email_confirmed_at,
      },
      vendor: vendor
        ? {
            id: vendor.id,
            shop_name: vendor.shop_name,
            is_verified: vendor.is_verified,
          }
        : null,
    })
  } catch (error) {
    console.error("[v0] Error verifying user:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An error occurred" },
      { status: 500 }
    )
  }
}
