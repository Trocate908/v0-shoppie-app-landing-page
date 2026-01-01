"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ProductCarouselProps = {
  images: { url: string; alt: string }[]
  productName: string
  autoSlide?: boolean
  autoSlideInterval?: number
}

export default function ProductCarousel({
  images,
  productName,
  autoSlide = true,
  autoSlideInterval = 5000,
}: ProductCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [touchStart, setTouchStart] = useState(0)
  const [touchEnd, setTouchEnd] = useState(0)

  // Handle navigation
  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }, [images.length])

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
  }

  // Auto-slide functionality
  useEffect(() => {
    if (!autoSlide || images.length <= 1) return

    const interval = setInterval(goToNext, autoSlideInterval)
    return () => clearInterval(interval)
  }, [autoSlide, autoSlideInterval, goToNext, images.length])

  // Handle touch events for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return

    const distance = touchStart - touchEnd
    const swipeThreshold = 50

    if (distance > swipeThreshold) {
      goToNext()
    } else if (distance < -swipeThreshold) {
      goToPrevious()
    }

    setTouchStart(0)
    setTouchEnd(0)
  }

  // Show placeholder if no images
  if (!images || images.length === 0) {
    return (
      <div className="relative h-64 w-full overflow-hidden rounded-lg bg-muted">
        <div className="flex h-full items-center justify-center">
          <span className="text-muted-foreground">No images available</span>
        </div>
      </div>
    )
  }

  // Single image - no carousel needed
  if (images.length === 1) {
    return (
      <div className="relative h-64 w-full overflow-hidden rounded-lg">
        <Image
          src={images[0].url || "/placeholder.svg"}
          alt={images[0].alt || productName}
          fill
          className="object-cover"
        />
      </div>
    )
  }

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-lg group">
      {/* Images */}
      <div
        className="relative h-full w-full"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {images.map((image, index) => (
          <div
            key={index}
            className={cn(
              "absolute inset-0 transition-opacity duration-500",
              index === currentIndex ? "opacity-100" : "opacity-0",
            )}
          >
            <Image
              src={image.url || "/placeholder.svg"}
              alt={image.alt || `${productName} - Image ${index + 1}`}
              fill
              className="object-cover"
            />
          </div>
        ))}
      </div>

      {/* Navigation Arrows (Desktop) */}
      <Button
        variant="secondary"
        size="icon"
        className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex"
        onClick={goToPrevious}
        aria-label="Previous image"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex"
        onClick={goToNext}
        aria-label="Next image"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Navigation Dots */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
        {images.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={cn(
              "h-2 w-2 rounded-full transition-all",
              index === currentIndex ? "bg-primary w-4" : "bg-primary/50 hover:bg-primary/75",
            )}
            aria-label={`Go to image ${index + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
