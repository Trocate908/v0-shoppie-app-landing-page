import { BadgeCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface VerificationBadgeProps {
  isVerified: boolean
  size?: "sm" | "md" | "lg"
}

export function VerificationBadge({ isVerified, size = "md" }: VerificationBadgeProps) {
  if (!isVerified) return null

  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            <BadgeCheck className={sizeClasses[size]} />
            Verified
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>This vendor has been verified by ShoppieApp</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
