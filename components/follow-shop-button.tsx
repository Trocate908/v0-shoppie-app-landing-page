"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Bell, BellOff, Loader2, Users } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface FollowShopButtonProps {
  vendorId: string
  shopName: string
  initialIsFollowing?: boolean
  initialFollowerCount?: number
  showCount?: boolean
  size?: "sm" | "default" | "lg"
  className?: string
}

export default function FollowShopButton({
  vendorId,
  shopName,
  initialIsFollowing = false,
  initialFollowerCount = 0,
  showCount = true,
  size = "default",
  className,
}: FollowShopButtonProps) {
  const { toast } = useToast()
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [followerCount, setFollowerCount] = useState(initialFollowerCount)
  const [loading, setLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/shops/${vendorId}/follow`)
      if (!res.ok) return
      const data = await res.json()
      setIsFollowing(data.isFollowing)
      setFollowerCount(data.followerCount)
    } catch {
      // silent
    } finally {
      setHydrated(true)
    }
  }, [vendorId])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  async function toggle() {
    if (loading) return
    setLoading(true)

    const method = isFollowing ? "DELETE" : "POST"
    const optimisticFollowing = !isFollowing
    const optimisticCount = followerCount + (optimisticFollowing ? 1 : -1)

    setIsFollowing(optimisticFollowing)
    setFollowerCount(Math.max(0, optimisticCount))

    try {
      const res = await fetch(`/api/shops/${vendorId}/follow`, { method })

      if (res.status === 401) {
        setIsFollowing(!optimisticFollowing)
        setFollowerCount(followerCount)
        toast({
          title: "Sign in required",
          description: "Please sign in to follow shops.",
          variant: "destructive",
        })
        return
      }

      if (!res.ok) throw new Error("Request failed")

      const data = await res.json()
      setIsFollowing(data.isFollowing)
      setFollowerCount(data.followerCount)

      toast({
        title: data.isFollowing ? `Following ${shopName}` : `Unfollowed ${shopName}`,
        description: data.isFollowing
          ? "You'll be notified when they post new products."
          : "You won't receive updates from this shop.",
      })
    } catch {
      setIsFollowing(!optimisticFollowing)
      setFollowerCount(followerCount)
      toast({
        title: "Something went wrong",
        description: "Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (!hydrated) {
    return (
      <Button variant="outline" size={size} disabled className={className}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    )
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant={isFollowing ? "secondary" : "default"}
        size={size}
        onClick={toggle}
        disabled={loading}
        className={cn(
          "gap-2 transition-all",
          isFollowing && "border border-border"
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isFollowing ? (
          <BellOff className="h-4 w-4" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
        {isFollowing ? "Following" : "Follow Shop"}
      </Button>
      {showCount && followerCount > 0 && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          {followerCount.toLocaleString()}
        </span>
      )}
    </div>
  )
}
