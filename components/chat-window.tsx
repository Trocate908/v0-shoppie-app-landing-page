"use client"

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  KeyboardEvent,
  ChangeEvent,
} from "react"
import Link from "next/link"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { useToast } from "@/hooks/use-toast"
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
  Smile,
  Paperclip,
  Copy,
  ArrowDown,
  X,
  ImageIcon,
  ChevronRight,
  Maximize2,
  Download,
} from "lucide-react"
import Image from "next/image"
import { format, isToday, isYesterday } from "date-fns"
import { cn } from "@/lib/utils"
import { avatarGradient } from "@/lib/avatar"
import { usePresence, formatLastSeen } from "@/hooks/use-presence"
import { VerificationBadge } from "@/components/verification-badge"
import { EmojiPicker } from "@/components/emoji-picker"

// Module-level singleton — one Supabase client reused across all effects
let _chatSupabase: ReturnType<typeof createBrowserClient> | null = null
function getChatClient() {
  if (!_chatSupabase) _chatSupabase = createBrowserClient()
  return _chatSupabase
}

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
  const { toast } = useToast()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [editContent, setEditContent] = useState("")
  const [showEmoji, setShowEmoji] = useState(false)
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [deletingChat, setDeletingChat] = useState(false)
  const [confirmDeleteChat, setConfirmDeleteChat] = useState(false)
  // Typing indicator: true when the OTHER participant is currently typing
  const [isOtherTyping, setIsOtherTyping] = useState(false)
  // Full-screen viewer for a tapped photo message.
  const [viewerSrc, setViewerSrc] = useState<string | null>(null)
  // Captured once so bubbles that arrive later can be told apart from history.
  const [mountedAt] = useState(() => Date.now())

  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Typing broadcast machinery
  const typingChannelRef = useRef<ReturnType<
    ReturnType<typeof createBrowserClient>["channel"]
  > | null>(null)
  const lastTypingSentAtRef = useRef<number>(0)
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // On initial load: jump instantly to bottom (no animation = no layout thrash)
  useEffect(() => {
    if (!loading) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  // For new messages arriving after load: only smooth-scroll if near bottom
  const prevMsgCountRef = useRef(0)
  useEffect(() => {
    const prevCount = prevMsgCountRef.current
    prevMsgCountRef.current = messages.length
    if (loading || messages.length <= prevCount) return
    const el = scrollContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom < 300) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, loading])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // When the tab becomes visible while this chat is open, mark all incoming
  // unread messages as read (they were only marked delivered while hidden).
  useEffect(() => {
    function handleVisibility() {
      if (typeof document === "undefined" || document.hidden) return
      const supabase = getChatClient()
      supabase
        .from("messages")
        .update({ delivered: true, read: true })
        .eq("conversation_id", conversation.id)
        .neq("sender_id", currentUserId)
        .eq("read", false)
        .then(() => {})
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [conversation.id, currentUserId])

  // Watch scroll position to toggle "scroll to bottom" button
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    function onScroll() {
      if (!el) return
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      setShowScrollBtn(distanceFromBottom > 200)
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [loading])

  // Realtime subscription — listen for changes in this conversation's messages
  useEffect(() => {
    const supabase = getChatClient()

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
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })

          if (newMsg.sender_id !== currentUserId) {
            // Always mark as delivered — the receiver's client received it
            const markRead =
              typeof document !== "undefined" && !document.hidden
            supabase
              .from("messages")
              .update(markRead ? { delivered: true, read: true } : { delivered: true })
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
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const removed = payload.old as { id?: string }
          if (!removed?.id) return
          setMessages((prev) => prev.filter((m) => m.id !== removed.id))
        }
      )
      .on("broadcast", { event: "typing" }, (payload) => {
        const from = (payload?.payload as { userId?: string } | undefined)?.userId
        if (!from || from === currentUserId) return
        setIsOtherTyping(true)
        if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current)
        // Self-healing: if the sender never signals that they stopped (closed
        // tab, dropped connection), drop the indicator instead of leaving it on.
        typingStopTimerRef.current = setTimeout(() => setIsOtherTyping(false), 3000)
      })
      .subscribe()

    // Held so the composer can broadcast without re-subscribing per keystroke.
    typingChannelRef.current = channel

    return () => {
      typingChannelRef.current = null
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current)
      setIsOtherTyping(false)
      supabase.removeChannel(channel)
    }
  }, [conversation.id, currentUserId, otherName])

  async function uploadImage(file: File): Promise<string | null> {
    try {
      const supabase = getChatClient()
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
      const path = `${currentUserId}/${conversation.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from("chat-attachments")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        })
      if (error) {
        console.log("[v0] image upload error:", error.message)
        return null
      }
      const { data } = supabase.storage.from("chat-attachments").getPublicUrl(path)
      return data.publicUrl
    } catch (e) {
      console.log("[v0] image upload exception:", e)
      return null
    }
  }

  async function sendMessage() {
    if ((!input.trim() && !pendingImage) || sending) return
    setSending(true)
    const content = input.trim()
    const imageFile = pendingImage?.file ?? null
    setInput("")
    setPendingImage(null)
    setShowEmoji(false)

    // Upload image first if present
    let imageUrl: string | null = null
    if (imageFile) {
      setUploading(true)
      imageUrl = await uploadImage(imageFile)
      setUploading(false)
      if (!imageUrl) {
        toast({
          title: "Image upload failed",
          description: "Please try again.",
          variant: "destructive",
        })
        setSending(false)
        setPendingImage({
          file: imageFile,
          preview: URL.createObjectURL(imageFile),
        })
        setInput(content)
        return
      }
    }

    // Optimistic insert
    const optimisticId = `optimistic-${Date.now()}`
    const optimistic: Message = {
      id: optimisticId,
      conversation_id: conversation.id,
      sender_id: currentUserId,
      content: content || null,
      image_url: imageUrl,
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
        body: JSON.stringify({ content: content || null, image_url: imageUrl }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticId ? data.message : m))
        )
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
        setInput(content)
        toast({
          title: "Couldn't send",
          description: "Please try again.",
          variant: "destructive",
        })
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
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, deleted: true } : m))
    )
    const res = await fetch(`/api/messages/${conversation.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: messageId }),
    })
    if (!res.ok) {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, deleted: false } : m))
      )
    }
  }

  async function deleteConversation() {
    setDeletingChat(true)
    try {
      const res = await fetch(
        `/api/messages/conversations/${conversation.id}`,
        { method: "DELETE" }
      )
      if (res.ok) {
        toast({
          title: "Conversation deleted",
          description: "All messages have been removed.",
        })
        onBack()
      } else {
        toast({
          title: "Couldn't delete conversation",
          description: "Please try again.",
          variant: "destructive",
        })
      }
    } finally {
      setDeletingChat(false)
      setConfirmDeleteChat(false)
    }
  }

  function copyMessage(content: string) {
    try {
      navigator.clipboard.writeText(content)
      toast({ title: "Copied to clipboard" })
    } catch {
      // silent fail
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

  function handleEmojiSelect(emoji: string) {
    if (editingMessage) {
      setEditContent((prev) => prev + emoji)
    } else {
      setInput((prev) => prev + emoji)
    }
    inputRef.current?.focus()
  }

  function handleFilePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please select an image.",
        variant: "destructive",
      })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be under 5 MB.",
        variant: "destructive",
      })
      return
    }
    setPendingImage({ file, preview: URL.createObjectURL(file) })
    // Reset input so selecting the same file twice still triggers change
    e.target.value = ""
    setShowEmoji(false)
  }

  function removePendingImage() {
    if (pendingImage) URL.revokeObjectURL(pendingImage.preview)
    setPendingImage(null)
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const groupedMessages = groupByDate(messages)
  const canSend = !!(input.trim() || pendingImage) && !sending

  // Throttled, so holding a key down doesn't flood the channel.
  function notifyTyping() {
    const channel = typingChannelRef.current
    if (!channel) return
    const now = Date.now()
    if (now - lastTypingSentAtRef.current < 2000) return
    lastTypingSentAtRef.current = now
    channel
      .send({ type: "broadcast", event: "typing", payload: { userId: currentUserId } })
      .then(() => {})
      .catch(() => {})
  }

  return (
    <div className="chat-bg-pattern relative flex h-dvh flex-col bg-background">
      {/* The chat header and the product strip share one sticky block, so the
          strip's offset never has to hardcode the header height. */}
      <div className="sticky top-0 z-20 shrink-0 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <ChatHeader
          conversation={conversation}
          currentUserId={currentUserId}
          otherName={otherName}
          isOtherTyping={isOtherTyping}
          onBack={onBack}
          onDeleteConversation={() => setConfirmDeleteChat(true)}
        />

        {/* Product context strip. Links through to the listing, so you can
            re-check the item you're negotiating over without leaving the chat
            and finding it again. */}
        {conversation.products && (
          <Link
            href={`/product/${conversation.product_id}`}
            aria-label={`View ${conversation.products.name}`}
            className="flex items-center gap-2.5 border-t border-border/50 bg-muted/40 px-4 py-2 transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          >
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-background ring-1 ring-border/60">
              {conversation.products.image_url ? (
                <Image
                  src={conversation.products.image_url}
                  alt=""
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
              <p className="truncate text-xs font-semibold leading-tight text-foreground">
                {conversation.products.name}
              </p>
              <p className="text-[11px] font-bold leading-tight text-primary">
                ${conversation.products.price.toFixed(2)}
              </p>
            </div>
            <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
              View
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        )}
      </div>

      {/* Messages list */}
      <main
        ref={scrollContainerRef}
        className="relative flex-1 overflow-y-auto px-4 py-3"
      >
        {loading ? (
          <ChatMessagesSkeleton />
        ) : messages.length === 0 ? (
          <ChatEmptyState
            otherName={otherName}
            avatarUrl={
              conversation.is_buyer
                ? conversation.vendors?.profile_picture_url ?? null
                : null
            }
            onPickIcebreaker={(text) => {
              setInput(text)
              inputRef.current?.focus()
            }}
          />
        ) : (
          <>
            {groupedMessages.map(({ dateLabel, msgs }) => (
              <div key={dateLabel}>
                {/* Date divider */}
                <div className="flex items-center justify-center py-4">
                  <span className="rounded-full bg-muted/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shadow-sm ring-1 ring-border/50">
                    {dateLabel}
                  </span>
                </div>

                {msgs.map((msg, i) => {
                  const isOwn = msg.sender_id === currentUserId
                  const prev = msgs[i - 1]
                  const next = msgs[i + 1]
                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isOwn={isOwn}
                      isFirstInGroup={!prev || prev.sender_id !== msg.sender_id}
                      isLastInGroup={!next || next.sender_id !== msg.sender_id}
                      // Tolerates a little clock skew between server and client.
                      animateIn={new Date(msg.created_at).getTime() > mountedAt - 5000}
                      onEdit={() => startEdit(msg)}
                      onDelete={() => deleteMessage(msg.id)}
                      onCopy={() => msg.content && copyMessage(msg.content)}
                      onOpenImage={(src) => setViewerSrc(src)}
                    />
                  )
                })}
              </div>
            ))}

            {/* Typing indicator */}
            {isOtherTyping && (
              <div className="mt-1.5 flex justify-start">
                <div
                  aria-label={`${otherName} is typing`}
                  className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-3 py-2.5 ring-1 ring-border/60"
                >
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />

        {/* Scroll to bottom floating button */}
        {showScrollBtn && (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Scroll to latest"
            className="sticky bottom-2 float-right mr-1 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/95 shadow-md backdrop-blur transition-transform hover:scale-105 active:scale-95"
          >
            <ArrowDown className="h-4 w-4 text-foreground" />
          </button>
        )}
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

      {/* Pending image preview */}
      {pendingImage && (
        <div className="flex items-center gap-3 border-t border-border bg-muted/40 px-3 py-2">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border">
            <Image
              src={pendingImage.preview}
              alt="Attachment preview"
              fill
              className="object-cover"
              sizes="56px"
              unoptimized
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-medium text-foreground">
              {pendingImage.file.name}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {(pendingImage.file.size / 1024).toFixed(0)} KB
              {uploading && " • Uploading…"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={removePendingImage}
            aria-label="Remove attachment"
            className="h-8 w-8 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Emoji picker */}
      {showEmoji && !editingMessage && (
        <div className="shrink-0 border-t border-border px-3 pt-2">
          <EmojiPicker
            onSelect={handleEmojiSelect}
            className="mx-auto w-full max-w-md"
          />
        </div>
      )}

      {/* Input bar */}
      <div className="shrink-0 border-t border-border bg-background px-3 py-2">
        <div className="flex items-end gap-2">
          <div className="flex flex-1 items-end gap-0.5 rounded-3xl bg-muted/50 pl-1 pr-2 ring-1 ring-border/60 transition-shadow focus-within:bg-background focus-within:ring-primary/30 focus-within:shadow-sm">
            {/* Emoji toggle */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowEmoji((v) => !v)}
              aria-label={showEmoji ? "Close emoji picker" : "Open emoji picker"}
              aria-pressed={showEmoji}
              className={cn(
                "h-10 w-10 shrink-0 self-end rounded-full hover:bg-background/80",
                showEmoji && "text-primary"
              )}
              disabled={!!editingMessage}
            >
              <Smile className="h-[22px] w-[22px]" />
            </Button>

            <Textarea
              ref={inputRef}
              value={editingMessage ? editContent : input}
              onChange={(e) => {
                if (editingMessage) {
                  setEditContent(e.target.value)
                } else {
                  setInput(e.target.value)
                  notifyTyping()
                }
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowEmoji(false)}
              placeholder={editingMessage ? "Edit message…" : "Message"}
              rows={1}
              className="max-h-32 min-h-[40px] flex-1 resize-none border-0 bg-transparent px-1 py-[10px] text-sm leading-relaxed shadow-none focus-visible:ring-0"
            />

            {/* Attach image (hidden when editing) */}
            {!editingMessage && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach image"
                className="h-10 w-10 shrink-0 self-end rounded-full hover:bg-background/80"
              >
                <Paperclip className="h-[20px] w-[20px]" />
              </Button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFilePick}
              className="hidden"
            />
          </div>

          {/* Send / save button */}
          <Button
            size="icon"
            onClick={editingMessage ? submitEdit : sendMessage}
            disabled={
              editingMessage
                ? !editContent.trim()
                : !canSend
            }
            aria-label={editingMessage ? "Save edit" : "Send message"}
            className="h-11 w-11 shrink-0 rounded-full shadow-sm transition-transform hover:scale-105 active:scale-95 disabled:hover:scale-100"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Confirm delete conversation */}
      <AlertDialog
        open={confirmDeleteChat}
        onOpenChange={(open) => !open && setConfirmDeleteChat(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove all messages in your chat with{" "}
              <span className="font-medium">{otherName}</span>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingChat}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteConversation}
              disabled={deletingChat}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingChat ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Full-screen photo viewer for tapped image messages */}
      {viewerSrc && <ImageViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />}
    </div>
  )
}

// ─── ChatHeader ────────────────────────────────────────────────────────────────

function ChatHeader({
  conversation,
  currentUserId,
  otherName,
  isOtherTyping,
  onBack,
  onDeleteConversation,
}: {
  conversation: Conversation
  currentUserId: string
  otherName: string
  isOtherTyping: boolean
  onBack: () => void
  onDeleteConversation: () => void
}) {
  const { isOnline, getLastSeen } = usePresence(currentUserId)

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
  // Same identity colour as the conversation list, so the person you opened
  // still looks like the row you tapped.
  const gradient = avatarGradient(otherName)

  return (
    <header className="flex h-16 shrink-0 items-center gap-2.5 px-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        aria-label="Back"
        className="tap-target h-10 w-10 shrink-0 rounded-full"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>

      {/* Avatar with online dot */}
      <div className="relative shrink-0">
        <div className="relative h-11 w-11 overflow-hidden rounded-full bg-muted ring-2 ring-border/60">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={otherName}
              fill
              className="object-cover"
              sizes="44px"
            />
          ) : (
            <div
              className={cn(
                "flex h-full w-full items-center justify-center bg-gradient-to-br text-base font-bold text-white",
                gradient
              )}
            >
              {otherName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        {online && (
          <>
            {/* Halo pulses behind the dot to signal live presence at a glance */}
            <span
              aria-hidden
              className="presence-ping pointer-events-none absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-emerald-500"
            />
            <span
              aria-label="Online"
              className="absolute bottom-0 right-0 block h-3 w-3 rounded-full border-2 border-background bg-emerald-500"
            />
          </>
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
        {/* Live presence line. Typing outranks online/last-seen, because it's
            the more useful signal while you're composing a reply. */}
        <p className="truncate text-[11px] leading-tight">
          {isOtherTyping ? (
            <span className="font-medium text-primary">typing…</span>
          ) : online ? (
            <span className="font-medium text-emerald-600 dark:text-emerald-500">online now</span>
          ) : lastSeenText ? (
            <span className="text-muted-foreground">{lastSeenText}</span>
          ) : (
            <span className="text-muted-foreground">offline</span>
          )}
        </p>
      </div>

      {/* Options menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Chat options"
            className="tap-target h-9 w-9 shrink-0 rounded-full"
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={onDeleteConversation}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete conversation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}

// ─── MessageTick ───────────────────────────────────────────────────────────────

interface MessageTickProps {
  delivered: boolean
  read: boolean
  /** "overlay" draws light ticks for legibility on the dark scrim over a photo. */
  tone?: "default" | "overlay"
}

function MessageTick({ delivered, read, tone = "default" }: MessageTickProps) {
  const overlay = tone === "overlay"

  if (read) {
    return (
      <CheckCheck
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          overlay ? "text-sky-400" : "text-green-500 dark:text-green-400"
        )}
      />
    )
  }
  if (delivered) {
    return (
      <CheckCheck
        className={cn("h-3.5 w-3.5 shrink-0", overlay ? "text-white/75" : "text-primary-foreground/55")}
      />
    )
  }
  return (
    <Check
      className={cn("h-3.5 w-3.5 shrink-0", overlay ? "text-white/75" : "text-primary-foreground/55")}
    />
  )
}

// ─── MessageBubble ─────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  /** Consecutive messages from one sender cluster together. */
  isFirstInGroup: boolean
  isLastInGroup: boolean
  /** Only messages arriving after mount animate in, so opening a long thread
      doesn't replay the entrance animation on the whole history. */
  animateIn: boolean
  onEdit: () => void
  onDelete: () => void
  onCopy: () => void
  onOpenImage: (src: string) => void
}

function MessageBubble({
  message,
  isOwn,
  isFirstInGroup,
  isLastInGroup,
  animateIn,
  onEdit,
  onDelete,
  onCopy,
  onOpenImage,
}: MessageBubbleProps) {
  const timeStr = format(new Date(message.created_at), "HH:mm")
  const imageUrl = message.image_url

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
        "group flex items-end gap-1",
        isFirstInGroup ? "mt-2" : "mt-0.5",
        isOwn ? "flex-row-reverse" : "flex-row",
        animateIn && "bubble-in"
      )}
    >
      {/* Bubble. Incoming bubbles carry a hairline ring so they stay legible
          against the muted surface in both themes. */}
      <div
        className={cn(
          "relative max-w-[75%] overflow-hidden rounded-2xl text-sm leading-relaxed shadow-sm",
          isOwn
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground ring-1 ring-border/60",
          // A photo runs edge to edge; only a text bubble needs the padding.
          imageUrl ? "p-0" : "px-3 py-2",
          // Corners that touch a neighbouring message from the same sender get
          // squared off, and the tail is kept only on the last one in a run.
          isOwn
            ? cn(
                isFirstInGroup ? "rounded-tr-2xl" : "rounded-tr-md",
                isLastInGroup ? "rounded-br-sm" : "rounded-br-md"
              )
            : cn(
                isFirstInGroup ? "rounded-tl-2xl" : "rounded-tl-md",
                isLastInGroup ? "rounded-bl-sm" : "rounded-bl-md"
              )
        )}
      >
        {imageUrl ? (
          /* Photos carry their own caption, timestamp and receipt on a scrim,
             so an image-only message needs no extra bubble chrome. */
          <MessageImage
            src={imageUrl}
            caption={message.content}
            timeStr={timeStr}
            edited={!!message.edited_at}
            isOwn={isOwn}
            delivered={message.delivered}
            read={message.read}
            onOpen={() => onOpenImage(imageUrl)}
          />
        ) : (
          <>
            {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}

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
          </>
        )}
      </div>

      {/* Actions menu — available for every message. Kept visible where hover
          isn't available, otherwise copy/edit/delete are unreachable on touch.
          No tap-target overlay here: the pseudo-element would sit over the
          adjacent bubble and steal taps meant for the message text. */}
      <div
        className={cn(
          "mb-1 transition-opacity focus-within:opacity-100",
          "opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Message options"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isOwn ? "end" : "start"} className="w-40">
            {message.content && (
              <DropdownMenuItem onClick={onCopy}>
                <Copy className="mr-2 h-3.5 w-3.5" />
                Copy
              </DropdownMenuItem>
            )}
            {imageUrl && (
              <DropdownMenuItem onClick={() => onOpenImage(imageUrl)}>
                <ImageIcon className="mr-2 h-3.5 w-3.5" />
                View image
              </DropdownMenuItem>
            )}
            {isOwn && (
              <>
                <DropdownMenuSeparator />
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
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

// ─── MessageImage ──────────────────────────────────────────────────────────────

/** Ratios outside this range get clamped, so a panorama or a very tall portrait
    can't take over the thread — the same compromise WhatsApp makes. */
const MIN_IMAGE_RATIO = 0.72
const MAX_IMAGE_RATIO = 1.9

interface MessageImageProps {
  src: string
  caption: string | null
  timeStr: string
  edited: boolean
  isOwn: boolean
  delivered: boolean
  read: boolean
  onOpen: () => void
}

/**
 * A photo message laid out the way messaging apps do it: the image sizes to its
 * own aspect ratio (measured on load, so nothing is cropped to a fixed box),
 * and the caption, timestamp and receipt sit on a dark scrim over the bottom
 * edge. Tapping opens the full-screen viewer.
 */
function MessageImage({
  src,
  caption,
  timeStr,
  edited,
  isOwn,
  delivered,
  read,
  onOpen,
}: MessageImageProps) {
  const [ratio, setRatio] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  const displayRatio =
    ratio === null
      ? 4 / 3
      : Math.min(Math.max(ratio, MIN_IMAGE_RATIO), MAX_IMAGE_RATIO)

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={caption ? `Open image: ${caption}` : "Open image"}
      className="group/img relative block w-[240px] max-w-full text-left sm:w-[280px]"
    >
      <span className="relative block w-full" style={{ aspectRatio: String(displayRatio) }}>
        {/* The shimmer sits *behind* the photo, so a cached image that paints
            before React attaches its handler still covers it correctly. */}
        {!loaded && <span aria-hidden className="skeleton-shimmer absolute inset-0 block" />}

        {!failed && (
          <Image
            src={src}
            alt={caption ?? "Shared image"}
            fill
            sizes="(max-width: 640px) 240px, 280px"
            className="chat-image-in object-cover"
            ref={(el) => {
              // A cached image can finish before onLoad is attached, which
              // would leave it cropped at the default ratio. Catch it here.
              if (!el || loaded || failed) return
              if (el.complete && el.naturalWidth > 0 && el.naturalHeight > 0) {
                setRatio(el.naturalWidth / el.naturalHeight)
                setLoaded(true)
              }
            }}
            onLoad={(e) => {
              const el = e.currentTarget
              if (el.naturalWidth > 0 && el.naturalHeight > 0) {
                setRatio(el.naturalWidth / el.naturalHeight)
              }
              setLoaded(true)
            }}
            onError={() => {
              setFailed(true)
              setLoaded(true)
            }}
          />
        )}

        {failed && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-muted text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
            <span className="text-[10px] font-medium">Image unavailable</span>
          </span>
        )}

        {/* Expand affordance — pointer devices only; on touch, tapping is obvious. */}
        {!failed && (
          <span className="pointer-events-none absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover/img:opacity-100">
            <Maximize2 className="h-3.5 w-3.5" />
          </span>
        )}

        {/* Caption + meta scrim */}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end gap-2 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-2.5 pb-1.5 pt-8">
          {caption && (
            <span className="line-clamp-3 min-w-0 flex-1 text-[13px] leading-snug text-white/95">
              {caption}
            </span>
          )}
          <span className="ml-auto flex shrink-0 items-center gap-1">
            <span className="text-[10px] text-white/85">
              {timeStr}
              {edited && " (edited)"}
            </span>
            {isOwn && <MessageTick delivered={delivered} read={read} tone="overlay" />}
          </span>
        </span>
      </span>
    </button>
  )
}

// ─── ImageViewer ──────────────────────────────────────────────────────────────

/**
 * Full-screen photo viewer. Escape closes it, the page behind it is scroll
 * locked, and "Save" downloads the file (falling back to opening the original
 * when the storage host blocks a cross-origin blob read).
 */
function ImageViewer({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  async function handleSave() {
    try {
      const res = await fetch(src, { mode: "cors" })
      if (!res.ok) throw new Error("fetch failed")
      const blob = await res.blob()
      const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg")
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl
      a.download = `shoppie-${Date.now()}.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    } catch {
      window.open(src, "_blank", "noopener")
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onClick={onClose}
      className="viewer-in fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm"
    >
      <div
        className="flex shrink-0 items-center justify-end gap-1.5 p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleSave}
          aria-label="Save image"
          className="flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
        >
          <Download className="h-4 w-4" />
          Save
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close image"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1 px-2 pb-4">
        <Image
          src={src}
          alt="Shared image"
          fill
          sizes="100vw"
          className="viewer-image-in object-contain"
        />
      </div>
    </div>
  )
}

// ─── Chat states ───────────────────────────────────────────────────────────────

function ChatMessagesSkeleton() {
  // Bubble-shaped placeholders that alternate sides, so the thread reads as
  // "messages are coming" rather than showing a bare spinner.
  const widths = ["w-3/5", "w-2/5", "w-3/4", "w-1/2", "w-2/3"]
  return (
    <div aria-label="Loading messages" className="space-y-3 py-2">
      {widths.map((w, i) => (
        <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
          <div className={cn("skeleton-shimmer h-10 rounded-2xl", w)} />
        </div>
      ))}
    </div>
  )
}

function ChatEmptyState({
  otherName,
  avatarUrl,
  onPickIcebreaker,
}: {
  otherName: string
  avatarUrl: string | null
  onPickIcebreaker: (text: string) => void
}) {
  // Openers pre-fill the composer rather than sending straight away — the user
  // can still edit before it goes out.
  const icebreakers = [
    "Hi, is this still available?",
    "Can you do a better price?",
    "Where are you located?",
  ]

  return (
    <div className="flex h-full flex-col items-center justify-center px-2 text-center">
      <div className="relative mb-4">
        <div aria-hidden className="absolute inset-0 -m-4 rounded-full bg-primary/10 blur-xl" />
        <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-border/60">
          {avatarUrl ? (
            <Image src={avatarUrl} alt="" fill className="object-cover" sizes="64px" />
          ) : (
            <span className="text-xl font-bold uppercase text-muted-foreground">
              {otherName.charAt(0)}
            </span>
          )}
        </div>
      </div>
      <p className="text-base font-semibold tracking-tight text-foreground">
        Start the conversation
      </p>
      {/* Solid pill behind the tagline: bare 12px muted text lost contrast
          sitting directly on the patterned wallpaper. */}
      <p className="mt-1 max-w-[16rem] rounded-full bg-card/90 px-3 py-1 text-xs leading-relaxed text-muted-foreground shadow-sm ring-1 ring-border/50">
        Ask {otherName} about this item — most vendors reply within a few hours.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {icebreakers.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => onPickIcebreaker(text)}
            className="tap-target rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            {text}
          </button>
        ))}
      </div>
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
