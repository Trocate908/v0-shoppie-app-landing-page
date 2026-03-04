"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Search, X, Clock, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

const HISTORY_KEY = "shoppie_search_history"
const MAX_HISTORY = 8

interface SearchBoxProps {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  placeholder?: string
  className?: string
}

function getHistory(): string[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]")
  } catch {
    return []
  }
}

function saveToHistory(query: string) {
  if (!query.trim()) return
  const prev = getHistory().filter((h) => h.toLowerCase() !== query.toLowerCase())
  const next = [query, ...prev].slice(0, MAX_HISTORY)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
}

function removeFromHistory(query: string) {
  const next = getHistory().filter((h) => h !== query)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
}

export default function SearchBox({
  value,
  onChange,
  suggestions,
  placeholder = "Search products...",
  className,
}: SearchBoxProps) {
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load history on mount
  useEffect(() => {
    setHistory(getHistory())
  }, [open])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Filter suggestions based on current input
  const filteredSuggestions = value.trim().length > 0
    ? suggestions
        .filter((s) => s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase())
        .slice(0, 6)
    : []

  const showHistory = value.trim().length === 0 && history.length > 0
  const showSuggestions = filteredSuggestions.length > 0
  const isOpen = open && (showHistory || showSuggestions)

  const handleSelect = useCallback((item: string) => {
    onChange(item)
    saveToHistory(item)
    setHistory(getHistory())
    setOpen(false)
    inputRef.current?.blur()
  }, [onChange])

  const handleSubmit = () => {
    if (value.trim()) {
      saveToHistory(value.trim())
      setHistory(getHistory())
    }
    setOpen(false)
  }

  const handleRemoveHistory = (item: string, e: React.MouseEvent) => {
    e.stopPropagation()
    removeFromHistory(item)
    setHistory(getHistory())
  }

  const clearSearch = () => {
    onChange("")
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className={cn("relative flex-1", className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
      <Input
        ref={inputRef}
        type="search"
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit()
          if (e.key === "Escape") setOpen(false)
        }}
        className="pl-10 pr-8"
      />
      {value && (
        <button
          onClick={clearSearch}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-background shadow-lg">

          {/* Search history */}
          {showHistory && (
            <>
              <div className="flex items-center justify-between px-3 pt-2 pb-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent Searches</span>
                <button
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => {
                    localStorage.removeItem(HISTORY_KEY)
                    setHistory([])
                  }}
                >
                  Clear all
                </button>
              </div>
              {history.map((item) => (
                <button
                  key={item}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent transition-colors text-left"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(item)}
                >
                  <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{item}</span>
                  <span
                    role="button"
                    aria-label={`Remove ${item} from history`}
                    className="ml-auto text-muted-foreground hover:text-foreground"
                    onClick={(e) => handleRemoveHistory(item, e)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </span>
                </button>
              ))}
            </>
          )}

          {/* Live suggestions */}
          {showSuggestions && (
            <>
              {showHistory && <div className="mx-3 border-t border-border" />}
              <div className="px-3 pt-2 pb-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suggestions</span>
              </div>
              {filteredSuggestions.map((item) => (
                <button
                  key={item}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent transition-colors text-left"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(item)}
                >
                  <TrendingUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    {/* Bold matching part */}
                    {item.split(new RegExp(`(${value})`, "gi")).map((part, i) =>
                      part.toLowerCase() === value.toLowerCase()
                        ? <strong key={i} className="text-foreground font-semibold">{part}</strong>
                        : <span key={i}>{part}</span>
                    )}
                  </span>
                </button>
              ))}
            </>
          )}

          <div className="h-2" />
        </div>
      )}
    </div>
  )
}
