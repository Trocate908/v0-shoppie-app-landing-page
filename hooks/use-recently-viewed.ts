"use client"

import { useCallback } from "react"

interface RecentProduct {
  id: string
  name: string
  price: number
  image_url: string | null
  shop_name: string
  viewedAt: number
}

const STORAGE_KEY = "shoppie_recently_viewed"
const MAX_ITEMS = 20

export function useRecentlyViewed() {
  const addProduct = useCallback((product: Omit<RecentProduct, "viewedAt">) => {
    if (typeof window === "undefined") return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const existing: RecentProduct[] = raw ? JSON.parse(raw) : []
      // Remove if already present, then prepend
      const filtered = existing.filter((p) => p.id !== product.id)
      const updated = [{ ...product, viewedAt: Date.now() }, ...filtered].slice(0, MAX_ITEMS)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch {
      // ignore storage errors
    }
  }, [])

  const getProducts = useCallback((): RecentProduct[] => {
    if (typeof window === "undefined") return []
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }, [])

  const clearProducts = useCallback(() => {
    if (typeof window === "undefined") return
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return { addProduct, getProducts, clearProducts }
}
