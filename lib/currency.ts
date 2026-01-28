export interface Currency {
  code: string
  symbol: string
  name: string
}

export const CURRENCIES: Record<string, Currency> = {
  USD: { code: "USD", symbol: "$", name: "US Dollar" },
  EUR: { code: "EUR", symbol: "€", name: "Euro" },
  GBP: { code: "GBP", symbol: "£", name: "British Pound" },
  MWK: { code: "MWK", symbol: "MK", name: "Malawian Kwacha" },
  ZAR: { code: "ZAR", symbol: "R", name: "South African Rand" },
  KES: { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  TZS: { code: "TZS", symbol: "TSh", name: "Tanzanian Shilling" },
  UGX: { code: "UGX", symbol: "USh", name: "Ugandan Shilling" },
  ZMW: { code: "ZMW", symbol: "ZK", name: "Zambian Kwacha" },
  NGN: { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
  GHS: { code: "GHS", symbol: "₵", name: "Ghanaian Cedi" },
}

// Country to currency mapping (expandable)
export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  "United States": "USD",
  "United Kingdom": "GBP",
  Germany: "EUR",
  France: "EUR",
  Spain: "EUR",
  Italy: "EUR",
  Malawi: "MWK",
  "South Africa": "ZAR",
  Kenya: "KES",
  Tanzania: "TZS",
  Uganda: "UGX",
  Zambia: "ZMW",
  Nigeria: "NGN",
  Ghana: "GHS",
}

// Approximate exchange rates (USD base)
// In production, fetch from API like exchangerate-api.com
export const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  MWK: 1730,
  ZAR: 18.5,
  KES: 129,
  TZS: 2520,
  UGX: 3700,
  ZMW: 27,
  NGN: 1550,
  GHS: 15.5,
}

export function getCurrencyForCountry(country: string): Currency {
  const currencyCode = COUNTRY_TO_CURRENCY[country] || "USD"
  return CURRENCIES[currencyCode]
}

export function convertPrice(priceUSD: number, toCurrency: string): number {
  const rate = EXCHANGE_RATES[toCurrency] || 1
  return priceUSD * rate
}

export function formatPrice(price: number, currency: Currency): string {
  return `${currency.symbol}${price.toFixed(2)}`
}
