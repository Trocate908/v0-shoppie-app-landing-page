"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Heart } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface FavoriteButtonProps {
  productId: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
  showLabel?: boolean
}

export default function FavoriteButton({
  productId,
  variant = "ghost",
  size = "icon",
  showLabel = false,
}: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkFavoriteStatus()
  }, [productId])

  const checkFavoriteStatus = async () => {
    try {
      const supabase = createBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setIsAuthenticated(false)
        return
      }

      setIsAuthenticated(true)

      const { data } = await supabase
        .from("favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .single()

      setIsFavorite(!!data)
    } catch (error) {
      // Not a favorite or user not authenticated
      setIsFavorite(false)
    }
  }

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!isAuthenticated) {
      toast.error("Please login to save favorites")
      router.push("/vendor/login")
      return
    }

    setIsLoading(true)
    try {
      const supabase = createBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error("Please login to save favorites")
        router.push("/vendor/login")
        return
      }

      if (isFavorite) {
        // Remove from favorites
        const { error } = await supabase.from("favorites").delete().eq("user_id", user.id).eq("product_id", productId)

        if (error) throw error
        setIsFavorite(false)
        toast.success("Removed from favorites")
      } else {
        // Add to favorites
        const { error } = await supabase.from("favorites").insert({ user_id: user.id, product_id: productId })

        if (error) throw error
        setIsFavorite(true)
        toast.success("Added to favorites")
      }
    } catch (error) {
      console.error("[v0] Error toggling favorite:", error)
      toast.error("Failed to update favorites")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button variant={variant} size={size} onClick={toggleFavorite} disabled={isLoading} className="gap-2">
      <Heart className={`h-4 w-4 ${isFavorite ? "fill-current text-red-500" : ""}`} />
      {showLabel && <span>{isFavorite ? "Saved" : "Save"}</span>}
    </Button>
  )
}
