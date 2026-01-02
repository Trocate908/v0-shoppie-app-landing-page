import { BadgeCheck, Shield } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface VerificationBadgeProps {
  isVerified: boolean
  verificationExpiresAt?: string | null
  size?: "sm" | "md" | "lg"
  showProtection?: boolean
}

export function VerificationBadge({
  isVerified,
  verificationExpiresAt,
  size = "md",
  showProtection = false,
}: VerificationBadgeProps) {
  if (!isVerified) return null

  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  }

  const daysUntilExpiry = verificationExpiresAt
    ? Math.ceil((new Date(verificationExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            <BadgeCheck className={sizeClasses[size]} />
            Verified
            {showProtection && <Shield className={sizeClasses[size]} />}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            <p className="font-semibold">Verified Seller Benefits:</p>
            <ul className="space-y-1 text-xs">
              <li>✓ Identity verified by ShoppieApp</li>
              <li>✓ Priority in search results</li>
              <li>✓ Buyer protection guarantee</li>
              <li>✓ Increased customer trust</li>
            </ul>
            {daysUntilExpiry && daysUntilExpiry > 0 && (
              <p className="text-xs text-muted-foreground pt-1 border-t">
                Verification valid for {daysUntilExpiry} more days
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
