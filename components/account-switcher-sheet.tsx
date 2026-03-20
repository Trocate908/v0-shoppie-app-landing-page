"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import {
  getSavedAccounts,
  removeAccount,
  setActiveAccountId,
  type SavedAccount,
} from "@/lib/account-switcher"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Store, Plus, LogIn, Check, Trash2, ChevronRight, RefreshCw } from "lucide-react"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

type AccountSwitcherSheetProps = {
  currentUserId: string
  trigger?: React.ReactNode
}

export function AccountSwitcherSheet({ currentUserId, trigger }: AccountSwitcherSheetProps) {
  const [accounts, setAccounts] = useState<SavedAccount[]>([])
  const [open, setOpen] = useState(false)
  const [switchingTo, setSwitchingTo] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    if (open) {
      setAccounts(getSavedAccounts())
    }
  }, [open])

  const handleSwitch = async (account: SavedAccount) => {
    if (account.userId === currentUserId) {
      setOpen(false)
      return
    }

    setSwitchingTo(account.userId)
    const supabase = createBrowserClient()

    try {
      // Set the session using the stored refresh token
      const { data, error } = await supabase.auth.setSession({
        access_token: account.accessToken,
        refresh_token: account.refreshToken,
      })

      if (error) {
        // If the stored tokens are expired, we need to re-authenticate
        toast({
          title: "Session expired",
          description: `Please log back into ${account.shopName} to refresh the session.`,
          variant: "destructive",
        })
        setSwitchingTo(null)
        return
      }

      if (data.user) {
        setActiveAccountId(data.user.id)
        toast({
          title: "Switched account",
          description: `Now logged in as ${account.shopName}`,
        })
        setOpen(false)
        // Small delay then reload
        await new Promise((r) => setTimeout(r, 300))
        window.location.href = "/vendor/dashboard"
      }
    } catch {
      toast({
        title: "Switch failed",
        description: "Could not switch to this account. Please log in again.",
        variant: "destructive",
      })
    } finally {
      setSwitchingTo(null)
    }
  }

  const handleRemove = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    removeAccount(userId)
    setAccounts(getSavedAccounts())
    toast({ title: "Account removed", description: "Account removed from saved list." })
  }

  const handleAddAccount = () => {
    setOpen(false)
    // Navigate to login with a flag indicating we want to add an account
    window.location.href = "/vendor/login?add_account=1"
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Switch Account
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-2xl">
        <SheetHeader className="mb-4">
          <SheetTitle>Your Accounts</SheetTitle>
        </SheetHeader>

        <div className="space-y-2 overflow-y-auto">
          {accounts.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No saved accounts found.
            </div>
          ) : (
            accounts.map((account) => {
              const isActive = account.userId === currentUserId
              const isSwitching = switchingTo === account.userId

              return (
                <button
                  key={account.userId}
                  onClick={() => handleSwitch(account)}
                  disabled={isSwitching}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-60"
                >
                  {/* Avatar */}
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                    {account.profilePictureUrl ? (
                      <Image
                        src={account.profilePictureUrl}
                        alt={account.shopName}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Store className="h-5 w-5 text-primary" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-foreground">{account.shopName}</p>
                    <p className="truncate text-xs text-muted-foreground">{account.email}</p>
                  </div>

                  {/* Status */}
                  <div className="shrink-0 flex items-center gap-2">
                    {isActive && (
                      <span className="flex items-center gap-1 text-xs font-medium text-primary">
                        <Check className="h-3.5 w-3.5" />
                        Active
                      </span>
                    )}
                    {isSwitching && (
                      <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {!isActive && !isSwitching && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <button
                      onClick={(e) => handleRemove(account.userId, e)}
                      className="ml-1 rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Remove account"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </button>
              )
            })
          )}

          {/* Add another account */}
          <button
            onClick={handleAddAccount}
            className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary hover:bg-primary/5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-border">
              <Plus className="h-5 w-5" />
            </div>
            <span className="font-medium">Add another account</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
