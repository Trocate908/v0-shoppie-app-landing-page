"use client"

import { useFcm } from "@/hooks/use-fcm"
import { NotificationPrompt } from "@/components/notification-prompt"

/**
 * Mounted once at the root. Boots the FCM lifecycle (auto-registers
 * tokens for users who already granted permission) and renders the
 * dismissable soft prompt for everyone else.
 */
export function NotificationProvider() {
  // Just calling the hook is enough — it registers the token automatically.
  useFcm()
  return <NotificationPrompt />
}
