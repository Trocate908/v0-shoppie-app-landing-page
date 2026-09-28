/**
 * Search helpers for the store page.
 *
 * The store previously did a single `toLowerCase().includes(query)` across
 * name/description/category. That misses anything but a contiguous substring,
 * ignores shop names entirely, and gives no sense of which result is the best
 * match. This module adds token-aware matching, relevance ranking, and a
 * safe highlighter.
 */

/** Lowercase, strip diacritics, collapse whitespace. */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Split a query into search tokens, dropping filler words.
 *
 * "Harare black sneakers size 42" → ["harare", "black", "sneakers", "42"]
 */
const STOP_WORDS = new Set(["the", "a", "an", "of", "for", "and", "with", "in", "on", "to"])

export function tokenize(query: string): string[] {
  return normalize(query)
    .split(/[^a-z0-9+]+/)
    .filter((t) => t.length > 0 && !STOP_WORDS.has(t))
}

/**
 * Drop a trailing single-character token produced by possessive or
 * punctuated names: "PAM's" → ["pam", "s"] → ["pam"]. Without this, every
 * product by that shop is missed because no text contains a standalone "s".
 */
function dropNoiseTokens(tokens: string[]): string[] {
  return tokens.filter((t) => t.length > 1 || /[0-9]/.test(t))
}

/** A fuzzy match is allowed only for tokens long enough to be meaningful. */
const FUZZY_MIN_LENGTH = 4

/**
 * Minimum length for the forgiving prefix rescue. Three characters are far too
 * short — most short strings are a "prefix" of something in a long field.
 */
const LOOSE_MIN_LENGTH = 4

/**
 * Levenshtein distance, capped for speed (both inputs are short).
 * Returns `max` when the strings are further apart than `max`.
 */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const value = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
      row.push(value)
      if (value < best) best = value
    }
    if (best > max) return max + 1
    prev = row
  }
  return prev[b.length]
}

/** Split a field into comparable words for fuzzy matching. */
function wordsOf(field: string): string[] {
  return field.split(/[^a-z0-9]+/).filter((w) => w.length >= FUZZY_MIN_LENGTH)
}

/** True when `token` is within one typo of some word in `field`. */
function isFuzzyMatch(token: string, field: string): boolean {
  if (token.length < FUZZY_MIN_LENGTH) return false
  return wordsOf(field).some(
    (word) => Math.abs(word.length - token.length) <= 1 && editDistance(token, word, 1) <= 1,
  )
}

/**
 * True when `token` is the beginning of some word in `field` — "watch" matching
 * "watches", "watch" matching "Watch Ultra Band".
 *
 * This is deliberately a **word-prefix** test and never a scattered subsequence.
 * The previous version accepted the token's characters appearing anywhere in
 * order, which made almost any long field a match by chance: "smart" was found
 * inside a sentence about herbal supplements and "watch" inside "…helps men stay
 * …", so a "smart watch" search returned dozens of unrelated products.
 */
function isWordPrefixMatch(token: string, field: string): boolean {
  if (token.length < LOOSE_MIN_LENGTH) return false
  return field.split(/[^a-z0-9]+/).some((word) => word.startsWith(token))
}

/** Score a single token against one field. Higher is a stronger match. */
function scoreToken(token: string, field: string): number {
  if (!field) return 0
  const at = field.indexOf(token)
  if (at === -1) return 0
  if (field === token) return 120
  if (at === 0) return 100 // prefix match — "shoe" matching "shoes"
  if (field[at - 1] === " " || field[at - 1] === "-") return 80 // word boundary
  return 50 // mid-word substring
}

export interface SearchableProduct {
  name: string
  description: string | null
  category: string | null
  vendor: {
    shop_name: string
    location: { city: string; market_name: string }
  }
}

export interface RankedProduct<T> {
  item: T
  score: number
}

/**
 * Filter and rank products for a query.
 *
 * Ranking weights: a name match beats a shop match beats a description match,
 * so the product a shopper meant usually lands first. When the shopper has
 * explicitly chosen a sort in the filter menu, that wins over relevance — we
 * don't override a deliberate choice.
 */
