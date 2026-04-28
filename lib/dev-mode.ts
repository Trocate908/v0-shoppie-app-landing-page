// Developer-mode flag persisted in localStorage. Used to hide things like the
// notification diagnostics page behind a toggle that lives under
// Settings → Developer Options (below "Contact us"). End users will never
// see these screens unless they explicitly opt-in.

const KEY = "shoppie:dev-mode"

export function isDevModeEnabled(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}

export function setDevModeEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return
  try {
    if (enabled) window.localStorage.setItem(KEY, "1")
    else window.localStorage.removeItem(KEY)
  } catch {
    /* ignore quota / privacy-mode errors */
  }
  // Notify other components in this tab that the flag changed (storage events
  // only fire across tabs, not within the same tab).
  try {
    window.dispatchEvent(new CustomEvent("shoppie:dev-mode-change", { detail: enabled }))
  } catch {
    /* ignored */
  }
}

export function subscribeToDevMode(cb: (enabled: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {}
  const handler = () => cb(isDevModeEnabled())
  window.addEventListener("storage", handler)
  window.addEventListener("shoppie:dev-mode-change", handler as EventListener)
  return () => {
    window.removeEventListener("storage", handler)
    window.removeEventListener("shoppie:dev-mode-change", handler as EventListener)
  }
}
