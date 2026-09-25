// Shared vocabulary for the user feedback system: abuse/content reports and
// product suggestions. Used by both the API routes (validation + whitelists)
// and the user/admin UI so the two can never drift apart.

export const REPORT_TARGET_TYPES = ["product", "vendor", "user", "general"] as const
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number]

export const REPORT_STATUSES = ["pending", "reviewing", "resolved", "dismissed"] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]

// Reasons offered when reporting a specific product, shop or user.
export const CONTENT_REPORT_REASONS = [
  "Spam or misleading",
  "Inappropriate content",
  "Counterfeit or fake product",
  "Scam or fraud",
  "Prohibited item",
  "Price gouging",
  "Harassment or abuse",
  "Other",
] as const

// Reasons offered for a site-wide report submitted from /feedback.
export const GENERAL_REPORT_REASONS = [
  "Something is broken",
  "Wrong or missing information",
  "Payment or checkout problem",
  "Account or login problem",
  "Accessibility issue",
  "Vendor not responding",
  "Other",
] as const

export const REPORT_REASONS = [...CONTENT_REPORT_REASONS, ...GENERAL_REPORT_REASONS]

// A product, shop or user report must name what it is about; a general report
// is about the platform itself.
export const TARGET_TYPES_REQUIRING_ID: readonly ReportTargetType[] = [
  "product",
  "vendor",
  "user",
]

export const SUGGESTION_CATEGORIES = [
  { value: "feature", label: "New feature" },
  { value: "improvement", label: "Improvement" },
  { value: "bug", label: "Something is broken" },
  { value: "buying", label: "Buying experience" },
  { value: "vendors", label: "Tools for vendors" },
  { value: "other", label: "Something else" },
] as const

export type SuggestionCategory = (typeof SUGGESTION_CATEGORIES)[number]["value"]

export const SUGGESTION_STATUSES = [
  { value: "submitted", label: "Submitted" },
  { value: "reviewing", label: "Under review" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "shipped", label: "Shipped" },
  { value: "declined", label: "Not planned" },
] as const

export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number]["value"]

export const SUGGESTION_CATEGORY_VALUES = SUGGESTION_CATEGORIES.map((c) => c.value) as string[]
export const SUGGESTION_STATUS_VALUES = SUGGESTION_STATUSES.map((s) => s.value) as string[]

export function suggestionStatusLabel(status: string): string {
  return SUGGESTION_STATUSES.find((s) => s.value === status)?.label ?? status
}

export function suggestionCategoryLabel(category: string): string {
  return SUGGESTION_CATEGORIES.find((c) => c.value === category)?.label ?? category
}

// Statuses a signed-in user can pick from on their own suggestion.
export const USER_VISIBLE_SUGGESTION_STATUSES = [
  "submitted",
  "reviewing",
  "planned",
  "in_progress",
  "shipped",
  "declined",
] as const

// Abuse/limit guards — generous enough for real use, small enough to stop spam.
export const MAX_REPORTS_PER_HOUR = 5
export const MAX_SUGGESTIONS_PER_HOUR = 5
export const MAX_TITLE_LENGTH = 120
export const MAX_DESCRIPTION_LENGTH = 2000
export const MAX_DETAILS_LENGTH = 1000
