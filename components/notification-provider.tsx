"use client"

import { useEffect, useState } from "react"
import { usePush } from "@/hooks/use-push"
import { useSocket } from "@/hooks/use-socket"
import { NotificationPrompt } from "@/components/notification-prompt"
import { createBrowserClient } from "@/lib/supabase/client"

let _client: ReturnType<typeof createBrowserClient> | null = null
function getClient() {
  if (!_client) _client = createBrowserClient()
  return _client
}

/**
 * Mounted once at the root. Boots native VAPID push subscription,
 * opens a Socket.io connection for real-time in-app delivery, and
 * renders the dismissable soft prompt for users who haven't granted yet.
 */
export function NotificationProvider() {
  usePush()

  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    getClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (user?.id) setUserId(user.id)
      })

    const { data: { subscription } } = getClient().auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
    })
    return () => { subscription.unsubscribe() }
  }, [])

  // Connect to Socket.io when the user is known
  const socket = useSocket(userId)

  useEffect(() => {
    if (!socket) return
    const handler = () => {
      // Dispatch a custom DOM event — notification-bell listens for this
      window.dispatchEvent(new CustomEvent("shoppie:notification"))
    }
    socket.on("notification", handler)
    return () => { socket.off("notification", handler) }
  }, [socket])

  // Also listen for push messages relayed from the service worker
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_RECEIVED") {
        window.dispatchEvent(new CustomEvent("shoppie:notification"))
      }
    }
    navigator.serviceWorker.addEventListener("message", handler)
    return () => { navigator.serviceWorker.removeEventListener("message", handler) }
  }, [])

  return <NotificationPrompt />
}
