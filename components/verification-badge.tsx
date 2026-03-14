import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import Image from "next/image"

interface VerificationBadgeProps {
  isVerified: boolean
  verificationExpiresAt?: string | null
  size?: "xs" | "sm" | "md" | "lg"
  showProtection?: boolean
  showTooltip?: boolean
}

export function VerificationBadge({
  isVerified,
  verificationExpiresAt,
  size = "md",
  showProtection = false,
  showTooltip = true,
}: VerificationBadgeProps) {
  if (!isVerified) return null

  // Hide badge if verification has expired
  if (verificationExpiresAt && new Date(verificationExpiresAt).getTime() < Date.now()) return null

  const sizeClasses = {
    xs: "h-3 w-3",
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  }

  const imageSizes = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
  }

  const daysUntilExpiry = verificationExpiresAt
    ? Math.ceil((new Date(verificationExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  const badgeContent = (
    <span className="inline-flex items-center">
      <Image
        src="/images/icons8-verified-badge-48-20-281-29.png"
        alt="Verified"
        width={imageSizes[size]}
        height={imageSizes[size]}
        className={sizeClasses[size]}
      />
    </span>
  )

  if (!showTooltip) {
    return badgeContent
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
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

export default VerificationBadge
