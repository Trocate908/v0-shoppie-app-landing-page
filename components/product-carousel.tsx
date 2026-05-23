"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const FALLBACK = "/logo.png"

type ProductCarouselProps = {
  images: string[]
  productName: string
  autoSlide?: boolean
  priority?: boolean
  aspectClass?: string
}

export default function ProductCarousel({ images, productName, autoSlide = false, priority = false, aspectClass = "aspect-[3/4]" }: ProductCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [failedSrcs, setFailedSrcs] = useState<Set<string>>(new Set())
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)

  const rawImages = images.length > 0 ? images.slice(0, 3) : []
  const displayImages = rawImages.length > 0 ? rawImages : [FALLBACK]

  const getDisplaySrc = (src: string) => (failedSrcs.has(src) ? FALLBACK : src)

  const handleError = (src: string) => {
    setFailedSrcs((prev) => new Set([...prev, src]))
  }

  useEffect(() => {
    if (!autoSlide || isHovered || displayImages.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % displayImages.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [autoSlide, isHovered, displayImages.length])

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % displayImages.length)
  }

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length)
  }

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }

  const handleTouchEnd = () => {
    const swipeDistance = touchStartX.current - touchEndX.current
    const minSwipeDistance = 50

    if (Math.abs(swipeDistance) > minSwipeDistance) {
      if (swipeDistance > 0) {
        goToNext()
      } else {
        goToPrevious()
      }
    }
  }

  if (displayImages.length === 1) {
    const src = displayImages[0]
    const displaySrc = getDisplaySrc(src)
    const isFallback = displaySrc === FALLBACK
    return (
      <div className={`relative ${aspectClass} w-full overflow-hidden bg-muted`}>
        <Image
          src={displaySrc}
          alt={productName}
          fill
          className={isFallback ? "object-contain p-6" : "object-cover"}
          priority={priority}
          loading={priority ? "eager" : "lazy"}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          onError={() => handleError(src)}
        />
      </div>
    )
  }

  return (
    <div
      className={`group relative ${aspectClass} w-full overflow-hidden bg-muted`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative h-full w-full">
        {displayImages.map((image, index) => {
          const displaySrc = getDisplaySrc(image)
          const isFallback = displaySrc === FALLBACK
          return (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-500 ${
                index === currentIndex ? "opacity-100" : "opacity-0"
              }`}
            >
              <Image
                src={displaySrc}
                alt={`${productName} - Image ${index + 1}`}
                fill
                className={isFallback ? "object-contain p-6" : "object-cover"}
                priority={priority && index === 0}
                loading={priority && index === 0 ? "eager" : "lazy"}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                onError={() => handleError(image)}
              />
            </div>
          )
        })}
      </div>

      <div className="absolute inset-0 flex items-center justify-between p-2 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 rounded-full bg-background/80 hover:bg-background"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            goToPrevious()
          }}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 rounded-full bg-background/80 hover:bg-background"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            goToNext()
          }}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {displayImages.length > 1 && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
          {displayImages.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                goToSlide(index)
              }}
              className={`h-2 w-2 rounded-full transition-all ${
                index === currentIndex ? "w-4 bg-primary" : "bg-background/60 hover:bg-background/80"
              }`}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
