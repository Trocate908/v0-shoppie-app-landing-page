# Socket.io Migration Guide (Optional)

Currently, the notification system uses **Supabase Realtime** for message delivery and a custom **Socket.io-like event emitter** for local typing/delivery tracking.

This document explains how to optionally upgrade to **Socket.io** for real-time communication, if needed for more advanced features (rooms, namespaces, etc.).

## When to Use Socket.io

**Use Socket.io if you need**:
- Bidirectional real-time communication with guaranteed message ordering
- Automatic reconnection and buffering on network failure
- Presence/room management at the server level
- Broadcast to multiple clients efficiently
- Custom events beyond message delivery

**Stick with Supabase Realtime if**:
- Database-driven (changes in Postgres → broadcast to clients) ✓ Current approach
- Simpler architecture (no separate WebSocket server)
- Lower infrastructure costs
- Already using Supabase for everything

---

## Current Architecture (Supabase Realtime)

```
┌─────────────────┐
│  Browser Client │
│  (chat-window)  │
└────────┬────────┘
         │
         │ subscribe to `chat:conv-id`
         │
         ▼
┌──────────────────────────┐
│  Supabase Realtime       │
│  Postgres Changes        │
│  (INSERT/UPDATE/DELETE)  │
└─────────┬────────────────┘
          │
          │ broadcasts INSERT/UPDATE/DELETE
          │
          ▼
┌──────────────────────────┐
│  All Connected Clients   │
│  (receive db changes)    │
└──────────────────────────┘
```

**Pros**:
- ✓ Built-in to Supabase
- ✓ Database-driven (single source of truth)
- ✓ No separate server needed
- ✓ Scales with Postgres

**Cons**:
- ✗ Only broadcasts actual database changes
- ✗ Typing indicators need custom broadcast channel
- ✗ Presence requires separate tracking

---

## Optional: Socket.io Architecture

```
┌──────────────────────────────────────────┐
│  Next.js Server (with Socket.io)         │
│  /pages/api/socket.ts (or separate srv)  │
└──────────────┬───────────────────────────┘
               │
               │ io.on("connection")
               │
               ▼
┌──────────────────────────────────────────┐
│  Socket.io Namespace: /messages          │
│  - room: conv-{id}                       │
│  - events: message, typing, read, etc    │
└──────────────────────────────────────────┘
               △
               │ socket.emit() / socket.on()
               │
        ┌──────┴──────────┬──────────┐
        │                 │          │
    ┌───▼───┐         ┌───▼───┐   ┌─▼────┐
    │Browser│         │Mobile │   │ App  │
    │Client │         │Client │   │      │
    └───────┘         └───────┘   └──────┘
```

**Pros**:
- ✓ Ephemeral events (typing, presence, etc.)
- ✓ Bidirectional (client ↔ server ↔ client)
- ✓ Room/namespace management
- ✓ Easy reconnection handling
- ✓ Multiple server instances (with Redis adapter)

**Cons**:
- ✗ Requires separate WebSocket server
- ✗ More infrastructure overhead
- ✗ Database consistency needs careful handling

---

## Step-by-Step: Add Socket.io (if needed)

### 1. Install Dependencies

```bash
npm install socket.io socket.io-client
```

### 2. Create Socket.io Server Handler

Create `/lib/socket-server.ts`:

