import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Validate environment variables are available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "[v0] Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    )
    // Return early without auth if env vars are missing
    return supabaseResponse
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
      },
    },
  })

  let user = null
  try {
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()
    
    if (authError) {
      console.error("[v0] Auth error in proxy:", authError.message)
    }
    user = authUser
  } catch (error) {
    console.error("[v0] Exception getting user in proxy:", error)
  }

  // Protect vendor routes
  if (
    request.nextUrl.pathname.startsWith("/vendor/dashboard") ||
    request.nextUrl.pathname.startsWith("/vendor/products")
  ) {
    if (!user) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = "/vendor/login"
      redirectUrl.searchParams.set("redirected", "true")
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Allow logged-in users to visit /vendor/login when adding another account
  const isAddingAccount = request.nextUrl.searchParams.get("add_account") === "1"

  if (
    user &&
    !isAddingAccount &&
    (request.nextUrl.pathname === "/vendor/login" || request.nextUrl.pathname === "/vendor/signup")
  ) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/vendor/dashboard"
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}
