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
import { format, isToday, isYesterday } from "date-fns"
import { cn } from "@/lib/utils"
import { usePresence, formatLastSeen } from "@/hooks/use-presence"
import { VerificationBadge } from "@/components/verification-badge"

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string | null
  image_url: string | null
  delivered: boolean
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
  last_message_at: string | null
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
    ? (conversation.vendors?.shop_name ?? "Vendor")
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

  // Scroll to bottom when messages load or new ones arrive
  useEffect(() => {
    if (!loading) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, loading])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Realtime subscription — listen for changes in this conversation's messages
  useEffect(() => {
    const supabase = createBrowserClient()

    const channel = supabase
      .channel(`chat:${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages((prev) => {
            // Deduplicate — optimistic insert may already be there
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })

          // Receiver is online and viewing the chat — mark delivered + read immediately
          if (newMsg.sender_id !== currentUserId) {
            supabase
              .from("messages")
              .update({ delivered: true, read: true })
              .eq("id", newMsg.id)
              .then(() => {})
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const updated = payload.new as Message
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversation.id, currentUserId, otherName])

  async function sendMessage() {
    if (!input.trim() || sending) return
    setSending(true)
    const content = input.trim()
    setInput("")

    // Optimistic insert
    const optimisticId = `optimistic-${Date.now()}`
    const optimistic: Message = {
      id: optimisticId,
      conversation_id: conversation.id,
      sender_id: currentUserId,
      content,
      image_url: null,
      delivered: false,
      read: false,
      deleted: false,
      created_at: new Date().toISOString(),
      edited_at: null,
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      const res = await fetch(`/api/messages/${conversation.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        const data = await res.json()
        // Replace the optimistic message with the real one
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticId ? data.message : m))
        )
      } else {
        // Roll back optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
        setInput(content)
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      setInput(content)
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
      body: JSON.stringify({
        message_id: editingMessage.id,
        content: editContent,
      }),
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
    // Optimistic update
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, deleted: true } : m))
    )
    const res = await fetch(`/api/messages/${conversation.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: messageId }),
    })
    if (!res.ok) {
      // Roll back
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, deleted: false } : m))
      )
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (editingMessage) {
        submitEdit()
      } else {
        sendMessage()
      }
    }
  }

  function startEdit(msg: Message) {
    setEditingMessage(msg)
    setEditContent(msg.content ?? "")
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function cancelEdit() {
    setEditingMessage(null)
    setEditContent("")
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const groupedMessages = groupByDate(messages)

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Header */}
      <ChatHeader
        conversation={conversation}
        currentUserId={currentUserId}
        otherName={otherName}
        onBack={onBack}
      />

      {/* Product context strip */}
      {conversation.products && (
        <div className="sticky top-[60px] z-[9] flex shrink-0 items-center gap-2.5 border-b border-border bg-muted/40 px-4 py-2 backdrop-blur">
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-background">
            {conversation.products.image_url ? (
              <Image
                src={conversation.products.image_url}
                alt={conversation.products.name}
                fill
                className="object-cover"
                sizes="36px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium leading-tight text-foreground">
              {conversation.products.name}
            </p>
            <p className="text-[11px] font-semibold leading-tight text-primary">
              ${conversation.products.price.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Messages list */}
      <main className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No messages yet. Say hello!
          </p>
        ) : (
          <div className="space-y-1">
            {groupedMessages.map(({ dateLabel, msgs }) => (
              <div key={dateLabel}>
                {/* Date divider */}
                <div className="flex items-center gap-3 py-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {dateLabel}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {msgs.map((msg) => {
                  const isOwn = msg.sender_id === currentUserId
                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isOwn={isOwn}
                      onEdit={() => startEdit(msg)}
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
            onClick={cancelEdit}
            className="text-xs text-muted-foreground hover:text-foreground"
            aria-label="Cancel edit"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="shrink-0 border-t border-border bg-background px-3 py-2">
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={editingMessage ? editContent : input}
            onChange={(e) =>
              editingMessage
                ? setEditContent(e.target.value)
                : setInput(e.target.value)
            }
            onKeyDown={handleKeyDown}
            placeholder={editingMessage ? "Edit message…" : "Message"}
            rows={1}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl bg-muted/60 px-4 py-3 text-sm leading-relaxed border-0 focus-visible:ring-1 focus-visible:ring-primary/50"
          />
          <Button
            size="icon"
            onClick={editingMessage ? submitEdit : sendMessage}
            disabled={
              editingMessage ? !editContent.trim() : !input.trim() || sending
            }
            aria-label={editingMessage ? "Save edit" : "Send message"}
            className="h-11 w-11 shrink-0 rounded-full"
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

// ─── ChatHeader ────────────────────────────────────────────────────────────────

function ChatHeader({
  conversation,
  currentUserId,
  otherName,
  onBack,
}: {
  conversation: Conversation
  currentUserId: string
  otherName: string
  onBack: () => void
}) {
  const { isOnline, getLastSeen } = usePresence(currentUserId)

  // The other participant is whichever side the current user is not on
  const otherUserId =
    conversation.buyer_id === currentUserId
      ? conversation.vendor_id
      : conversation.buyer_id

  const online = isOnline(otherUserId)
  const lastSeenAt = getLastSeen(otherUserId)
  const lastSeenText = formatLastSeen(lastSeenAt)

  const avatarUrl = conversation.is_buyer
    ? conversation.vendors?.profile_picture_url ?? null
    : null

  return (
    <header className="sticky top-0 z-10 flex h-[60px] shrink-0 items-center gap-3 border-b border-border bg-background/95 px-2 pr-4 backdrop-blur">
      <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back" className="shrink-0">
        <ArrowLeft className="h-5 w-5" />
      </Button>

      {/* Avatar with online dot */}
      <div className="relative shrink-0">
        <div className="relative h-10 w-10 overflow-hidden rounded-full bg-muted ring-1 ring-border">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={otherName}
              fill
              className="object-cover"
              sizes="40px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/10 text-sm font-semibold uppercase text-primary">
              {otherName.charAt(0)}
            </div>
          )}
        </div>
        {online && (
          <span
            aria-label="Online"
            className="absolute bottom-0 right-0 block h-3 w-3 rounded-full border-2 border-background bg-green-500"
          />
        )}
      </div>

      {/* Name + presence subtitle */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <p className="truncate text-[15px] font-semibold leading-tight text-foreground">
            {otherName}
          </p>
          {conversation.is_buyer && conversation.vendors?.is_verified && (
            <VerificationBadge
              isVerified={conversation.vendors.is_verified}
              verificationExpiresAt={conversation.vendors.verification_expires_at}
              size="sm"
              showTooltip={false}
            />
          )}
        </div>
        <p className="truncate text-xs leading-tight">
          {online ? (
            <span className="font-medium text-green-600 dark:text-green-500">online</span>
          ) : lastSeenText ? (
            <span className="text-muted-foreground">{lastSeenText}</span>
          ) : (
            <span className="text-muted-foreground">offline</span>
          )}
        </p>
      </div>
    </header>
  )
}

// ─── MessageTick ───────────────────────────────────────────────────────────────
// Single grey  = sent, receiver offline (delivered=false, read=false)
// Double grey  = delivered, receiver online but not read (delivered=true, read=false)
// Double blue  = read by receiver (delivered=true, read=true)

interface MessageTickProps {
  delivered: boolean
  read: boolean
}

function MessageTick({ delivered, read }: MessageTickProps) {
  if (read) {
    // Double GREEN ticks — message read by receiver
    return <CheckCheck className="h-3.5 w-3.5 shrink-0 text-green-500 dark:text-green-400" />
  }
  if (delivered) {
    // Double faded ticks — delivered, not yet read
    return <CheckCheck className="h-3.5 w-3.5 shrink-0 text-primary-foreground/55" />
  }
  // Single faded tick — sent but not yet delivered
  return <Check className="h-3.5 w-3.5 shrink-0 text-primary-foreground/55" />
}

// ─── MessageBubble ─────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  onEdit: () => void
  onDelete: () => void
}

function MessageBubble({ message, isOwn, onEdit, onDelete }: MessageBubbleProps) {
  const timeStr = format(new Date(message.created_at), "HH:mm")

  if (message.deleted) {
    return (
      <div className={cn("my-0.5 flex", isOwn ? "justify-end" : "justify-start")}>
        <p className="rounded-2xl bg-muted/50 px-3 py-1.5 text-xs italic text-muted-foreground">
          This message was deleted
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "group my-0.5 flex items-end gap-1",
        isOwn ? "flex-row-reverse" : "flex-row"
      )}
    >
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

        {/* Timestamp + read receipt */}
        <div
          className={cn(
            "mt-0.5 flex items-center gap-1",
            isOwn ? "justify-end" : "justify-start"
          )}
        >
          <span
            className={cn(
              "text-[10px]",
              isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
            )}
          >
            {timeStr}
            {message.edited_at && " (edited)"}
          </span>
          {isOwn && <MessageTick delivered={message.delivered} read={message.read} />}
        </div>
      </div>

      {/* Actions — only own messages */}
      {isOwn && (
        <div className="mb-1 opacity-0 transition-opacity group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                aria-label="Message options"
              >
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

function groupByDate(
  messages: Message[]
): { dateLabel: string; msgs: Message[] }[] {
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

  return Array.from(groups.entries()).map(([dateLabel, msgs]) => ({
    dateLabel,
    msgs,
  }))
}
