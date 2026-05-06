"use client"

/**
 * Compatibility shim — every existing consumer (notification-prompt,
 * notifications-client, notification-provider, notification-debug-client)
 * imports `useFcm` from this file. Internally we now delegate to
 * `useOneSignal`, which is the single source of truth for push.
 *
 * The legacy implementation registered our own `/sw.js` and called
 * `pushManager.subscribe()` directly — which conflicted with the
 * OneSignal service worker at scope "/" and silently broke notifications
 * on Android Chrome. That entire path is gone.
 */

import { useOneSignal } from "@/hooks/use-onesignal"

export function useFcm() {
  const { status, enable, dismissSoftPrompt, shouldShowSoftPrompt } = useOneSignal()
  // `token` is no longer surfaced — OneSignal manages the subscription
  // internally. Debug UI just shows "(managed by OneSignal)".
  const token: string | null = status === "granted" ? "(managed by OneSignal)" : null
  return { status, token, enable, dismissSoftPrompt, shouldShowSoftPrompt }
}
