import { NextResponse } from "next/server"
import { STATIC_FALLBACK_RATES } from "@/lib/currency"

// Cache this route for 1 hour
export const revalidate = 3600

export async function GET() {
  try {
    // Fetch latest exchange rates with USD as the base currency
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD", {
      next: { revalidate: 3600 },
    })

    // If the API request fails, return fallback rates
    if (!res.ok) {
      return NextResponse.json({
        rates: {
          ...STATIC_FALLBACK_RATES,
          ZIG: 20.0, // Force 1 USD = 20.00 ZiG
        },
        source: "fallback",
      })
    }

    const data = await res.json()

    // Merge:
    // 1. USD base rate
    // 2. Static fallback rates
    // 3. Live API rates
    // 4. Manual override for ZiG
    const merged: Record<string, number> = {
      USD: 1,
      ...STATIC_FALLBACK_RATES,
      ...data.rates,
      ZIG: 20.0, // Always override with your preferred rate
    }

    return NextResponse.json({
      rates: merged,
      source: "live",
      date: data.date,
    })
  } catch {
    // If any unexpected error occurs, return fallback rates
    return NextResponse.json({
      rates: {
        ...STATIC_FALLBACK_RATES,
        ZIG: 20.0, // Force ZiG rate even in fallback mode
      },
      source: "fallback",
    })
  }
}
