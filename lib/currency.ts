export interface Currency {
  code: string
  symbol: string
  name: string
  flag: string
}

export const CURRENCIES: Record<string, Currency> = {
  // Major world currencies (supported by Frankfurter live rates)
  USD: { code: "USD", symbol: "$",    name: "US Dollar",            flag: "🇺🇸" },
  EUR: { code: "EUR", symbol: "€",    name: "Euro",                 flag: "🇪🇺" },
  GBP: { code: "GBP", symbol: "£",    name: "British Pound",        flag: "🇬🇧" },
  JPY: { code: "JPY", symbol: "¥",    name: "Japanese Yen",         flag: "🇯🇵" },
  AUD: { code: "AUD", symbol: "A$",   name: "Australian Dollar",    flag: "🇦🇺" },
  CAD: { code: "CAD", symbol: "C$",   name: "Canadian Dollar",      flag: "🇨🇦" },
  CHF: { code: "CHF", symbol: "Fr",   name: "Swiss Franc",          flag: "🇨🇭" },
  CNY: { code: "CNY", symbol: "¥",    name: "Chinese Yuan",         flag: "🇨🇳" },
  SEK: { code: "SEK", symbol: "kr",   name: "Swedish Krona",        flag: "🇸🇪" },
  NZD: { code: "NZD", symbol: "NZ$",  name: "New Zealand Dollar",   flag: "🇳🇿" },
  SGD: { code: "SGD", symbol: "S$",   name: "Singapore Dollar",     flag: "🇸🇬" },
  HKD: { code: "HKD", symbol: "HK$",  name: "Hong Kong Dollar",     flag: "🇭🇰" },
  INR: { code: "INR", symbol: "₹",    name: "Indian Rupee",         flag: "🇮🇳" },
  BRL: { code: "BRL", symbol: "R$",   name: "Brazilian Real",       flag: "🇧🇷" },
  MXN: { code: "MXN", symbol: "MX$",  name: "Mexican Peso",         flag: "🇲🇽" },
  TRY: { code: "TRY", symbol: "₺",    name: "Turkish Lira",         flag: "🇹🇷" },
  KRW: { code: "KRW", symbol: "₩",    name: "South Korean Won",     flag: "🇰🇷" },
  IDR: { code: "IDR", symbol: "Rp",   name: "Indonesian Rupiah",    flag: "🇮🇩" },
  NOK: { code: "NOK", symbol: "kr",   name: "Norwegian Krone",      flag: "🇳🇴" },
  DKK: { code: "DKK", symbol: "kr",   name: "Danish Krone",         flag: "🇩🇰" },
  PLN: { code: "PLN", symbol: "zł",   name: "Polish Zloty",         flag: "🇵🇱" },
  THB: { code: "THB", symbol: "฿",    name: "Thai Baht",            flag: "🇹🇭" },
  MYR: { code: "MYR", symbol: "RM",   name: "Malaysian Ringgit",    flag: "🇲🇾" },
  PHP: { code: "PHP", symbol: "₱",    name: "Philippine Peso",      flag: "🇵🇭" },
  CZK: { code: "CZK", symbol: "Kč",   name: "Czech Koruna",         flag: "🇨🇿" },
  HUF: { code: "HUF", symbol: "Ft",   name: "Hungarian Forint",     flag: "🇭🇺" },
  RON: { code: "RON", symbol: "lei",  name: "Romanian Leu",         flag: "🇷🇴" },
  BGN: { code: "BGN", symbol: "лв",   name: "Bulgarian Lev",        flag: "🇧🇬" },
  ILS: { code: "ILS", symbol: "₪",    name: "Israeli Shekel",       flag: "🇮🇱" },
  ISK: { code: "ISK", symbol: "kr",   name: "Icelandic Krona",      flag: "🇮🇸" },

  // African currencies (static fallback rates — Frankfurter doesn't cover these)
  ZAR: { code: "ZAR", symbol: "R",    name: "South African Rand",   flag: "🇿🇦" },
  NGN: { code: "NGN", symbol: "₦",    name: "Nigerian Naira",       flag: "🇳🇬" },
  KES: { code: "KES", symbol: "KSh",  name: "Kenyan Shilling",      flag: "🇰🇪" },
  GHS: { code: "GHS", symbol: "₵",    name: "Ghanaian Cedi",        flag: "🇬🇭" },
  EGP: { code: "EGP", symbol: "E£",   name: "Egyptian Pound",       flag: "🇪🇬" },
  MAD: { code: "MAD", symbol: "د.م.", name: "Moroccan Dirham",      flag: "🇲🇦" },
  ETB: { code: "ETB", symbol: "Br",   name: "Ethiopian Birr",       flag: "🇪🇹" },
  TZS: { code: "TZS", symbol: "TSh",  name: "Tanzanian Shilling",   flag: "🇹🇿" },
  UGX: { code: "UGX", symbol: "USh",  name: "Ugandan Shilling",     flag: "🇺🇬" },
  ZMW: { code: "ZMW", symbol: "ZK",   name: "Zambian Kwacha",       flag: "🇿🇲" },
  MWK: { code: "MWK", symbol: "MK",   name: "Malawian Kwacha",      flag: "🇲🇼" },
  BWP: { code: "BWP", symbol: "P",    name: "Botswana Pula",        flag: "🇧🇼" },
  RWF: { code: "RWF", symbol: "RF",   name: "Rwandan Franc",        flag: "🇷🇼" },
  ZWL: { code: "ZWL", symbol: "Z$",   name: "Zimbabwe Dollar",      flag: "🇿🇼" },
  XOF: { code: "XOF", symbol: "CFA",  name: "West African CFA",     flag: "🌍" },
  XAF: { code: "XAF", symbol: "FCFA", name: "Central African CFA",  flag: "🌍" },
}

