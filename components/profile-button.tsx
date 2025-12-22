"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { User } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export default function ProfileButton() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleProfileClick = async () => {
    setIsLoading(true)
    try {
      const supabase = createBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        // User is logged in, redirect to vendor dashboard
        router.push("/vendor/dashboard")
      } else {
        // User not logged in, redirect to login page
        router.push("/vendor/login")
      }
    } catch (error) {
      console.error("[v0] Profile button error:", error)
      // On error, redirect to login
      router.push("/vendor/login")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button variant="ghost" size="sm" className="gap-2" onClick={handleProfileClick} disabled={isLoading}>
      <User className="h-4 w-4" />
      <span className="hidden sm:inline">{isLoading ? "Loading..." : "Profile"}</span>
    </Button>
  )
}