```typescript
import { Server } from "socket.io"
import { createClient } from "@/lib/supabase/server"

let io: Server | null = null

export function initializeSocket(server: any) {
  if (io) return io

  io = new Server(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      credentials: true,
    },
    transports: ["websocket", "polling"],
  })

  io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`)

    // User authentication
    socket.on("auth", async (data: { userId: string; conversationId: string }) => {
      const { userId, conversationId } = data
      
      // Verify user can access this conversation (check DB)
      const supabase = await createClient()
      const { data: conv } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", conversationId)
        .single()

      if (!conv || (conv.buyer_id !== userId && conv.vendor_id !== userId)) {
        socket.disconnect()
        return
      }

      // Join room scoped to this conversation
      socket.join(`conv:${conversationId}`)
      socket.data.userId = userId
      socket.data.conversationId = conversationId
      socket.emit("auth:success")
    })

    // User typing
    socket.on("typing", (data: { conversationId: string; userName: string }) => {
      socket.to(`conv:${data.conversationId}`).emit("user:typing", {
        userId: socket.data.userId,
        conversationId: data.conversationId,
        userName: data.userName,
      })
    })

    // User stopped typing
    socket.on("stopped-typing", (data: { conversationId: string }) => {
      socket.to(`conv:${data.conversationId}`).emit("user:stopped-typing", {
        userId: socket.data.userId,
        conversationId: data.conversationId,
      })
    })

    // Message sent (client-side optimization, still goes to DB)
    socket.on("message:sent", (data: { conversationId: string; messageId: string }) => {
      socket.to(`conv:${data.conversationId}`).emit("message:sent", {
        userId: socket.data.userId,
        messageId: data.messageId,
        timestamp: Date.now(),
      })
    })

    socket.on("disconnect", () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`)
    })
  })

  return io
}

export function getSocket() {
  return io
}
```

### 3. Create Client Hook

Create `/hooks/use-socket.ts`:

```typescript
"use client"

import { useEffect, useRef, useCallback } from "react"
import { io, type Socket } from "socket.io-client"

type SocketEvent =
  | "message:sent"
  | "message:delivered"
  | "message:read"
  | "user:typing"
  | "user:stopped-typing"

export function useSocket(userId: string, conversationId: string) {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const socket = io({
      path: "/api/socket",
      transports: ["websocket", "polling"],
    })

    socket.on("connect", () => {
      console.log(`[Socket] Connected: ${socket.id}`)
      socket.emit("auth", { userId, conversationId })
    })

    socket.on("auth:success", () => {
      console.log(`[Socket] Authenticated for ${conversationId}`)
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
    }
  }, [userId, conversationId])

  const emit = useCallback(
    (event: SocketEvent, data: any) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit(event, data)
      }
    },
    []
  )

  const on = useCallback(
    (event: SocketEvent, handler: (data: any) => void) => {
      if (!socketRef.current) return () => {}
      socketRef.current.on(event, handler)
      return () => socketRef.current?.off(event, handler)
    },
    []
  )

  return { emit, on, socket: socketRef.current }
}
```

### 4. Integrate into Chat Window

```typescript
import { useSocket } from "@/hooks/use-socket"

export default function ChatWindow({ conversation, currentUserId, onBack }: ChatWindowProps) {
  const { emit: socketEmit, on: socketOn } = useSocket(currentUserId, conversation.id)

  // Typing indicator via Socket.io
  function handleInputChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    
    const now = Date.now()
    if (now - lastTypingSentAtRef.current > 1000) {
      lastTypingSentAtRef.current = now
      socketEmit("typing", {
        conversationId: conversation.id,
        userName: otherName,
      })
    }
  }

  // Unsubscribe from other participant typing
  useEffect(() => {
    const unsubTyping = socketOn("user:typing", (data) => {
      if (data.userId !== currentUserId) {
        setIsOtherTyping(true)
      }
    })

    const unsubStoppedTyping = socketOn("user:stopped-typing", (data) => {
      if (data.userId !== currentUserId) {
        setIsOtherTyping(false)
      }
    })

    return () => {
      unsubTyping()
      unsubStoppedTyping()
    }
  }, [socketOn, currentUserId])
}
```

### 5. Add Socket.io Route Handler

Create `/app/api/socket/route.ts` (for Next.js):

```typescript
import { NextRequest } from "next/server"
import { initializeSocket } from "@/lib/socket-server"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  // This won't work with standard Next.js — Socket.io needs raw Node.js server
  // Use a separate Node.js server or upgrade to a serverless WebSocket solution
  return new Response("Socket.io requires a separate server", { status: 501 })
}
```

**Note**: Socket.io requires a separate Node.js server (not serverless). Options:
1. **Docker + Railway**: Spin up separate Socket.io server
2. **Vercel Edge Functions**: Not supported (WebSockets limited)
3. **AWS/Heroku**: Deploy separate Node.js app
4. **Socket.io Cloud**: Managed Socket.io service

---

## Hybrid Approach (Recommended if using Socket.io)

Use **both** Supabase Realtime + Socket.io:

```
┌──────────────────────────────────────┐
│  Message Delivery (Database-driven)  │
│  ✓ Uses Supabase Realtime            │
│  ✓ INSERT/UPDATE broadcasts          │
│  ✓ Single source of truth            │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  Ephemeral Events (Real-time only)   │
│  ✓ Uses Socket.io                    │
│  ✓ Typing, presence, delivery ACKs   │
│  ✓ No database writes needed         │
└──────────────────────────────────────┘
```

This gives you:
- Database-backed message persistence (Supabase)
- Low-latency ephemeral events (Socket.io)
- Minimal infrastructure overhead
- Clear separation of concerns

---

## Comparison Table

| Feature | Supabase Realtime | Socket.io | Hybrid |
|---------|-------------------|-----------|--------|
| Message persistence | ✓ (DB) | ✗ | ✓ (DB + events) |
| Typing indicators | ✓ (broadcast) | ✓ | ✓ |
| Presence tracking | ✓ | ✓ | ✓ |
| Infrastructure | Included | Separate | Separate |
| Cost | Included | Low to medium | Low to medium |
| Scalability | ✓✓✓ | ✓✓ | ✓✓✓ |
| Complexity | Low | Medium | Medium |

---

## Recommendation

**For your current use case**:
- ✓ Keep Supabase Realtime for message delivery
- ✓ Use `deliveryTracker` for local typing indicators
- ✓ Add Socket.io **only** if you need:
  - Guaranteed message ordering across devices
  - Server-side presence/room management
  - Broadcast to multiple conversations simultaneously
  - Custom protocol beyond Postgres changes

The current architecture (Supabase Realtime + deliveryTracker) is simple, scalable, and sufficient for a messaging app.
