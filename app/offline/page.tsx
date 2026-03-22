import type { Metadata } from "next"
import OfflineClient from "@/components/offline-client"

export const metadata: Metadata = {
  title: "You are offline - ShoppieApp",
  description: "You are currently offline. View your saved products.",
}

export default function OfflinePage() {
  return <OfflineClient />
}