// Country → default currency
export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  "United States": "USD",
  "United Kingdom": "GBP",
  Germany: "EUR", France: "EUR", Spain: "EUR", Italy: "EUR",
  Netherlands: "EUR", Belgium: "EUR", Portugal: "EUR", Austria: "EUR",
  Japan: "JPY",
  Australia: "AUD",
  Canada: "CAD",
  Switzerland: "CHF",
  China: "CNY",
  "New Zealand": "NZD",
  Singapore: "SGD",
  "Hong Kong": "HKD",
  India: "INR",
  Brazil: "BRL",
  Mexico: "MXN",
  Turkey: "TRY",
  "South Korea": "KRW",
  Indonesia: "IDR",
  Thailand: "THB",
  Malaysia: "MYR",
  Philippines: "PHP",
  "South Africa": "ZAR",
  Nigeria: "NGN",
  Kenya: "KES",
  Ghana: "GHS",
  Egypt: "EGP",
  Morocco: "MAD",
  Ethiopia: "ETB",
  Tanzania: "TZS",
  Uganda: "UGX",
  Zambia: "ZMW",
  Malawi: "MWK",
  Botswana: "BWP",
  Rwanda: "RWF",
  Zimbabwe: "ZWL",
}

// Static fallback rates (USD base) for currencies Frankfurter doesn't cover
export const STATIC_FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  NGN: 1580,
  KES: 130,
  GHS: 15.6,
  EGP: 49,
  MAD: 10.1,
  ETB: 57,
  TZS: 2550,
  UGX: 3730,
  ZMW: 27.5,
  MWK: 1740,
  BWP: 13.6,
  RWF: 1350,
  ZWL: 360,
  XOF: 607,
  XAF: 607,
}

export function getCurrencyForCountry(country: string): Currency {
  const code = COUNTRY_TO_CURRENCY[country] || "USD"
  return CURRENCIES[code]
}

export function convertPrice(priceUSD: number, toCurrency: string, liveRates?: Record<string, number>): number {
  const rates = liveRates && Object.keys(liveRates).length > 0 ? liveRates : STATIC_FALLBACK_RATES
  const rate = rates[toCurrency] ?? STATIC_FALLBACK_RATES[toCurrency] ?? 1
  return priceUSD * rate
}

export function formatPrice(price: number, currency: Currency): string {
  // Large numbers: don't show decimals (e.g., KES, UGX, NGN)
  if (price >= 100) return `${currency.symbol}${Math.round(price).toLocaleString()}`
  return `${currency.symbol}${price.toFixed(2)}`
}
