"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

type Theme = "light" | "dark"

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ThemeProviderProps = { children: ReactNode; [key: string]: any }

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>("light")

  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null
    const resolved: Theme = stored === "dark" ? "dark" : "light"
    setThemeState(resolved)
    document.documentElement.classList.toggle("dark", resolved === "dark")
  }, [])

  const setTheme = (next: Theme) => {
    setThemeState(next)
    localStorage.setItem("theme", next)
    document.documentElement.classList.toggle("dark", next === "dark")
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const { theme, setTheme } = useContext(ThemeContext)

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light")
  }

  return {
    theme,
    setTheme,
    toggleTheme,
  }
}
