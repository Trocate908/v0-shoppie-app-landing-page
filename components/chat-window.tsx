"use client"

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  KeyboardEvent,
} from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ArrowLeft,
  Send,
  MoreVertical,
  Pencil,
  Trash2,
  Package,
  Check,
  CheckCheck,
  Loader2,
} from "lucide-react"
import Image from "next/image"
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string | null
  image_url: string | null
  read: boolean
  deleted: boolean
  created_at: string
  edited_at: string | null
}

interface ConversationProduct {
  id: string
  name: string
  image_url: string | null
  price: number
}

interface ConversationVendor {
  id: string
  shop_name: string
  profile_picture_url: string | null
  is_verified: boolean | null
  verification_expires_at: string | null
}

interface Conversation {
  id: string
  product_id: string
  buyer_id: string
  vendor_id: string
  last_message_at: string
  created_at: string
  unread_count: number
  is_buyer: boolean
  products: ConversationProduct | null
  vendors: ConversationVendor | null
}

interface ChatWindowProps {
  conversation: Conversation
  currentUserId: string
  onBack: () => void
}

export default function ChatWindow({
  conversation,
  currentUserId,
  onBack,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [editContent, setEditContent] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const otherName = conversation.is_buyer
    ? conversation.vendors?.shop_name ?? "Vendor"
    : "Buyer"

  const fetchMessages = useCallback(async () => {
    const res = await fetch(`/api/messages/${conversation.id}`)
    if (!res.ok) return
    const data = await res.json()
    setMessages(data.messages ?? [])
    setLoading(false)
  }, [conversation.id])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // Auto-scroll to bottom when messages load/update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Realtime subscription for this conversation
  useEffect(() => {
    const supabase = createBrowserClient()
    const channel = supabase
      .channel(`chat_${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newMsg = payload.new as Message
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev
              return [...prev, newMsg]
            })
            // Mark as read if from the other party
            if (newMsg.sender_id !== currentUserId) {
              supabase
                .from("messages")
                .update({ read: true })
                .eq("id", newMsg.id)
                .then(() => {})
            }
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Message
            setMessages((prev) =>
              prev.map((m) => (m.id === updated.id ? updated : m))
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversation.id, currentUserId])

  async function sendMessage() {
    if (!input.trim() || sending) return
    setSending(true)
    const content = input.trim()
    setInput("")

    try {
      const res = await fetch(`/api/messages/${conversation.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev
          return [...prev, data.message]
        })
      }
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  async function submitEdit() {
    if (!editingMessage || !editContent.trim()) return
    const res = await fetch(`/api/messages/${conversation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: editingMessage.id, content: editContent }),
    })
    if (res.ok) {
      const data = await res.json()
      setMessages((prev) =>
        prev.map((m) => (m.id === data.message.id ? data.message : m))
      )
    }
    setEditingMessage(null)
    setEditContent("")
  }

  async function deleteMessage(messageId: string) {
    const res = await fetch(`/api/messages/${conversation.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: messageId }),
    })
    if (res.ok) {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, deleted: true } : m))
      )
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Group messages by date
  const groupedMessages = groupByDate(messages)

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {/* Avatar */}
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-muted">
          {conversation.products?.image_url ? (
            <Image
              src={conversation.products.image_url}
              alt={conversation.products.name}
              fill
              className="object-cover"
              sizes="32px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Name + product */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground leading-tight">
            {otherName}
          </p>
          {conversation.products && (
            <p className="truncate text-[11px] text-muted-foreground leading-tight">
              re: {conversation.products.name}
            </p>
          )}
        </div>
      </header>

      {/* Product context banner */}
      {conversation.products && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2">
          <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="truncate text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{conversation.products.name}</span>
            {" — "}
            <span className="text-primary font-semibold">
              ${conversation.products.price.toFixed(2)}
            </span>
          </p>
        </div>
      )}

      {/* Messages list */}
      <main className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            No messages yet. Send the first message!
          </p>
        ) : (
          <div className="space-y-1">
            {groupedMessages.map(({ dateLabel, msgs }) => (
              <div key={dateLabel}>
                {/* Date divider */}
                <div className="flex items-center gap-3 py-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[11px] font-medium text-muted-foreground">{dateLabel}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {msgs.map((msg, idx) => {
                  const isOwn = msg.sender_id === currentUserId
                  const showAvatar = !isOwn && (idx === 0 || msgs[idx - 1]?.sender_id !== msg.sender_id)

                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isOwn={isOwn}
                      showAvatar={showAvatar}
                      onEdit={() => {
                        setEditingMessage(msg)
                        setEditContent(msg.content ?? "")
                      }}
                      onDelete={() => deleteMessage(msg.id)}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      {/* Edit mode banner */}
      {editingMessage && (
        <div className="flex items-center gap-2 border-t border-primary/30 bg-primary/5 px-4 py-2">
          <Pencil className="h-3.5 w-3.5 shrink-0 text-primary" />
          <p className="flex-1 truncate text-xs text-primary">Editing message</p>
          <button
            onClick={() => { setEditingMessage(null); setEditContent("") }}
            className="text-xs text-muted-foreground hover:text-foreground"
            aria-label="Cancel edit"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="shrink-0 border-t border-border bg-background p-3 pb-safe">
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={editingMessage ? editContent : input}
            onChange={(e) =>
              editingMessage
                ? setEditContent(e.target.value)
                : setInput(e.target.value)
            }
            onKeyDown={editingMessage ? undefined : handleKeyDown}
            placeholder="Type a message…"
            rows={1}
            className="max-h-32 min-h-[40px] flex-1 resize-none text-sm leading-relaxed"
          />
          <Button
            size="icon"
            onClick={editingMessage ? submitEdit : sendMessage}
            disabled={
              editingMessage
                ? !editContent.trim()
                : !input.trim() || sending
            }
            aria-label={editingMessage ? "Save edit" : "Send message"}
            className="shrink-0"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── MessageBubble ─────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  showAvatar: boolean
  onEdit: () => void
  onDelete: () => void
}

function MessageBubble({ message, isOwn, onEdit, onDelete }: MessageBubbleProps) {
  const timeStr = format(new Date(message.created_at), "HH:mm")

  if (message.deleted) {
    return (
      <div className={cn("flex my-0.5", isOwn ? "justify-end" : "justify-start")}>
        <p className="rounded-2xl px-3 py-1.5 text-xs italic text-muted-foreground bg-muted/50">
          This message was deleted
        </p>
      </div>
    )
  }

  return (
    <div className={cn("group flex items-end gap-1 my-0.5", isOwn ? "flex-row-reverse" : "flex-row")}>
      {/* Bubble */}
      <div
        className={cn(
          "relative max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
          isOwn
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted text-foreground"
        )}
      >
        {message.image_url && (
          <div className="relative mb-1 h-48 w-full overflow-hidden rounded-xl">
            <Image
              src={message.image_url}
              alt="Image message"
              fill
              className="object-cover"
              sizes="280px"
            />
          </div>
        )}
        {message.content && <p className="break-words">{message.content}</p>}

        {/* Timestamp + status */}
        <div className={cn("mt-0.5 flex items-center gap-1", isOwn ? "justify-end" : "justify-start")}>
          <span className={cn("text-[10px]", isOwn ? "text-primary-foreground/70" : "text-muted-foreground")}>
            {timeStr}
            {message.edited_at && " (edited)"}
          </span>
          {isOwn && (
            message.read
              ? <CheckCheck className="h-3 w-3 text-primary-foreground/70" />
              : <Check className="h-3 w-3 text-primary-foreground/50" />
          )}
        </div>
      </div>

      {/* Actions menu — only for own messages */}
      {isOwn && (
        <div className="mb-1 opacity-0 transition-opacity group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Message options">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {message.content && (
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function groupByDate(messages: Message[]): { dateLabel: string; msgs: Message[] }[] {
  const groups: Map<string, Message[]> = new Map()

  for (const msg of messages) {
    const d = new Date(msg.created_at)
    let label: string
    if (isToday(d)) label = "Today"
    else if (isYesterday(d)) label = "Yesterday"
    else label = format(d, "dd MMM yyyy")

    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(msg)
  }

  return Array.from(groups.entries()).map(([dateLabel, msgs]) => ({ dateLabel, msgs }))
}
