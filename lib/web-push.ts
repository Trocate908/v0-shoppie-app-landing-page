import webPush from "web-push"

let configured = false

/**
 * Configures web-push with VAPID keys once. Safe to call multiple times.
 */
export function configureWebPush() {
  if (configured) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@shoppieapp.com"

  if (!publicKey || !privateKey) {
    throw new Error(
      "VAPID keys are not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars.",
    )
  }

  webPush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

export { webPush }
