import { NextResponse } from "next/server"
import { STATIC_FALLBACK_RATES } from "@/lib/currency"

export const revalidate = 3600

const MANUAL_RATES: Record<string, number> = {
  ZWL: 40.0,
  ZIG: 40.0,
}

const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
}

export async function GET() {
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD", {
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      return NextResponse.json(
        { rates: { USD: 1, ...STATIC_FALLBACK_RATES, ...MANUAL_RATES }, source: "fallback" },
        { headers: CACHE_HEADERS }
      )
    }

    const data = await res.json()

    const merged: Record<string, number> = {
      USD: 1,
      ...STATIC_FALLBACK_RATES,
      ...data.rates,
      ...MANUAL_RATES,
    }

    return NextResponse.json(
      { rates: merged, source: "live", date: data.date },
      { headers: CACHE_HEADERS }
    )
  } catch {
    return NextResponse.json(
      { rates: { USD: 1, ...STATIC_FALLBACK_RATES, ...MANUAL_RATES }, source: "fallback" },
      { headers: CACHE_HEADERS }
    )
  }
}
