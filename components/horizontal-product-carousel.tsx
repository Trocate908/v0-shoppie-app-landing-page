"use client"

import { useEffect, useRef, useState, type ComponentType } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ChevronRight, MapPin, Package } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import FavoriteButton from "@/components/favorite-button"
import { VerificationBadge } from "@/components/verification-badge"

const FALLBACK_IMAGE = "/logo.png"

/** Minimal product shape consumed by the carousel. Compatible with the
 *  homepage/`products` payload — extra fields on incoming objects are fine. */
export interface CarouselProduct {
  id: string
  name: string
  price: number
  original_price?: number | null
  /** Set by the homepage query when the products.is_featured column exists. */
  is_featured?: boolean
  image_url: string | null
  image_urls?: string[] | null
  in_stock: boolean
  created_at?: string | null
  vendor: {
    id?: string
    shop_name: string
    is_verified?: boolean
    verification_expires_at?: string | null
    location?: {
      id?: string
      city: string
      market_name?: string
      country?: string
    }
  }
}

export interface HorizontalProductCarouselProps {
  title: string
  icon?: ComponentType<{ className?: string }>
  products: CarouselProduct[]
  seeAllUrl?: string
  seeAllLabel?: string
  loading?: boolean
  /** Message shown when there are no products. When omitted the whole
   *  section is hidden while empty (keeps the page tidy by default). */
  emptyStateMessage?: string
  /** Accent classes for the header icon chip, e.g. "bg-amber-500/15 text-amber-500". */
  accentClassName?: string
  /** "card" = standard product card. "banner" = wide image-first banner
   *  showing only the price (used for the Featured section). */
  variant?: "card" | "banner"
}

/** How many cards are visible per breakpoint (width of one card relative to
 *  the scroll container). Mobile 2–2.5 cards, tablet 3–4, desktop 4–6. */
const CARD_WIDTH_CLASSES =
  "w-[44%] sm:w-[31%] md:w-[23.5%] lg:w-[19%] xl:w-[16%]"

const BANNER_WIDTH_CLASSES =
  "w-[80%] sm:w-[62%] md:w-[46%] lg:w-[36%] xl:w-[30%]"

const IMAGE_SIZES =
  "(max-width: 640px) 44vw, (max-width: 768px) 31vw, (max-width: 1024px) 24vw, (max-width: 1280px) 19vw, 16vw"

const BANNER_IMAGE_SIZES =
  "(max-width: 640px) 80vw, (max-width: 768px) 62vw, (max-width: 1024px) 46vw, (max-width: 1280px) 36vw, 30vw"

function resolveImage(product: CarouselProduct): string | null {
  if (Array.isArray(product.image_urls)) {
    const first = product.image_urls.find((u) => !!u)
    if (first) return first
  }
  return product.image_url || null
}

function discountPercent(product: CarouselProduct): number | null {
  if (
    typeof product.original_price === "number" &&
    product.original_price > product.price &&
    product.price > 0
  ) {
    return Math.round(((product.original_price - product.price) / product.original_price) * 100)
  }
  return null
}

function isActivelyVerified(product: CarouselProduct): boolean {
  return (
    !!product.vendor.is_verified &&
    (!product.vendor.verification_expires_at ||
      new Date(product.vendor.verification_expires_at).getTime() >= Date.now())
  )
}

/* ── Product card ─────────────────────────────────────────────────────── */

