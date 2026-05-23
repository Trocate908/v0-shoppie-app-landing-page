"use client"

import type React from "react"
import { Suspense } from "react"
import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import Link from "next/link"
import { saveAccount, setActiveAccountId, getSavedAccounts } from "@/lib/account-switcher"

function VendorLoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const searchParams = useSearchParams()
  const isAddingAccount = searchParams.get("add_account") === "1"

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      // When adding an account, snapshot & save the current session FIRST before
      // Supabase overwrites it with the new signInWithPassword call.
      if (isAddingAccount) {
        const { data: existing } = await supabase.auth.getSession()
        if (existing.session) {
          const { data: existingVendor } = await supabase
            .from("vendors")
            .select("shop_name, profile_picture_url")
            .eq("user_id", existing.session.user.id)
            .single()
          saveAccount({
            userId: existing.session.user.id,
            email: existing.session.user.email ?? "",
            shopName: existingVendor?.shop_name ?? "Vendor",
            profilePictureUrl: existingVendor?.profile_picture_url ?? null,
            refreshToken: existing.session.refresh_token,
            accessToken: existing.session.access_token,
          })
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (!data.user || !data.session) throw new Error("Login failed - no user returned")

      // Check if this account is already saved to prevent duplicates
      if (isAddingAccount) {
        const savedAccounts = getSavedAccounts()
        const alreadyExists = savedAccounts.some((a) => a.userId === data.user.id)
        if (alreadyExists) {
          setError("This account is already added. Please use a different account.")
          setIsLoading(false)
          return
        }
      }

      // Fetch vendor info and save the new account
      const { data: vendor } = await supabase
        .from("vendors")
        .select("shop_name, profile_picture_url")
        .eq("user_id", data.user.id)
        .single()

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                {isAddingAccount ? "Add Account" : "Vendor Login"}
              </CardTitle>
              <CardDescription>
                {isAddingAccount
                  ? "Login with another vendor account to switch between them"
                  : "Login to your vendor account"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="email">
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
                      {error && <p className="text-sm text-destructive">{error}</p>}
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? "Logging in..." : isAddingAccount ? "Add Account" : "Login"}
                      </Button>
                    </div>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="mt-4 text-center text-sm">
                {isAddingAccount ? (
                  <Link href="/vendor/dashboard" className="underline underline-offset-4 text-muted-foreground">
                    Cancel — back to dashboard
                  </Link>
                ) : (
                  <>
                    Don&apos;t have an account?{" "}
                    <Link href="/vendor/signup" className="underline underline-offset-4">
                      Sign up
                    </Link>
                  </>
                )}
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
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <VendorLoginForm />
    </Suspense>
  )
}
