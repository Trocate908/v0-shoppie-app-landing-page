/**
 * Message Delivery Status Tracker
 *
 * Provides Socket.io-like event emission for real-time message delivery status.
 * Uses Supabase Realtime as the transport, but exposes a simple .on() / .emit()
 * interface for convenience.
 *
 * Events:
 *   - "message:sent"        { messageId, conversationId, timestamp }
 *   - "message:delivered"   { messageId, conversationId, timestamp }
 *   - "message:read"        { messageId, conversationId, timestamp }
 *   - "user:typing"         { conversationId, userId, userName }
 *   - "user:stopped-typing" { conversationId, userId }
 */

type DeliveryEvent =
  | {
      type: "message:sent" | "message:delivered" | "message:read"
      messageId: string
      conversationId: string
      timestamp: number
    }
  | {
      type: "user:typing"
      conversationId: string
      userId: string
      userName: string
    }
  | {
      type: "user:stopped-typing"
      conversationId: string
      userId: string
    }

type EventListener = (event: DeliveryEvent) => void

class MessageDeliveryTracker {
  private listeners: Map<string, Set<EventListener>> = new Map()
  private typingTimers: Map<string, NodeJS.Timeout> = new Map()

  /**
   * Subscribe to delivery events.
   * Similar to socket.io's socket.on()
   */
  on(eventType: DeliveryEvent["type"], listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)!.add(listener)

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(listener)
    }
  }

  /**
   * Emit a delivery event to all listeners.
   * Called internally when Supabase Realtime broadcasts status changes.
   */
  emit(event: DeliveryEvent): void {
    const listeners = this.listeners.get(event.type)
    if (!listeners) return

    listeners.forEach((listener) => {
      try {
        listener(event)
      } catch (err) {
        console.error(`[MessageDelivery] Listener error for ${event.type}:`, err)
      }
    })
  }

  /**
   * Emit a typing indicator. Auto-clears after 3 seconds of inactivity.
   */
  emitTyping(conversationId: string, userId: string, userName: string): void {
    this.emit({
      type: "user:typing",
      conversationId,
      userId,
      userName,
    })

    // Clear any pending timer
    const key = `${conversationId}:${userId}`
    const existingTimer = this.typingTimers.get(key)
    if (existingTimer) clearTimeout(existingTimer)

    // Set new timer to emit "stopped-typing" after 3s
    const timer = setTimeout(() => {
      this.emit({
        type: "user:stopped-typing",
        conversationId,
        userId,
      })
      this.typingTimers.delete(key)
    }, 3000)

    this.typingTimers.set(key, timer)
  }
}

// Singleton instance
export const deliveryTracker = new MessageDeliveryTracker()

export type { DeliveryEvent, EventListener }
