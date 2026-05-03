import { NextResponse } from "next/server"
import { STATIC_FALLBACK_RATES } from "@/lib/currency"

// Cache for 1 hour via Next.js route cache
export const revalidate = 3600

export async function GET() {
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD", {
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      return NextResponse.json({ rates: STATIC_FALLBACK_RATES, source: "fallback" })
    }

    const data = await res.json()

    // Merge live rates with static fallback for currencies Frankfurter doesn't cover
    const merged: Record<string, number> = {
      USD: 1,
      ...STATIC_FALLBACK_RATES,
      ...data.rates, // live rates override static fallbacks where available
    }

    return NextResponse.json({ rates: merged, source: "live", date: data.date })
  } catch {
    return NextResponse.json({ rates: STATIC_FALLBACK_RATES, source: "fallback" })
  }
}
