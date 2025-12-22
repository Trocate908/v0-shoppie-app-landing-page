"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { createBrowserClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Image from "next/image"

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
        router.push("/vendor/dashboard")
      } else {
        router.push("/vendor/login")
      }
    } catch (error) {
      console.error("[v0] Profile button error:", error)
      router.push("/vendor/login")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button variant="ghost" size="sm" className="gap-2" onClick={handleProfileClick} disabled={isLoading}>
      <Image src="/logo.png" alt="Profile" width={20} height={20} className="h-5 w-5" />
      <span className="hidden sm:inline">{isLoading ? "Loading..." : "Profile"}</span>
    </Button>
  )
}
