"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Lightbulb,
  RefreshCw,
  Search,
  ThumbsUp,
  Trash2,
  Loader2,
  MessageSquare,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  SUGGESTION_STATUSES,
  suggestionCategoryLabel,
} from "@/lib/feedback"

interface Suggestion {
  id: string
  user_id: string | null
  author_name: string | null
  title: string
  description: string
  category: string
  status: string
  admin_note: string | null
  votes: number
  created_at: string
  updated_at: string | null
}

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  reviewing: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  planned: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900",
  in_progress: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900",
  shipped: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  declined: "bg-muted text-muted-foreground",
}

const TABS = [
  { value: "all", label: "All" },
  ...SUGGESTION_STATUSES.map((s) => ({ value: s.value, label: s.label })),
]

export default function AdminSuggestionsPage() {
  const { toast } = useToast()

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("all")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<"votes" | "recent">("votes")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, countRes] = await Promise.all([
        fetch("/api/admin/suggestions?status=all").then((r) => r.json()),
        fetch("/api/admin/suggestions?counts=1").then((r) => r.json()),
      ])
      setSuggestions(listRes.suggestions ?? [])
      setCounts(countRes.counts ?? {})
    } catch {
      toast({ title: "Could not load suggestions", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  async function patch(id: string, payload: Record<string, unknown>, successTitle: string) {
    setBusyId(id)
    try {
      const res = await fetch("/api/admin/suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Update failed", description: data.error, variant: "destructive" })
        return
      }
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                ...(payload.status ? { status: payload.status as string } : {}),
                ...(payload.adminNote !== undefined
                  ? { admin_note: (payload.adminNote as string) || null }
                  : {}),
              }
            : s,
        ),
      )
      setNoteDraft((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      toast({ title: successTitle })
      if (payload.status) load()
    } catch {
      toast({ title: "Network error", variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    let list = suggestions

    if (tab !== "all") list = list.filter((s) => s.status === tab)
    if (term) {
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(term) ||
          s.description.toLowerCase().includes(term) ||
          (s.author_name ?? "").toLowerCase().includes(term),
      )
    }

    return [...list].sort((a, b) => {
      if (sort === "votes") {
        if (b.votes !== a.votes) return b.votes - a.votes
        return b.created_at.localeCompare(a.created_at)
      }
      return b.created_at.localeCompare(a.created_at)
    })
  }, [suggestions, tab, search, sort])

  return (
    <div className="p-6 mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Lightbulb className="h-6 w-6 text-violet-600" />
            Suggestions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Triage the ideas users send in. Status changes and team replies are
            shown publicly on the feedback board.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles, descriptions or authors…"
            className="pl-8"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as "votes" | "recent")}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="votes">Most voted</SelectItem>
            <SelectItem value="recent">Newest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => {
          const count = t.value === "all" ? suggestions.length : counts[t.value]
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors ${
                tab === t.value
                  ? "border-violet-600 text-violet-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {count !== undefined && count > 0 && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${
                    t.value === "submitted"
                      ? "bg-red-100 text-red-700"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Lightbulb className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p>No suggestions here yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((s) => {
            const noteValue = noteDraft[s.id] ?? s.admin_note ?? ""
            const noteDirty = noteDraft[s.id] !== undefined && noteDraft[s.id] !== (s.admin_note ?? "")

            return (
              <div key={s.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {suggestionCategoryLabel(s.category)}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs capitalize ${STATUS_STYLES[s.status] ?? ""}`}
                      >
                        {s.status.replace("_", " ")}
                      </Badge>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ThumbsUp className="h-3 w-3" />
                        {s.votes}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="font-semibold">{s.title}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {s.description}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Suggested by {s.author_name || "Guest"}
                      {s.user_id ? " · signed in" : " · not signed in"}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2">
                    <Select
                      value={s.status}
                      onValueChange={(status) => patch(s.id, { action: "status", status }, "Status updated")}
                      disabled={busyId === s.id}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUGGESTION_STATUSES.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => setConfirmDelete(s.id)}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-2 border-t border-border pt-3">
                  <label
                    htmlFor={`note-${s.id}`}
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Public team reply
                  </label>
                  <Textarea
                    id={`note-${s.id}`}
                    value={noteValue}
                    onChange={(e) =>
                      setNoteDraft((prev) => ({ ...prev, [s.id]: e.target.value }))
                    }
                    placeholder="e.g. We are looking at this for the next release."
                    rows={2}
                    maxLength={1000}
                  />
                  {noteDirty && (
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          patch(
                            s.id,
                            { action: "note", adminNote: noteDraft[s.id] },
                            "Reply saved",
                          )
                        }
                        disabled={busyId === s.id}
                        className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
                      >
                        {busyId === s.id && <Loader2 className="h-3 w-3 animate-spin" />}
                        Save reply
                      </button>
                      <button
                        onClick={() =>
                          setNoteDraft((prev) => {
                            const next = { ...prev }
                            delete next[s.id]
                            return next
                          })
                        }
                        className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this suggestion?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be removed from the board and its votes deleted. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmDelete) return
                patch(confirmDelete, { action: "delete" }, "Suggestion deleted").then(() =>
                  setConfirmDelete(null),
                )
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
