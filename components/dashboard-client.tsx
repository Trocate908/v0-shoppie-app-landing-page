"use client"

import { useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { Eye, Package, LogOut, Plus, Settings, Trash2, ArrowLeft, Moon, Sun } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { EditProfileDialog } from "@/components/edit-profile-dialog"
import { useTheme } from "@/components/theme-provider"

type VendorData = {
  id: string
  shop_name: string
  shop_description?: string
  location_id: string
  is_open: boolean
  location: {
    name: string
    city: string
    country: string
  }
}

type DashboardClientProps = {
  vendor: VendorData
  totalViews: number
  weeklyViews: number
  productCount: number
}

export function DashboardClient({ vendor, totalViews, weeklyViews, productCount }: DashboardClientProps) {
  const [isOpen, setIsOpen] = useState(vendor.is_open)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()
  const { theme, toggleTheme } = useTheme()

  const handleToggleShop = async (checked: boolean) => {
    setIsUpdating(true)
    const supabase = createBrowserClient()

    try {
      const { error } = await supabase.from("vendors").update({ is_open: checked }).eq("id", vendor.id)

      if (error) throw error

      setIsOpen(checked)
      toast({
        title: "Shop status updated",
        description: `Your shop is now ${checked ? "open" : "closed"}`,
      })
    } catch {
      toast({
        title: "Update failed",
        description: "Failed to update shop status. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleLogout = async () => {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)

    try {
      const response = await fetch("/api/vendor/delete-account", {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete account")
      }

      toast({
        title: "Account deleted",
        description: "Your account and all products have been permanently deleted.",
      })

      // Sign out and redirect to home
      const supabase = createBrowserClient()
      await supabase.auth.signOut()
      window.location.href = "/"
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete account. Please try again.",
        variant: "destructive",
      })
      setIsDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2">
                <Button variant="ghost" size="sm" asChild className="mb-2">
                  <Link href="/browse">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Browse
                  </Link>
                </Button>
              </div>
              <h1 className="text-2xl font-bold text-foreground">{vendor.shop_name}</h1>
              <p className="text-sm text-muted-foreground">
                {vendor.location.name}, {vendor.location.city}, {vendor.location.country}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={toggleTheme}>
                {theme === "light" ? (
                  <>
                    <Moon className="mr-2 h-4 w-4" />
                    Dark
                  </>
                ) : (
                  <>
                    <Sun className="mr-2 h-4 w-4" />
                    Light
                  </>
                )}
              </Button>
              <EditProfileDialog vendor={vendor} />
              <Button variant="ghost" size="sm" onClick={handleLogout} className="w-fit">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Shop Status Card */}
          <Card>
            <CardHeader>
              <CardTitle>Shop Status</CardTitle>
              <CardDescription>Manage your shop availability</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label htmlFor="shop-status" className="text-base">
                  Shop is {isOpen ? "Open" : "Closed"}
                </Label>
                <Switch id="shop-status" checked={isOpen} onCheckedChange={handleToggleShop} disabled={isUpdating} />
              </div>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalViews.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">All time product views</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Weekly Views</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{weeklyViews.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Last 7 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Products</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{productCount}</div>
                <p className="text-xs text-muted-foreground">Total products listed</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Manage your products and shop</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <Button asChild className="h-auto flex-col items-start gap-2 p-4">
                <Link href="/vendor/products/add">
                  <div className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    <span className="font-semibold">Add Product</span>
                  </div>
                  <span className="text-xs font-normal opacity-90">List a new product in your shop</span>
                </Link>
              </Button>

              <Button asChild variant="outline" className="h-auto flex-col items-start gap-2 p-4 bg-transparent">
                <Link href="/vendor/products">
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    <span className="font-semibold">Manage Products</span>
                  </div>
                  <span className="text-xs font-normal opacity-90">View and edit your products</span>
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Danger Zone Card with Delete Account Button */}
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Permanently delete your account and all data</CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isDeleting} className="w-full sm:w-auto">
                    <Trash2 className="mr-2 h-4 w-4" />
                    {isDeleting ? "Deleting..." : "Delete Account"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your vendor account, all your products,
                      and remove all associated data from our servers.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Yes, delete my account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
