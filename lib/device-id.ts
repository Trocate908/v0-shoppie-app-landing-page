"use client"

/**
 * A stable per-browser device id, used to route notifications to anonymous
 * shoppers (those who haven't logged in). Stored in localStorage.
 */
const KEY = "shoppie:device-id"

export function getDeviceId(): string {
  if (typeof window === "undefined") return ""
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `dev-${Math.random().toString(36).slice(2)}-${Date.now()}`
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return ""
  }
}
