import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  if (user && (request.nextUrl.pathname === "/vendor/login" || request.nextUrl.pathname === "/vendor/signup")) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/vendor/dashboard"
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}
