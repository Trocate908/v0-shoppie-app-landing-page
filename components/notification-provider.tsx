"use client"

import { useOneSignal } from "@/hooks/use-onesignal"
import { NotificationPrompt } from "@/components/notification-prompt"

/**
 * Mounted once at the root.
 * Boots the OneSignal SDK lifecycle and renders the soft permission prompt.
 */
export function NotificationProvider() {
  useOneSignal()
  return <NotificationPrompt />
}
