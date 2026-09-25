"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Flag,
  Lightbulb,
  Loader2,
  MessageSquareWarning,
  ThumbsUp,
  Sparkles,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createBrowserClient } from "@/lib/supabase/client"
import {
  GENERAL_REPORT_REASONS,
  MAX_DETAILS_LENGTH,
  MAX_TITLE_LENGTH,
  SUGGESTION_CATEGORIES,
  suggestionCategoryLabel,
  suggestionStatusLabel,
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

interface MyReport {
  id: string
  target_type: string
  target_id: string
  reason: string
  details: string | null
  status: string
  resolved_by: string | null
  created_at: string
}

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  reviewing: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  planned: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900",
  in_progress: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900",
  shipped: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  declined: "bg-muted text-muted-foreground",
  pending: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  resolved: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  dismissed: "bg-muted text-muted-foreground",
}

const BOARD_FILTERS = [
  { value: "all", label: "All ideas" },
  { value: "submitted", label: "New" },
  { value: "reviewing", label: "Under review" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "shipped", label: "Shipped" },
] as const

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={`text-xs ${STATUS_STYLES[status] ?? ""}`}>
      {suggestionStatusLabel(status)}
    </Badge>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export default function FeedbackClient() {
  const { toast } = useToast()

  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // ---- report form ----
  const [reason, setReason] = useState("")
  const [details, setDetails] = useState("")
  const [email, setEmail] = useState("")
  const [reportBusy, setReportBusy] = useState(false)
  const [myReports, setMyReports] = useState<MyReport[]>([])

  // ---- suggestion form ----
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState<string>("feature")
  const [idea, setIdea] = useState("")
  const [ideaBusy, setIdeaBusy] = useState(false)
  const [myIdeas, setMyIdeas] = useState<Suggestion[]>([])

  // ---- board ----
  const [board, setBoard] = useState<Suggestion[]>([])
  const [votedIds, setVotedIds] = useState<string[]>([])
  const [boardFilter, setBoardFilter] = useState<string>("all")
  const [boardSort, setBoardSort] = useState<"votes" | "recent">("votes")
  const [boardLoading, setBoardLoading] = useState(true)
  const [boardError, setBoardError] = useState<string | null>(null)
  const [votingId, setVotingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    createBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        if (cancelled) return
        setSignedIn(!!data.user)
        setUserId(data.user?.id ?? null)
      })
      .catch(() => {
        if (!cancelled) setSignedIn(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadBoard = useCallback(async () => {
    setBoardLoading(true)
    setBoardError(null)
    try {
      const params = new URLSearchParams()
      if (boardFilter !== "all") params.set("status", boardFilter)
      params.set("sort", boardSort)
      const res = await fetch(`/api/suggestions?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) {
        setBoardError(data.error ?? "Could not load ideas right now.")
        setBoard([])
      } else {
        setBoard(data.suggestions ?? [])
        setVotedIds(data.votedIds ?? [])
      }
    } catch {
      setBoardError("Could not reach the server. Check your connection and try again.")
    } finally {
      setBoardLoading(false)
    }
  }, [boardFilter, boardSort])

  const loadMine = useCallback(async () => {
    const [reportsRes, ideasRes] = await Promise.all([
      fetch("/api/reports").then((r) => r.json()).catch(() => ({})),
      fetch("/api/suggestions?scope=mine").then((r) => r.json()).catch(() => ({})),
    ])
    setMyReports(reportsRes.reports ?? [])
    setMyIdeas(ideasRes.suggestions ?? [])
  }, [])

  useEffect(() => {
    loadBoard()
  }, [loadBoard])

  useEffect(() => {
    if (signedIn) loadMine()
  }, [signedIn, loadMine])

  async function submitReport() {
    if (!reason) {
      toast({ title: "Please choose a reason", variant: "destructive" })
      return
    }
    if (details.trim().length < 5) {
      toast({ title: "Tell us a little more", description: "Add a few words so we can help.", variant: "destructive" })
      return
    }
    if (!signedIn && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast({
        title: "Add an email",
        description: "So we can reply to you — or sign in instead.",
        variant: "destructive",
      })
      return
    }

    setReportBusy(true)
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: "general",
          target_id: "general",
          reason,
          details: details.trim(),
          email: email.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Could not send your report", description: data.error, variant: "destructive" })
        return
      }
      toast({
        title: "Report sent",
        description: "Thanks — our team reviews every report.",
      })
      setDetails("")
      setReason("")
      if (signedIn) loadMine()
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" })
    } finally {
      setReportBusy(false)
    }
  }

  async function submitSuggestion() {
    if (title.trim().length < 4) {
      toast({ title: "Give your idea a title", variant: "destructive" })
      return
    }
    if (idea.trim().length < 10) {
      toast({ title: "Tell us a bit more", description: "At least 10 characters.", variant: "destructive" })
      return
    }

    setIdeaBusy(true)
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: idea.trim(), category }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Could not send your idea", description: data.error, variant: "destructive" })
        return
      }
      toast({ title: "Idea submitted", description: "Vote for it and follow its progress below." })
      setTitle("")
      setIdea("")
      setBoardFilter("all")
      await Promise.all([loadBoard(), signedIn ? loadMine() : Promise.resolve()])
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" })
    } finally {
      setIdeaBusy(false)
    }
  }

  async function toggleVote(s: Suggestion) {
    if (signedIn === null) return
    if (!signedIn) {
      toast({
        title: "Sign in to vote",
        description: "Voting keeps the board honest about what people want.",
      })
      return
    }

    setVotingId(s.id)
    const alreadyVoted = votedIds.includes(s.id)
    try {
      const res = await fetch("/api/suggestions/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId: s.id, action: alreadyVoted ? "remove" : "add" }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Vote not saved", description: data.error, variant: "destructive" })
        return
      }
      setBoard((prev) =>
        prev.map((item) => (item.id === s.id ? { ...item, votes: data.votes } : item)),
      )
      setVotedIds((prev) =>
        alreadyVoted ? prev.filter((id) => id !== s.id) : [...prev, s.id],
      )
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" })
    } finally {
      setVotingId(null)
    }
  }

  const signedInCount = useMemo(
    () => myIdeas.length + myReports.length,
    [myIdeas.length, myReports.length],
  )

  return (
    <Tabs defaultValue="report" className="space-y-6">
      <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-flex">
        <TabsTrigger value="report" className="gap-2">
          <MessageSquareWarning className="h-4 w-4" />
          Report a problem
        </TabsTrigger>
        <TabsTrigger value="suggest" className="gap-2">
          <Lightbulb className="h-4 w-4" />
          Suggest an idea
        </TabsTrigger>
      </TabsList>

      {/* ------------------------------------------------------------------ */}
      <TabsContent value="report" className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-foreground">
                <Flag className="h-4 w-4 text-destructive" />
                Report something wrong
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Broken pages, wrong prices, a shop that will not answer. For a
                specific product or shop, use the{" "}
                <span className="font-medium text-foreground">Report</span> link on
                its page.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report-reason">What is the problem?</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="report-reason">
                  <SelectValue placeholder="Choose a reason…" />
                </SelectTrigger>
                <SelectContent>
                  {GENERAL_REPORT_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report-details">Details</Label>
              <Textarea
                id="report-details"
                value={details}
                onChange={(e) => setDetails(e.target.value.slice(0, MAX_DETAILS_LENGTH))}
                placeholder="Tell us what happened, and which page it happened on."
                rows={5}
                maxLength={MAX_DETAILS_LENGTH}
              />
              <p className="text-right text-xs text-muted-foreground">
                {details.length}/{MAX_DETAILS_LENGTH}
              </p>
            </div>

            {signedIn === false && (
              <div className="space-y-1.5">
                <Label htmlFor="report-email">Your email</Label>
                <Input
                  id="report-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
                <p className="text-xs text-muted-foreground">
                  We only use this to follow up. Or{" "}
                  <Link href="/auth" className="text-primary hover:underline">
                    sign in
                  </Link>{" "}
                  to track your reports.
                </p>
              </div>
            )}

            <Button
              onClick={submitReport}
              disabled={reportBusy || !reason}
              className="w-full bg-destructive text-white hover:bg-destructive/90"
            >
              {reportBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                "Send report"
              )}
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="font-semibold text-foreground">Your reports</h2>

            {signedIn === null ? (
              <p className="text-sm text-muted-foreground">Checking…</p>
            ) : !signedIn ? (
              <p className="text-sm text-muted-foreground">
                <Link href="/auth" className="text-primary hover:underline">
                  Sign in
                </Link>{" "}
                to see the status of reports you have sent.
              </p>
            ) : myReports.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You have not sent any reports yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {myReports.map((r) => (
                  <li key={r.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">{r.reason}</p>
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-xs capitalize ${STATUS_STYLES[r.status] ?? ""}`}
                      >
                        {r.status}
                      </Badge>
                    </div>
                    {r.details && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {r.details}
                      </p>
                    )}
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {formatDate(r.created_at)}
                      {r.resolved_by && ` · handled by ${r.resolved_by}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </TabsContent>

      {/* ------------------------------------------------------------------ */}
      <TabsContent value="suggest" className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-foreground">
                <Lightbulb className="h-4 w-4 text-primary" />
                Suggest an idea
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tell us what ShoppieApp should do next. Ideas go straight to the
                team&rsquo;s roadmap, and you can vote for the ones you want too.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="idea-title">Idea</Label>
              <Input
                id="idea-title"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE_LENGTH))}
                placeholder="e.g. Let me save a shop to a list"
                maxLength={MAX_TITLE_LENGTH}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="idea-category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="idea-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUGGESTION_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="idea-details">Why would this help?</Label>
              <Textarea
                id="idea-details"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="The more context you give, the more likely it is to get built."
                rows={5}
              />
            </div>

            <Button
              onClick={submitSuggestion}
              disabled={ideaBusy}
              className="w-full bg-violet-600 text-white hover:bg-violet-700"
            >
              {ideaBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Submit idea
                </>
              )}
            </Button>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold text-foreground">Community ideas</h2>
                <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 text-xs">
                  {(["votes", "recent"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setBoardSort(s)}
                      className={`rounded-md px-2.5 py-1 transition-colors ${
                        boardSort === s
                          ? "bg-violet-600 text-white"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s === "votes" ? "Top" : "Newest"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {BOARD_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setBoardFilter(f.value)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      boardFilter === f.value
                        ? "border-violet-600 bg-violet-600 text-white"
                        : "border-border text-muted-foreground hover:border-violet-400 hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {boardLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-24 animate-pulse rounded-lg border border-border" />
                  ))}
                </div>
              ) : boardError ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  {boardError}
                </p>
              ) : board.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No ideas here yet. Be the first to suggest one.
                </p>
              ) : (
                <ul className="space-y-3">
                  {board.map((s) => {
                    const voted = votedIds.includes(s.id)
                    const isMine = userId !== null && s.user_id === userId
                    return (
                      <li key={s.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggleVote(s)}
                            disabled={votingId === s.id || isMine}
                            aria-pressed={voted}
                            title={
                              isMine
                                ? "You cannot vote on your own idea"
                                : voted
                                  ? "Remove your vote"
                                  : "Vote for this idea"
                            }
                            className={`flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 transition-colors disabled:opacity-50 ${
                              voted
                                ? "border-violet-600 bg-violet-600 text-white"
                                : "border-border text-muted-foreground hover:border-violet-400 hover:text-violet-600"
                            }`}
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                            <span className="text-sm font-bold leading-none">{s.votes}</span>
                          </button>

                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground">{s.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {s.description}
                            </p>
                            {s.admin_note && (
                              <p className="mt-2 rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                                <span className="font-semibold text-foreground">
                                  Team reply:
                                </span>{" "}
                                {s.admin_note}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <StatusBadge status={s.status} />
                              <span>·</span>
                              <span>{suggestionCategoryLabel(s.category)}</span>
                              <span>·</span>
                              <span>
                                {s.author_name || "Guest"} · {formatDate(s.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {signedIn && myIdeas.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="font-semibold text-foreground">Your ideas</h2>
                <ul className="mt-3 space-y-2">
                  {myIdeas.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{s.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {s.votes} {s.votes === 1 ? "vote" : "votes"} ·{" "}
                          {formatDate(s.created_at)}
                        </p>
                        {s.admin_note && (
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">Team reply:</span>{" "}
                            {s.admin_note}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={s.status} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {signedIn && signedInCount === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                Your reports and ideas will appear here so you can follow them.
              </p>
            )}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}
