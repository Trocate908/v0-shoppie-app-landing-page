"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import {
  clampQty,
  clearGuestCart,
  MAX_QTY,
  readGuestCart,
  writeGuestCart,
  type CartLine,
} from "@/lib/cart"

// The cart lives in public.cart_items under RLS whenever a Supabase session
// exists (anonymous buyers included — the same pattern message-seller-button
// uses for chat). With no session at all, lines live in localStorage and are
// merged into the account cart on the first sign-in.

type CartMode = "loading" | "guest" | "server"

export type NewCartLine = Omit<CartLine, "quantity">

type CartContextValue = {
  lines: CartLine[]
  mode: CartMode
  /** Total number of units across all lines — shown in the navigation. */
  count: number
  qtyOf: (productId: string) => number
  addLine: (line: NewCartLine, quantity?: number) => Promise<void>
  setQuantity: (productId: string, quantity: number) => Promise<void>
  removeLine: (productId: string) => Promise<void>
  /** Ensure a Supabase session exists before checkout (signs in anonymously
   *  for guests, mirroring the existing buyer flow), then triggers the
   *  guest-cart merge. Resolves true when a session is available. */
  ensureSession: () => Promise<boolean>
  refresh: () => Promise<void>
}

const CartContext = createContext<CartContextValue | null>(null)

const SERVER_LINE_SELECT = `
  product_id,
  quantity,
  product:products (
    id,
    name,
    price,
    image_url,
    in_stock,
    vendor_id,
    vendor:vendors ( id, shop_name )
  )
`

type ServerRow = {
  product_id: string
  quantity: number
  product: {
    id: string
    name: string
    price: number
    image_url: string | null
    in_stock: boolean
    vendor_id: string
    vendor: { id: string; shop_name: string } | null
  } | null
}

