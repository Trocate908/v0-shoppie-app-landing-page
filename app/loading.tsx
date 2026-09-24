import { Skeleton } from "@/components/ui/skeleton"

/** Route-level loading state. Previously this rendered `null`, which meant
 *  every client-side navigation flashed a blank white page. This mirrors the
 *  homepage shape — header, category chips, then a featured banner and a
 *  product grid — so the layout doesn't jump when the real page arrives. */
export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading page"
      className="mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8"
    >
      {/* Header + category chips */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-40 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />
          ))}
        </div>
      </div>

      {/* Section title */}
      <div className="mb-3 flex items-center gap-2">
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-5 w-32" />
      </div>

      {/* Featured banner */}
      <Skeleton className="mb-8 h-40 w-full rounded-2xl sm:h-52" />

      {/* Section title */}
      <div className="mb-3 flex items-center gap-2">
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-5 w-28" />
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  )
}