export function CarouselProductCard({
  product,
  eager = false,
  variant = "card",
  animationDelayMs = 0,
}: {
  product: CarouselProduct
  eager?: boolean
  variant?: "card" | "banner"
  /** Stagger offset for the banner entrance animation. */
  animationDelayMs?: number
}) {
  const img = resolveImage(product)
  const discount = discountPercent(product)
  const location = product.vendor.location
  const locationLabel = location
    ? [location.market_name, location.city].filter(Boolean).join(", ") || null
    : null

  if (variant === "banner") {
    return (
      <Link
        href={`/product/${product.id}`}
        aria-label={`${product.name}, ${product.price.toFixed(2)} USD`}
        style={{ animationDelay: `${animationDelayMs}ms` }}
        className={[
          "banner-animate-in banner-shine",
          "group/card relative block shrink-0 snap-start overflow-hidden rounded-2xl border border-border/60 bg-card",
          "shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          BANNER_WIDTH_CLASSES,
        ].join(" ")}
      >
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted sm:aspect-[2/1]">
          {img ? (
            <Image
              src={img}
              alt={`${product.name} from ${product.vendor.shop_name}`}
              fill
              className="banner-ken-burns object-cover"
              loading={eager ? "eager" : "lazy"}
              sizes={BANNER_IMAGE_SIZES}
              quality={75}
              priority={eager}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Image
                src={FALLBACK_IMAGE}
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 opacity-30"
                loading="lazy"
              />
            </div>
          )}

          {/* Bottom scrim so the price stays readable on any image */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent"
            aria-hidden
          />

          {/* Price only */}
          <span
            style={{ animationDelay: `${animationDelayMs + 220}ms` }}
            className="banner-price-pop absolute bottom-3 left-3 rounded-full bg-background/95 px-3 py-1 text-base font-extrabold text-primary shadow-md"
          >
            ${product.price.toFixed(2)}
          </span>
        </div>
      </Link>
    )
  }

  return (
    <Link
      href={`/product/${product.id}`}
      aria-label={`${product.name}, ${product.price.toFixed(2)} USD, from ${product.vendor.shop_name}`}
      className={[
        "group/card relative flex shrink-0 flex-col snap-start rounded-xl border border-border/60 bg-card",
        "overflow-hidden shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        CARD_WIDTH_CLASSES,
      ].join(" ")}
    >
      {/* Image */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
        {img ? (
          <Image
            src={img}
            alt={`${product.name} from ${product.vendor.shop_name}`}
            fill
            className="object-cover transition-transform duration-300 group-hover/card:scale-[1.04]"
            loading={eager ? "eager" : "lazy"}
            sizes={IMAGE_SIZES}
            quality={70}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Image
              src={FALLBACK_IMAGE}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 opacity-30"
              loading="lazy"
            />
          </div>
        )}

        {/* Badges */}
        <div className="absolute left-1.5 top-1.5 flex flex-col items-start gap-1">
          {!product.in_stock && (
            <span className="rounded-sm bg-black/75 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
              Sold Out
            </span>
          )}
          {discount !== null && (
            <span className="rounded-sm bg-destructive px-1.5 py-0.5 text-[9px] font-bold text-white">
              -{discount}%
            </span>
          )}
        </div>

        {/* Favourite — always visible so it works on touch devices */}
        <div className="absolute right-1.5 top-1.5" onClick={(e) => e.stopPropagation()}>
          <FavoriteButton productId={product.id} variant="ghost" />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-0.5 px-2 pb-2.5 pt-2">
        <div className="flex items-baseline gap-1.5">
          <p className="text-sm font-bold leading-tight text-primary">
            ${product.price.toFixed(2)}
          </p>
          {product.original_price && discount !== null && (
            <span className="text-[11px] text-muted-foreground line-through">
              ${product.original_price.toFixed(2)}
            </span>
          )}
        </div>

        <h3 className="line-clamp-2 text-[12px] leading-snug text-foreground/90 transition-colors group-hover/card:text-primary">
          {product.name}
        </h3>

        <div className="mt-0.5 flex items-center gap-1">
          <span className="truncate text-[10px] leading-none text-muted-foreground">
            {product.vendor.shop_name}
          </span>
          {isActivelyVerified(product) && (
            <VerificationBadge isVerified size="xs" showTooltip={false} />
          )}
        </div>

        {locationLabel && (
          <div className="mt-0.5 flex items-center gap-0.5 text-[10px] leading-none text-muted-foreground/80">
            <MapPin className="h-2.5 w-2.5 shrink-0" aria-hidden />
            <span className="truncate">{locationLabel}</span>
          </div>
        )}
      </div>
    </Link>
  )
}

function CarouselCardSkeleton({ variant = "card" }: { variant?: "card" | "banner" }) {
  if (variant === "banner") {
    return (
      <div className={`shrink-0 snap-start ${BANNER_WIDTH_CLASSES}`}>
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <Skeleton className="aspect-[16/9] w-full rounded-none" />
        </div>
      </div>
    )
  }
  return (
    <div className={`shrink-0 snap-start ${CARD_WIDTH_CLASSES}`}>
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <Skeleton className="aspect-[3/4] w-full rounded-none" />
        <div className="space-y-2 px-2 pb-3 pt-2">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
      </div>
    </div>
  )
}

/* ── Carousel section ─────────────────────────────────────────────────── */

export default function HorizontalProductCarousel({
  title,
  icon: Icon,
  products,
  seeAllUrl,
  seeAllLabel = "See all",
  loading = false,
  emptyStateMessage,
  accentClassName = "bg-primary/10 text-primary",
  variant = "card",
}: HorizontalProductCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = () => {
    const el = scrollerRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }

  useEffect(() => {
    updateScrollState()
    const onResize = () => updateScrollState()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [products.length, loading])

  const scrollByCards = (direction: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" })
  }

  if (loading) {
    return (
      <section aria-busy="true" aria-label={`${title} (loading)`} className="min-w-0">
        <SectionHeader
          title={title}
          icon={Icon}
          accentClassName={accentClassName}
          seeAllUrl={seeAllUrl}
          seeAllLabel={seeAllLabel}
        />
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-3 overflow-hidden pb-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <CarouselCardSkeleton key={i} variant={variant} />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (products.length === 0) {
    if (!emptyStateMessage) return null
    return (
      <section aria-label={title} className="min-w-0">
        <SectionHeader
          title={title}
          icon={Icon}
          accentClassName={accentClassName}
          seeAllUrl={seeAllUrl}
          seeAllLabel={seeAllLabel}
        />
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-card/50 px-4 py-5 text-sm text-muted-foreground">
          <Package className="h-4 w-4 shrink-0" aria-hidden />
          {emptyStateMessage}
        </div>
      </section>
    )
  }

  return (
    <section aria-label={title} className="group/carousel min-w-0">
      <SectionHeader
        title={title}
        icon={Icon}
        accentClassName={accentClassName}
        seeAllUrl={seeAllUrl}
        seeAllLabel={seeAllLabel}
      />

      <div className="relative">
        {/* Desktop nav — previous */}
        <button
          type="button"
          onClick={() => scrollByCards(-1)}
          disabled={!canScrollLeft}
          aria-label={`Scroll ${title} backwards`}
          className={[
            "absolute -left-1 top-[38%] z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border",
            "bg-background/90 shadow-md backdrop-blur transition-opacity duration-200 md:flex",
            "hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            canScrollLeft
              ? "opacity-0 group-hover/carousel:opacity-100 focus-visible:opacity-100"
              : "pointer-events-none opacity-0",
          ].join(" ")}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>

        {/* Scroll container — hidden scrollbar, keyboard accessible */}
        <div
          ref={scrollerRef}
          onScroll={updateScrollState}
          tabIndex={0}
          role="region"
          aria-label={`${title} — horizontally scrollable product list. Use left and right arrow keys to scroll.`}
          className={[
            "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-2 pt-1",
            "sm:mx-0 sm:px-0",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg",
          ].join(" ")}
        >
          {products.map((product, i) => (
            <CarouselProductCard
              key={product.id}
              product={product}
              eager={i < 2}
              variant={variant}
              animationDelayMs={variant === "banner" ? i * 90 : 0}
            />
          ))}
        </div>

        {/* Desktop nav — next */}
        <button
          type="button"
          onClick={() => scrollByCards(1)}
          disabled={!canScrollRight}
          aria-label={`Scroll ${title} forwards`}
          className={[
            "absolute -right-1 top-[38%] z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border",
            "bg-background/90 shadow-md backdrop-blur transition-opacity duration-200 md:flex",
            "hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            canScrollRight
              ? "opacity-0 group-hover/carousel:opacity-100 focus-visible:opacity-100"
              : "pointer-events-none opacity-0",
          ].join(" ")}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </section>
  )
}

function SectionHeader({
  title,
  icon: Icon,
  accentClassName,
  seeAllUrl,
  seeAllLabel,
}: {
  title: string
  icon?: ComponentType<{ className?: string }>
  accentClassName: string
  seeAllUrl?: string
  seeAllLabel: string
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        {Icon && (
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${accentClassName}`}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
        <h2 className="truncate text-base font-bold text-foreground">{title}</h2>
      </div>
      {seeAllUrl && (
        <Link
          href={seeAllUrl}
          className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          {seeAllLabel}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          <span className="sr-only">for {title}</span>
        </Link>
      )}
    </div>
  )
}