function toLineFromServer(row: ServerRow): CartLine | null {
  const product = row.product
  if (!product || !product.vendor) return null
  return {
    product_id: product.id,
    quantity: clampQty(row.quantity),
    name: product.name,
    price: Number(product.price),
    image_url: product.image_url,
    in_stock: product.in_stock,
    vendor_id: product.vendor_id,
    shop_name: product.vendor.shop_name,
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [mode, setMode] = useState<CartMode>("loading")

  const uidRef = useRef<string | null>(null)
  const mergedForRef = useRef<string | null>(null)
  // Resolves once the first load (server or guest) has completed, so early
  // add/remove taps wait for the real cart instead of clobbering it.
  const readyRef = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null)
  if (!readyRef.current) {
    let resolveFn: () => void = () => {}
    const promise = new Promise<void>((resolve) => {
      resolveFn = resolve
    })
    readyRef.current = { promise, resolve: resolveFn }
  }

  const refresh = useCallback(async () => {
    // Never rejects: supabase-js throws on network errors instead of
    // returning an error object, and an unhandled rejection here used to
    // bubble into checkout's generic "Something went wrong" toast — even
    // after an order had already succeeded.
    try {
      const supabase = createBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      uidRef.current = user?.id ?? null
      if (user) {
        await loadServerCart(user.id)
      } else {
        await loadGuestCart()
      }
    } catch (error) {
      console.error("[cart] refresh failed:", error)
    }
  }, [])

  const loadServerCart = useCallback(async (uid: string) => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from("cart_items")
      .select(SERVER_LINE_SELECT)
    if (error) {
      console.error("[cart] failed to load server cart:", error.message)
      return
    }
    const next = ((data ?? []) as unknown as ServerRow[])
      .map(toLineFromServer)
      .filter((line): line is CartLine => line !== null)
    setLines(next)
    setMode("server")
  }, [])

  const loadGuestCart = useCallback(async () => {
    const guest = readGuestCart()
    if (guest.length === 0) {
      setLines([])
      setMode("guest")
      return
    }
    const supabase = createBrowserClient()
    const { data } = await supabase
      .from("products")
      .select(
        `id, name, price, image_url, in_stock, vendor_id, vendor:vendors ( id, shop_name )`,
      )
      .in(
        "id",
        guest.map((g) => g.product_id),
      )
    const byId = new Map<string, ServerRow["product"]>()
    for (const row of (data ?? []) as unknown as NonNullable<ServerRow["product"]>[]) {
      byId.set(row.id, row)
    }
    const next: CartLine[] = []
    for (const g of guest) {
      const product = byId.get(g.product_id)
      if (!product || !product.vendor) continue
      next.push({
        product_id: product.id,
        quantity: g.quantity,
        name: product.name,
        price: Number(product.price),
        image_url: product.image_url,
        in_stock: product.in_stock,
        vendor_id: product.vendor_id,
        shop_name: product.vendor.shop_name,
      })
    }
    setLines(next)
    setMode("guest")
  }, [])

  /** Move guest (localStorage) lines into the account cart. Quantities add
   *  up, capped at the DB's 999 limit. */
  const mergeGuestIntoServer = useCallback(async (uid: string) => {
    const guest = readGuestCart()
    if (guest.length === 0) return
    const supabase = createBrowserClient()

    // Drop guest lines whose product has since been deleted (FK safety).
    const { data: products } = await supabase
      .from("products")
      .select("id")
      .in(
        "id",
        guest.map((g) => g.product_id),
      )
    const valid = new Set((products ?? []).map((p: { id: string }) => p.id))

    const { data: serverRows } = await supabase
      .from("cart_items")
      .select("product_id, quantity")
      .eq("user_id", uid)

    const quantityByProduct = new Map<string, number>()
    for (const row of (serverRows ?? []) as { product_id: string; quantity: number }[]) {
      quantityByProduct.set(row.product_id, row.quantity)
    }
    for (const g of guest) {
      if (!valid.has(g.product_id)) continue
      const current = quantityByProduct.get(g.product_id) ?? 0
      quantityByProduct.set(
        g.product_id,
        Math.min(MAX_QTY, current + g.quantity),
      )
    }

    const rows = Array.from(quantityByProduct.entries()).map(
      ([product_id, quantity]) => ({ user_id: uid, product_id, quantity }),
    )
    if (rows.length > 0) {
      const { error } = await supabase
        .from("cart_items")
        .upsert(rows, { onConflict: "user_id,product_id" })
      if (error) console.error("[cart] guest merge failed:", error.message)
    }
    clearGuestCart()
  }, [])

  // ── Auth lifecycle: load, merge on sign-in, fall back to guest on sign-out
  useEffect(() => {
    const supabase = createBrowserClient()
    let active = true

    const bootstrap = async (uid: string | null) => {
      uidRef.current = uid
      try {
        if (uid) {
          if (mergedForRef.current !== uid) {
            // Flip the guard before awaiting so a concurrent bootstrap (or
            // ensureSession) can't run the merge twice and double quantities.
            mergedForRef.current = uid
            await mergeGuestIntoServer(uid)
          }
          if (active) await loadServerCart(uid)
        } else {
          if (active) await loadGuestCart()
        }
      } finally {
        if (active) readyRef.current?.resolve()
      }
    }

    // Initial state (works with or without INITIAL_SESSION support).
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active) void bootstrap(data.user?.id ?? null)
      })
      .catch(() => {
        if (active) void bootstrap(null)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id ?? null
      if (event === "SIGNED_OUT") {
        mergedForRef.current = null
      }
      void bootstrap(uid)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [loadGuestCart, loadServerCart, mergeGuestIntoServer])

  const persistGuest = useCallback((next: CartLine[]) => {
    writeGuestCart(next.map((l) => ({ product_id: l.product_id, quantity: l.quantity })))
    setLines(next)
    setMode("guest")
  }, [])

  const persistServerLine = useCallback(
    async (productId: string, quantity: number | null) => {
      const uid = uidRef.current
      if (!uid) return
      const supabase = createBrowserClient()
      if (quantity === null) {
        const { error } = await supabase
          .from("cart_items")
          .delete()
          .eq("user_id", uid)
          .eq("product_id", productId)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase
          .from("cart_items")
          .upsert(
            { user_id: uid, product_id: productId, quantity },
            { onConflict: "user_id,product_id" },
          )
        if (error) throw new Error(error.message)
      }
    },
    [],
  )

  const addLine = useCallback(
    async (line: NewCartLine, quantity = 1) => {
      await readyRef.current?.promise
      const qty = clampQty(quantity)
      setLines((prev) => {
        const existing = prev.find((l) => l.product_id === line.product_id)
        if (existing) {
          return prev.map((l) =>
            l.product_id === line.product_id
              ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + qty) }
              : l,
          )
        }
        return [...prev, { ...line, quantity: qty }]
      })
      try {
        if (uidRef.current) {
          const supabase = createBrowserClient()
          const { data: existingRow } = await supabase
            .from("cart_items")
            .select("quantity")
            .eq("product_id", line.product_id)
            .maybeSingle()
          const nextQty = Math.min(MAX_QTY, (existingRow?.quantity ?? 0) + qty)
          await persistServerLine(line.product_id, nextQty)
        } else {
          const guest = readGuestCart()
          const found = guest.find((g) => g.product_id === line.product_id)
          if (found) {
            found.quantity = Math.min(MAX_QTY, found.quantity + qty)
          } else {
            guest.push({ product_id: line.product_id, quantity: qty })
          }
          writeGuestCart(guest)
        }
      } catch (error) {
        console.error("[cart] add failed:", error)
        await refresh()
        throw error
      }
    },
    [persistServerLine, refresh],
  )

  const setQuantity = useCallback(
    async (productId: string, quantity: number) => {
      await readyRef.current?.promise
      if (quantity <= 0) {
        await removeLineRef.current(productId)
        return
      }
      const qty = clampQty(quantity)
      setLines((prev) =>
        prev.map((l) => (l.product_id === productId ? { ...l, quantity: qty } : l)),
      )
      try {
        if (uidRef.current) {
          await persistServerLine(productId, qty)
        } else {
          const guest = readGuestCart()
          const found = guest.find((g) => g.product_id === productId)
          if (found) {
            found.quantity = qty
            writeGuestCart(guest)
          }
        }
      } catch (error) {
        console.error("[cart] quantity update failed:", error)
        await refresh()
        throw error
      }
    },
    [persistServerLine, refresh],
  )

  const removeLine = useCallback(
    async (productId: string) => {
      await readyRef.current?.promise
      setLines((prev) => prev.filter((l) => l.product_id !== productId))
      try {
        if (uidRef.current) {
          await persistServerLine(productId, null)
        } else {
          writeGuestCart(
            readGuestCart().filter((g) => g.product_id !== productId),
          )
        }
      } catch (error) {
        console.error("[cart] remove failed:", error)
        await refresh()
        throw error
      }
    },
    [persistServerLine, refresh],
  )

  // setQuantity delegates to removeLine for qty <= 0; keep a ref so the
  // callbacks can reference each other without a dependency cycle.
  const removeLineRef = useRef(removeLine)
  removeLineRef.current = removeLine

  const ensureSession = useCallback(async () => {
    // Never rejects: no session is `false`, and a failed cart sync after the
    // session exists is logged but non-fatal (the server re-validates the
    // whole order anyway). supabase-js throws on network errors, which used
    // to escape into checkout's generic failure toast.
    try {
      const supabase = createBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      let uid = user?.id ?? null
      if (!uid) {
        const { data, error } = await supabase.auth.signInAnonymously()
        if (error || !data?.user) {
          console.error("[cart] anonymous sign-in failed:", error?.message)
          return false
        }
        uid = data.user.id
      }
      uidRef.current = uid
      // Await the merge + reload so a guest cart is fully in the account before
      // checkout runs (the auth listener may be mid-merge; the guard makes this
      // call and the listener cooperate instead of merging twice).
      if (mergedForRef.current !== uid) {
        mergedForRef.current = uid
        try {
          await mergeGuestIntoServer(uid)
        } catch (error) {
          // Guest lines stay in localStorage (clearGuestCart only runs at the
          // end of a successful merge), so a later refresh can finish the job.
          console.error("[cart] guest-cart merge failed:", error)
        }
      }
      try {
        await loadServerCart(uid)
      } catch (error) {
        console.error("[cart] cart reload failed:", error)
      }
      return true
    } catch (error) {
      console.error("[cart] ensureSession failed:", error)
      return false
    }
  }, [loadServerCart, mergeGuestIntoServer])

  const qtyOf = useCallback(
    (productId: string) => lines.find((l) => l.product_id === productId)?.quantity ?? 0,
    [lines],
  )

  const count = useMemo(() => lines.reduce((sum, l) => sum + l.quantity, 0), [lines])

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      mode,
      count,
      qtyOf,
      addLine,
      setQuantity,
      removeLine,
      ensureSession,
      refresh,
    }),
    [lines, mode, count, qtyOf, addLine, setQuantity, removeLine, ensureSession, refresh],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}
