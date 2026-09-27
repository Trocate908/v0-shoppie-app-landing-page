"use client"

import { useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from "react"
import { Input } from "@/components/ui/input"
import { Search, X, Clock, TrendingUp, Mic } from "lucide-react"
import { cn } from "@/lib/utils"
import { rankSuggestions, highlightParts } from "@/lib/search"

const HISTORY_KEY = "shoppie_search_history"
const MAX_HISTORY = 8

/* Voice search uses the Web Speech API. It is not part of lib.dom, so the
   minimal shape we actually call is declared here. The mic only renders when
   the browser provides the API (Chrome/Edge/Android; Safari and Firefox vary). */
type SpeechResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> }
type SpeechRecognitionInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: SpeechResultEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionCtor
  webkitSpeechRecognition?: SpeechRecognitionCtor
}

interface SearchBoxProps {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  placeholder?: string
  className?: string
  /** Rendered at the right edge of the field — e.g. a filter button. */
  rightSlot?: ReactNode
  /** Called when the shopper commits a search (Enter or a suggestion). */
  onSubmit?: () => void
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
  rightSlot,
  onSubmit,
}: SearchBoxProps) {
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  // Load history on mount
  useEffect(() => {
    setHistory(getHistory())
  }, [open])

  // Detect voice support after mount so the server and client markup agree.
  useEffect(() => {
    const w = window as SpeechWindow
    setVoiceSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition))
  }, [])

  // Stop the recogniser if the field unmounts mid-listen.
  useEffect(() => () => recognitionRef.current?.stop(), [])

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

  // Rank suggestions by relevance — prefix matches first, shorter names win.
  const filteredSuggestions = useMemo(
    () => rankSuggestions(suggestions, value, 6),
    [suggestions, value],
  )

  const showHistory = value.trim().length === 0 && history.length > 0
  const showSuggestions = filteredSuggestions.length > 0
  const isOpen = open && (showHistory || showSuggestions)

  const handleSelect = useCallback((item: string) => {
    onChange(item)
    saveToHistory(item)
    setHistory(getHistory())
    setOpen(false)
    inputRef.current?.blur()
    onSubmit?.()
  }, [onChange, onSubmit])

  const handleSubmit = useCallback(() => {
    if (value.trim()) {
      saveToHistory(value.trim())
      setHistory(getHistory())
    }
    setOpen(false)
    onSubmit?.()
  }, [value, onSubmit])

  const handleRemoveHistory = (item: string, e: React.MouseEvent) => {
    e.stopPropagation()
    removeFromHistory(item)
    setHistory(getHistory())
  }

  const toggleVoice = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const w = window as SpeechWindow
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Ctor) return
    try {
      const recognition = new Ctor()
      recognition.lang = navigator.language || "en-ZW"
      recognition.continuous = false
      recognition.interimResults = false
      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim()
        if (!transcript) return
        onChange(transcript)
        saveToHistory(transcript)
        setHistory(getHistory())
      }
      recognition.onend = () => setListening(false)
      recognition.onerror = () => setListening(false)
      recognitionRef.current = recognition
      setListening(true)
      recognition.start()
    } catch {
      setListening(false)
    }
  }, [listening, onChange])

  const clearSearch = () => {
    onChange("")
    inputRef.current?.focus()
  }

  // Reserve room for whatever the trailing cluster actually shows.
  const trailingPadding = rightSlot ? "pr-[6.75rem]" : voiceSupported ? "pr-16" : "pr-9"

  return (
    <div ref={containerRef} className={cn("relative flex-1", className)}>
      <Search
        className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-blue-500"
        strokeWidth={2.25}
      />
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
        className={cn(
          "h-12 rounded-full border-0 bg-muted pl-11 font-medium text-foreground shadow-none",
          "placeholder:font-normal placeholder:text-muted-foreground/70",
          "focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-blue-500/30",
          trailingPadding,
        )}
      />
      <div className="absolute right-1.5 top-1/2 z-20 flex -translate-y-1/2 items-center gap-0.5">
        {value && (
          <button
            type="button"
            onClick={clearSearch}
            className="rounded-full bg-background/80 p-1 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {voiceSupported && (
          <button
            type="button"
            onClick={toggleVoice}
            aria-pressed={listening}
            className={cn(
              "rounded-full p-1.5 text-blue-500 transition-colors",
              listening
                ? "bg-blue-500/15 text-blue-600 animate-pulse"
                : "hover:text-blue-600",
            )}
            aria-label={listening ? "Stop voice search" : "Search by voice"}
          >
            <Mic className="h-4 w-4" />
          </button>
        )}
        {rightSlot}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border/70 bg-background shadow-xl">

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
                    {/* Bold matching parts. Escaped per token, so a query
                        containing regex characters (e.g. "size 42 (new)")
                        highlights literally instead of throwing. */}
                    {highlightParts(item, value).map((part, i) =>
                      part.match
                        ? <strong key={i} className="text-foreground font-semibold">{part.text}</strong>
                        : <span key={i}>{part.text}</span>
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
