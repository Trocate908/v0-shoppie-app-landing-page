import Image from "next/image"
import Link from "next/link"

export function AppFooter() {
  return (
    <footer className="border-t border-border bg-card/50 py-5 text-center text-xs text-muted-foreground">
      <div className="flex flex-col items-center justify-center gap-2">
        <div className="flex items-center gap-1.5">
          <div className="relative h-5 w-5 overflow-hidden rounded-md">
            <Image src="/logo.png" alt="ShoppieApp" fill className="object-cover" />
          </div>
          <span>© {new Date().getFullYear()} ShoppieApp · Local marketplace</span>
        </div>
        <div className="flex items-center gap-3 text-muted-foreground">
          <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
          <span>·</span>
          <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
        </div>
      </div>
    </footer>
  )
}
