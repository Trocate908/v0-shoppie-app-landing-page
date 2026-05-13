import { NextResponse } from "next/server"
import { STATIC_FALLBACK_RATES } from "@/lib/currency"

// Cache the route for 1 hour
export const revalidate = 3600

// Manual overrides for currencies you want to force
const MANUAL_RATES: Record<string, number> = {
  // 1 USD = 20.00 ZiG
  ZWL: 20.0, // If your frontend still uses "ZWL"
  ZIG: 20.0, // If your frontend uses the newer "ZIG" code
}

export async function GET() {
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD", {
      next: { revalidate: 3600 },
    })

    // If API fails, return fallback + manual overrides
    if (!res.ok) {
      return NextResponse.json({
        rates: {
          USD: 1,
          ...STATIC_FALLBACK_RATES,
          ...MANUAL_RATES,
        },
        source: "fallback",
      })
    }

    const data = await res.json()

    // Merge in this order:
    // 1. Base USD
    // 2. Static fallback rates
    // 3. Live API rates
    // 4. Manual overrides (always win)
    const merged: Record<string, number> = {
      USD: 1,
      ...STATIC_FALLBACK_RATES,
      ...data.rates,
      ...MANUAL_RATES,
    }

    return NextResponse.json({
      rates: merged,
      source: "live",
      date: data.date,
    })
  } catch {
    // Network or parsing error
    return NextResponse.json({
      rates: {
        USD: 1,
        ...STATIC_FALLBACK_RATES,
        ...MANUAL_RATES,
      },
      source: "fallback",
    })
  }
        }
