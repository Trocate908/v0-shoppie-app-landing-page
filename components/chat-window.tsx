"use client"

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  KeyboardEvent,
  ChangeEvent,
} from "react"
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
} from "lucide-react"
import Image from "next/image"
import { format, isToday, isYesterday } from "date-fns"
import { cn } from "@/lib/utils"
import { usePresence, formatLastSeen } from "@/hooks/use-presence"
import { VerificationBadge } from "@/components/verification-badge"
import { EmojiPicker } from "@/components/emoji-picker"

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

  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })

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
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversation.id, currentUserId, otherName])

  async function uploadImage(file: File): Promise<string | null> {
    try {
      const supabase = createBrowserClient()
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

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Header */}
      <ChatHeader
        conversation={conversation}
        currentUserId={currentUserId}
        otherName={otherName}
        onBack={onBack}
        onDeleteConversation={() => setConfirmDeleteChat(true)}
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
      <main
        ref={scrollContainerRef}
        className="relative flex-1 overflow-y-auto px-4 py-3"
      >
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
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
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
                      onCopy={() => msg.content && copyMessage(msg.content)}
                    />
                  )
                })}
              </div>
            ))}
          </div>
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
          <div className="flex flex-1 items-end gap-0.5 rounded-2xl bg-muted/60 pl-1 pr-2 ring-0 focus-within:ring-1 focus-within:ring-primary/40">
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
              onChange={(e) =>
                editingMessage
                  ? setEditContent(e.target.value)
                  : setInput(e.target.value)
              }
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
            className="h-11 w-11 shrink-0 rounded-full shadow-sm"
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
    </div>
  )
}

// ─── ChatHeader ────────────────────────────────────────────────────────────────

function ChatHeader({
  conversation,
  currentUserId,
  otherName,
  onBack,
  onDeleteConversation,
}: {
  conversation: Conversation
  currentUserId: string
  otherName: string
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

  return (
    <header className="sticky top-0 z-10 flex h-[60px] shrink-0 items-center gap-3 border-b border-border bg-background/95 px-2 pr-2 backdrop-blur">
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

      {/* Options menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Chat options"
            className="shrink-0"
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
}

function MessageTick({ delivered, read }: MessageTickProps) {
  if (read) {
    return <CheckCheck className="h-3.5 w-3.5 shrink-0 text-green-500 dark:text-green-400" />
  }
  if (delivered) {
    return <CheckCheck className="h-3.5 w-3.5 shrink-0 text-primary-foreground/55" />
  }
  return <Check className="h-3.5 w-3.5 shrink-0 text-primary-foreground/55" />
}

// ─── MessageBubble ─────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  onEdit: () => void
  onDelete: () => void
  onCopy: () => void
}

function MessageBubble({ message, isOwn, onEdit, onDelete, onCopy }: MessageBubbleProps) {
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
          "relative max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm",
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
      </div>

      {/* Actions menu — available for every message */}
      <div className="mb-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
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
          <DropdownMenuContent align={isOwn ? "end" : "start"} className="w-40">
            {message.content && (
              <DropdownMenuItem onClick={onCopy}>
                <Copy className="mr-2 h-3.5 w-3.5" />
                Copy
              </DropdownMenuItem>
            )}
            {message.image_url && !message.content && (
              <DropdownMenuItem
                onClick={() => window.open(message.image_url!, "_blank", "noopener")}
              >
                <ImageIcon className="mr-2 h-3.5 w-3.5" />
                Open image
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
