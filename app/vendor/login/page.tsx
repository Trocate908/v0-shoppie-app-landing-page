"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { useState } from "react"

export default function VendorLoginPage() {
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email")
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [showOtpInput, setShowOtpInput] = useState(false)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      if (!showOtpInput) {
        // Step 1: Send OTP
        const { error: otpError } = await supabase.auth.signInWithOtp({
          phone,
        })

        if (otpError) throw otpError

        setShowOtpInput(true)
        setIsLoading(false)
      } else {
        // Step 2: Verify OTP
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          phone,
          token: otp,
          type: "sms",
        })

        if (verifyError) throw verifyError
        if (!data.user) throw new Error("Login failed - no user returned")

        await new Promise((resolve) => setTimeout(resolve, 500))
        window.location.href = "/vendor/dashboard"
      }
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

    console.log("[v0] Starting login process")

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log("[v0] Login response:", data, error)

      if (error) throw error

      if (!data.user) {
        throw new Error("Login failed - no user returned")
      }

      await new Promise((resolve) => setTimeout(resolve, 500))

      console.log("[v0] Redirecting to dashboard")
      window.location.href = "/vendor/dashboard"
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
              <CardTitle className="text-2xl">Vendor Login</CardTitle>
              <CardDescription>Login to your vendor account</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={authMethod} onValueChange={(v) => setAuthMethod(v as "email" | "phone")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="email">Email</TabsTrigger>
                  <TabsTrigger value="phone">Phone</TabsTrigger>
                </TabsList>

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

                <TabsContent value="phone">
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
                          disabled={showOtpInput}
                        />
                        <p className="text-xs text-muted-foreground">Include country code (e.g., +1 for US)</p>
                      </div>

                      {showOtpInput && (
                        <div className="grid gap-2">
                          <Label htmlFor="otp-login">Verification Code</Label>
                          <Input
                            id="otp-login"
                            type="text"
                            placeholder="123456"
                            required
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            maxLength={6}
                          />
                          <p className="text-xs text-muted-foreground">Enter the 6-digit code sent to your phone</p>
                        </div>
                      )}

                      {error && <p className="text-sm text-red-500">{error}</p>}

                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? "Processing..." : showOtpInput ? "Verify & Login" : "Send Code"}
                      </Button>

                      {showOtpInput && (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full bg-transparent"
                          onClick={() => {
                            setShowOtpInput(false)
                            setOtp("")
                            setError(null)
                          }}
                        >
                          Change Phone Number
                        </Button>
                      )}
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