export function searchProducts<T extends SearchableProduct>(
  products: T[],
  query: string,
): RankedProduct<T>[] {
  const tokens = dropNoiseTokens(tokenize(query))
  if (tokens.length === 0) return products.map((item) => ({ item, score: 0 }))

  const ranked: RankedProduct<T>[] = []

  for (const item of products) {
    const name = normalize(item.name)
    const shop = normalize(item.vendor.shop_name)
    const category = normalize(item.category ?? "")
    const location = normalize(`${item.vendor.location.city} ${item.vendor.location.market_name}`)
    const description = normalize(item.description ?? "")

    let score = 0
    // True only when some token had no contiguous match anywhere — that's the
    // sole case where the forgiving prefix/typo rescue is worth trying.
    let needsLooseMatch = false

    for (const token of tokens) {
      // Best field wins per token; field weights encode intent.
      const best = Math.max(
        scoreToken(token, name),
        scoreToken(token, shop) * 0.7,
        scoreToken(token, category) * 0.6,
        scoreToken(token, location) * 0.5,
        scoreToken(token, description) * 0.3,
      )

      if (best === 0) {
        needsLooseMatch = true
        break
      }
      score += best
    }

    // At least one token had no contiguous match anywhere, so try the forgiving
    // rescue. It is deliberately narrow:
    //   * single-token queries only — "smart watch" has to match BOTH words,
    //     otherwise the results fill with unrelated products;
    //   * name, shop and category only — long free-text descriptions are where
    //     accidental matches live;
    //   * a word prefix rather than a scattered subsequence;
    //   * one-typo tolerance on the name only, so "samsng" still finds
    //     "Samsung" without prose producing "batch" ≈ "watch".
    if (needsLooseMatch) {
      if (tokens.length > 1) continue

      const token = tokens[0]
      const rescued =
        isWordPrefixMatch(token, name) ||
        isWordPrefixMatch(token, shop) ||
        isWordPrefixMatch(token, category) ||
        isFuzzyMatch(token, name)
      if (!rescued) continue
      score += 5
    }

    ranked.push({ item, score })
  }

  return ranked
}

/** Escape a string for safe interpolation into a RegExp. */
export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export interface HighlightPart {
  text: string
  match: boolean
}

/**
 * Split `text` into alternating matched/unmatched parts for rendering.
 *
 * The previous implementation did `text.split(new RegExp(`(${value})`, "gi"))`,
 * which **throws** on any regex metacharacter a shopper types — searching for
 * "size 42 (new)" crashed the render. Tokens are escaped and matched
 * separately, so punctuation is treated as literal text.
 */
export function highlightParts(text: string, query: string): HighlightPart[] {
  const tokens = dropNoiseTokens(tokenize(query))
  if (tokens.length === 0) return [{ text, match: false }]

  const parts: HighlightPart[] = []
  let cursor = 0
  const lower = text.toLowerCase()

  // Collect non-overlapping match ranges across all tokens.
  const ranges: { start: number; end: number }[] = []
  for (const token of tokens) {
    const pattern = new RegExp(escapeRegExp(token), "gi")
    let match: RegExpExecArray | null
    while ((match = pattern.exec(lower)) !== null) {
      ranges.push({ start: match.index, end: match.index + match[0].length })
      if (match.index === pattern.lastIndex) pattern.lastIndex++
    }
  }
  if (ranges.length === 0) return [{ text, match: false }]

  ranges.sort((a, b) => a.start - b.start)

  for (const range of ranges) {
    if (range.start < cursor) continue // overlapping match, skip
    if (range.start > cursor) {
      parts.push({ text: text.slice(cursor, range.start), match: false })
    }
    parts.push({ text: text.slice(range.start, range.end), match: true })
    cursor = range.end
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), match: false })
  }
  return parts
}

/**
 * Rank suggestion strings: prefix matches first, then shorter names, so the
 * list leads with the most likely intent.
 */
export function rankSuggestions(suggestions: string[], query: string, limit = 6): string[] {
  const tokens = dropNoiseTokens(tokenize(query))
  if (tokens.length === 0) return []

  const scored: { text: string; score: number }[] = []
  for (const suggestion of suggestions) {
    const normalized = normalize(suggestion)
    if (normalized === tokens.join(" ")) continue // exact repeat of the query

    let score = 0
    let matchedAll = true
    for (const token of tokens) {
      const value = scoreToken(token, normalized)
      if (value === 0) {
        matchedAll = false
        break
      }
      score += value
    }
    if (matchedAll) scored.push({ text: suggestion, score: score * 100 - normalized.length })
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.text)
}
