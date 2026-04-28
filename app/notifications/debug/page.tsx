import DebugGate from "@/components/notification-debug-gate"

export const metadata = {
  title: "Notification diagnostics — ShoppieApp",
  description: "Debug push notifications (developer options)",
  // Don't expose this in search results.
  robots: { index: false, follow: false },
}

export default function NotificationDebugPage() {
  return <DebugGate />
}
