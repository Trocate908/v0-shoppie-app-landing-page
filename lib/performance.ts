// Debounce function for search inputs
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}

// Throttle function for scroll events
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

// Lazy load images with intersection observer
export function lazyLoadImage(
  img: HTMLImageElement,
  src: string,
  placeholder = "/placeholder.svg"
) {
  img.src = placeholder

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          img.src = src
          observer.unobserve(img)
        }
      })
    })

    observer.observe(img)
  } else {
    img.src = src
  }
}

// Prefetch link on hover for better perceived performance
export function prefetchOnHover(href: string) {
  const link = document.createElement("link")
  link.rel = "prefetch"
  link.href = href
  document.head.appendChild(link)
}

// Batch state updates for better performance
export function batchUpdate<T>(
  updates: Array<() => void>,
  callback?: () => void
) {
  requestAnimationFrame(() => {
    updates.forEach((update) => update())
    callback?.()
  })
}
