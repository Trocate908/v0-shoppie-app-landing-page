"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Reveals an element the first time it scrolls into view.
 *
 * Returns a ref to attach to the element and whether it has been revealed.
 * Respects `prefers-reduced-motion`: when the user asks for reduced motion the
 * element is marked revealed immediately, so content is never hidden behind an
 * animation they opted out of.
 */
export function useRevealOnScroll<T extends HTMLElement = HTMLDivElement>(
  options?: { threshold?: number; rootMargin?: string }
) {
  const ref = useRef<T | null>(null)
  const [isRevealed, setIsRevealed] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // No IntersectionObserver support, or the user prefers reduced motion:
    // show the content straight away rather than leaving it invisible.
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    if (prefersReducedMotion || typeof IntersectionObserver === "undefined") {
      setIsRevealed(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsRevealed(true)
            observer.disconnect()
          }
        }
      },
      {
        threshold: options?.threshold ?? 0.12,
        rootMargin: options?.rootMargin ?? "0px 0px -40px 0px",
      }
    )

    observer.observe(el)
    return () => observer.disconnect()
    // Options are static per call site; re-running on identity changes would
    // re-create the observer needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { ref, isRevealed }
}

export default useRevealOnScroll
