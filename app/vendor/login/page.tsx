"use client"

import type React from "react"
import { Suspense } from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { saveAccount, setActiveAccountId } from "@/lib/account-switcher"

function VendorLoginForm() {
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email")
  const [phone, setPhone] = useState("")
  const [phonePassword, setPhonePassword] = useState("")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const searchParams = useSearchParams()
  const isAddingAccount = searchParams.get("add_account") === "1"

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        phone,
        password: phonePassword,
      })

      if (loginError) throw loginError
      if (!data.user) throw new Error("Login failed - no user returned")

      await new Promise((resolve) => setTimeout(resolve, 500))
      window.location.href = "/vendor/dashboard"
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
      setIsLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      if (!data.user || !data.session) throw new Error("Login failed - no user returned")

      // Fetch vendor info to save in account switcher
      const { data: vendor } = await supabase
        .from("vendors")
        .select("shop_name, profile_picture_url")
        .eq("user_id", data.user.id)
        .single()

      // Save account for multi-account switching
      saveAccount({
        userId: data.user.id,
        email: data.user.email ?? email,
        shopName: vendor?.shop_name ?? "Vendor",
        profilePictureUrl: vendor?.profile_picture_url ?? null,
        refreshToken: data.session.refresh_token,
        accessToken: data.session.access_token,
      })
      setActiveAccountId(data.user.id)

      await new Promise((resolve) => setTimeout(resolve, 300))
      window.location.href = "/vendor/dashboard"
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{isAddingAccount ? "Add Account" : "Vendor Login"}</CardTitle>
              <CardDescription>
                {isAddingAccount
                  ? "Login with another vendor account to switch between them"
                  : "Login to your vendor account"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={authMethod} onValueChange={(v) => setAuthMethod(v as "email" | "phone")}>
                <TabsContent value="email">
                  <form onSubmit={handleLogin}>
                    <div className="flex flex-col gap-6">
                      <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="vendor@example.com"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>
                      {error && <p className="text-sm text-red-500">{error}</p>}
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? "Logging in..." : isAddingAccount ? "Add Account" : "Login"}
                      </Button>
                    </div>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="mt-4 text-center text-sm">
                Don&apos;t have an account?{" "}
                <Link href="/vendor/signup" className="underline underline-offset-4">
                  Sign up
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function VendorLoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-svh items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    }>
      <VendorLoginForm />
    </Suspense>
  )
}

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        phone,
        password: phonePassword,
      })

      if (loginError) throw loginError
      if (!data.user) throw new Error("Login failed - no user returned")

      await new Promise((resolve) => setTimeout(resolve, 500))
      window.location.href = "/vendor/dashboard"
    } catch (error: unknown) {
      console.error("[v0] Phone login error:", error)
      setError(error instanceof Error ? error.message : "An error occurred")
      setIsLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      if (!data.user || !data.session) throw new Error("Login failed - no user returned")

      // Fetch vendor info to save in account switcher
      const { data: vendor } = await supabase
        .from("vendors")
        .select("shop_name, profile_picture_url")
        .eq("user_id", data.user.id)
        .single()

      // Save account for multi-account switching
      saveAccount({
        userId: data.user.id,
        email: data.user.email ?? email,
        shopName: vendor?.shop_name ?? "Vendor",
        profilePictureUrl: vendor?.profile_picture_url ?? null,
        refreshToken: data.session.refresh_token,
        accessToken: data.session.access_token,
      })
      setActiveAccountId(data.user.id)

      await new Promise((resolve) => setTimeout(resolve, 300))
      window.location.href = isAddingAccount ? "/vendor/dashboard" : "/vendor/dashboard"
    } catch (error: unknown) {
      console.error("[v0] Login error:", error)
      setError(error instanceof Error ? error.message : "An error occurred")
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{isAddingAccount ? "Add Account" : "Vendor Login"}</CardTitle>
              <CardDescription>
                {isAddingAccount
                  ? "Login with another vendor account to switch between them"
                  : "Login to your vendor account"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={authMethod} onValueChange={(v) => setAuthMethod(v as "email" | "phone")}>
                {/* Temporarily hidden - will be enabled after Twilio SMS subscription */}
                {/* <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="email">Email</TabsTrigger>
                  <TabsTrigger value="phone">Phone</TabsTrigger>
                </TabsList> */}

                <TabsContent value="email">
                  <form onSubmit={handleLogin}>
                    <div className="flex flex-col gap-6">
                      <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="vendor@example.com"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>
                      {error && <p className="text-sm text-red-500">{error}</p>}
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? "Logging in..." : "Login"}
                      </Button>
                    </div>
                  </form>
                </TabsContent>

                {/* Temporarily hidden - Phone authentication will be enabled after Twilio SMS subscription */}
                {/* <TabsContent value="phone">
                  <form onSubmit={handlePhoneLogin}>
                    <div className="flex flex-col gap-6">
                      <div className="grid gap-2">
                        <Label htmlFor="phone-login">Phone Number</Label>
                        <Input
                          id="phone-login"
                          type="tel"
                          placeholder="+1234567890"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Include country code (e.g., +1 for US)</p>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="phone-password">Password</Label>
                        <Input
                          id="phone-password"
                          type="password"
                          required
                          value={phonePassword}
                          onChange={(e) => setPhonePassword(e.target.value)}
                        />
                      </div>

                      {error && <p className="text-sm text-red-500">{error}</p>}

                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? "Logging in..." : "Login"}
                      </Button>
                    </div>
                  </form>
                </TabsContent> */}
              </Tabs>

              <div className="mt-4 text-center text-sm">
                Don&apos;t have an account?{" "}
                <Link href="/vendor/signup" className="underline underline-offset-4">
                  Sign up
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
