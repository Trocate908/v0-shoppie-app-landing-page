// Multi-account switcher utility
// Stores saved accounts with their refresh tokens in localStorage for seamless switching

export type SavedAccount = {
  userId: string
  email: string
  shopName: string
  profilePictureUrl: string | null
  refreshToken: string
  accessToken: string
}

const STORAGE_KEY = "shoppie_saved_accounts"
const ACTIVE_KEY = "shoppie_active_account"

export function getSavedAccounts(): SavedAccount[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveAccount(account: SavedAccount): void {
  if (typeof window === "undefined") return
  const accounts = getSavedAccounts()
  const existing = accounts.findIndex((a) => a.userId === account.userId)
  if (existing >= 0) {
    accounts[existing] = account
  } else {
    accounts.push(account)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts))
}

export function removeAccount(userId: string): void {
  if (typeof window === "undefined") return
  const accounts = getSavedAccounts().filter((a) => a.userId !== userId)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts))
}

export function updateAccountTokens(userId: string, refreshToken: string, accessToken: string): void {
  if (typeof window === "undefined") return
  const accounts = getSavedAccounts()
  const idx = accounts.findIndex((a) => a.userId === userId)
  if (idx >= 0) {
    accounts[idx].refreshToken = refreshToken
    accounts[idx].accessToken = accessToken
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts))
  }
}

export function getActiveAccountId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ACTIVE_KEY)
}

export function setActiveAccountId(userId: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(ACTIVE_KEY, userId)
}
