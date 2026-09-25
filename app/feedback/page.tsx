import Link from "next/link"
import Image from "next/image"
import { MessageSquareWarning } from "lucide-react"
import ProfileButton from "@/components/profile-button"
import FeedbackClient from "@/components/feedback-client"
import { AppFooter } from "@/components/app-footer"

export const metadata = {
  title: "Report a Problem or Suggest an Idea - ShoppieApp",
  description:
    "Report anything wrong on ShoppieApp, or suggest an idea for the team. Follow the status of everything you send.",
  alternates: {
    canonical: "https://shoppieapp.co.zw/feedback",
  },
}

export default function FeedbackPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo.png" alt="ShoppieApp" width={32} height={32} className="h-8 w-8" />
              <h1 className="text-xl font-bold text-foreground">ShoppieApp</h1>
            </Link>
            <ProfileButton />
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="text-center">
            <div className="mb-3 flex justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950/50">
                <MessageSquareWarning className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              </span>
            </div>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              Help us make ShoppieApp better
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Spot something broken, or want a feature that does not exist yet?
              Send it here. Every report reaches the team, and every idea is
              tracked from submitted to shipped.
            </p>
          </div>

          <FeedbackClient />
        </div>
      </main>

      <AppFooter />
    </div>
  )
}
