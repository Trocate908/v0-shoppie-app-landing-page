import type React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, ShieldCheck, Sparkles, Store } from "lucide-react"

type AuthShellProps = {
  /**
   * "signup" shows the welcoming "Join the marketplace" copy on the brand panel,
   * "login" shows the "Welcome back" variant.
   */
  variant?: "login" | "signup"
  /**
   * Title above the form card (mobile-only header) — falls back to a sensible
   * default per variant if not provided.
   */
  eyebrow?: string
  /**
   * Optional override for the headline shown on the brand panel (lg+).
   */
  headline?: string
  /**
   * Optional override for the subheadline shown on the brand panel (lg+).
   */
  subheadline?: string
  children: React.ReactNode
}

const VARIANT_DEFAULTS = {
  login: {
    eyebrow: "Sign in",
    headline: "Welcome back to your shop.",
    subheadline:
      "Manage your products, chat with shoppers, and keep your storefront fresh — all from one place.",
  },
  signup: {
    eyebrow: "Create account",
    headline: "Bring your shop online in minutes.",
    subheadline:
      "Reach nearby shoppers looking for exactly what you sell. Free to join, no setup fees, ever.",
  },
} as const

/**
 * Branded auth layout used by /vendor/login and /vendor/signup.
 *
 * Layout strategy:
 *  - Mobile: single column. A compact branded header with the logo sits above
 *    the form card so the brand is always visible without crowding the form.
 *  - Desktop (lg+): two columns. The left side is a marketing/brand panel with
 *    the logo, value prop, and trust signals, and the right side hosts the
 *    form scrolled within a clean, focused column.
 *
 * Uses only theme design tokens (primary, foreground, background, etc.) so it
 * automatically respects light/dark mode and any future theme tweaks.
 */
export function AuthShell({
  variant = "login",
  eyebrow,
  headline,
  subheadline,
  children,
}: AuthShellProps) {
  const defaults = VARIANT_DEFAULTS[variant]
  const finalEyebrow = eyebrow ?? defaults.eyebrow
  const finalHeadline = headline ?? defaults.headline
  const finalSubheadline = subheadline ?? defaults.subheadline

  return (
    <div className="relative min-h-svh bg-background text-foreground">
      {/* Subtle ambient backdrop — pure CSS radial gradients tinted with the
          primary color. Sits behind everything, doesn't affect layout. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: "var(--primary)" }}
        />
        <div
          className="absolute -bottom-32 -right-32 h-[460px] w-[460px] rounded-full opacity-10 blur-3xl"
          style={{ backgroundColor: "var(--primary)" }}
        />
      </div>

      {/* Top-left back link, available on all viewports */}
      <Link
        href="/"
        className="absolute left-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur transition-colors hover:bg-muted"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Home
      </Link>

      <div className="relative z-10 mx-auto grid min-h-svh w-full max-w-7xl grid-cols-1 lg:grid-cols-2">
        {/* Brand panel — desktop only */}
        <aside className="relative hidden lg:flex">
          <div className="relative flex w-full flex-col justify-between overflow-hidden bg-primary px-12 py-14 text-primary-foreground">
            {/* Decorative pattern */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
                backgroundSize: "22px 22px",
              }}
            />
            {/* Soft glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -right-24 h-[380px] w-[380px] rounded-full bg-white/10 blur-3xl"
            />

            {/* Top: logo + wordmark */}
            <div className="relative flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-white/20">
                <Image
                  src="/logo.png"
                  alt="ShoppieApp logo"
                  width={36}
                  height={36}
                  className="h-9 w-9"
                  priority
                />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold leading-tight tracking-tight">
                  ShoppieApp
                </span>
                <span className="text-xs text-primary-foreground/75">
                  Local vendors, made discoverable
                </span>
              </div>
            </div>

            {/* Middle: headline */}
            <div className="relative max-w-md">
              <p className="mb-3 text-sm font-medium uppercase tracking-widest text-primary-foreground/70">
                For Vendors
              </p>
              <h1 className="text-balance text-4xl font-bold leading-[1.1] tracking-tight">
                {finalHeadline}
              </h1>
              <p className="mt-4 text-pretty text-base leading-relaxed text-primary-foreground/85">
                {finalSubheadline}
              </p>
            </div>

            {/* Bottom: trust signals */}
            <div className="relative flex flex-col gap-3">
              <TrustItem
                icon={<Store className="h-4 w-4" />}
                label="Set up your shop in minutes"
              />
              <TrustItem
                icon={<Sparkles className="h-4 w-4" />}
                label="Get discovered by nearby shoppers"
              />
              <TrustItem
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Secure payments &amp; trusted platform"
              />
            </div>
          </div>
        </aside>

        {/* Form panel */}
        <main className="flex w-full items-start justify-center px-4 py-10 sm:px-6 lg:items-center lg:px-12 lg:py-14">
          <div className="w-full max-w-md">
            {/* Mobile-only branded header (logo + tagline above the form) */}
            <div className="mb-6 flex flex-col items-center text-center lg:hidden">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20 ring-1 ring-primary/40">
                <Image
                  src="/logo.png"
                  alt="ShoppieApp logo"
                  width={40}
                  height={40}
                  className="h-10 w-10"
                  priority
                />
              </div>
              <p className="text-lg font-bold tracking-tight text-foreground">ShoppieApp</p>
              <p className="text-xs text-muted-foreground">
                Local vendors, made discoverable
              </p>
            </div>

            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
              {finalEyebrow}
            </p>

            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

function TrustItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-primary-foreground ring-1 ring-white/20">
        {icon}
      </span>
      <span className="text-sm text-primary-foreground/90">{label}</span>
    </div>
  )
}
