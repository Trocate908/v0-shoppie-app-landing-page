# Notification System Architecture

This document describes the multi-layer notification system that handles message delivery, typing indicators, and push notifications across web, native WebView (AppInventor/Kodular), and PWA clients.

## Overview

The system consists of four layers:

```
┌─────────────────────────────────────────────────┐
│ 1. VAPID Web Push (PWA/Desktop)                 │
│    `/api/push/send` → Browser Service Worker    │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│ 2. Browser Notification API                      │
│    `window.Notification` (when tab hidden)       │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│ 3. AppInventor/Kodular WebView Bridge           │
│    `window.AppInventor.setWebViewString()`       │
│    Format: "Title|Body"                          │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│ 4. Real-time Delivery Tracking                  │
│    `deliveryTracker` (Socket.io-like events)    │
│    Events: message:sent, message:delivered,     │
│            message:read, user:typing             │
└─────────────────────────────────────────────────┘
```

## Components

### 1. VAPID Web Push (`/app/api/push/send/route.ts`)

**Purpose**: Server-side endpoint that sends Web Push notifications to all subscribed devices.

**When triggered**:
- Message arrives for a user who is NOT currently viewing that conversation
- Message is marked as read by the recipient

**How it works**:
1. Client calls `/api/push/send` with message details
2. Server looks up all active push subscriptions for the user
3. Server sends notification via Web Push protocol (using `web-push` library)
4. Browser/device shows notification even if app is closed

**Payload format**:
```json
{
  "userId": "user-id",
  "title": "New message from John",
  "body": "Hello there!",
  "url": "/?tab=messages&cid=conversation-id",
  "tag": "msg-conversation-id"
}
```

**Configuration** (in `/components/pwa-provider.tsx`):
- Requires `NEXT_PUBLIC_VAPID_PUBLIC_KEY` environment variable
- Service worker handles push events in `/public/sw.js`

---

### 2. Browser Notification API

**Purpose**: Native browser notifications when app is open but tab is hidden.

**When triggered**:
- Via `useNotifications()` hook
- Only shows if `document.hidden === true`
- Falls back gracefully if Notification API unavailable

**Implementation** (`/hooks/use-notifications.ts`):
```typescript
const { notify } = useNotifications()

notify({
  title: "New message from John",
  body: "Hello there!",
  tag: "msg-123",
  onClick: () => { /* open conversation */ }
})
```

---

### 3. AppInventor/Kodular WebView Bridge

**Purpose**: Native Android notifications for users running the app in a WebView wrapper.

**How it works**:
1. Client calls `window.AppInventor.setWebViewString("Title|Body")`
2. Native code listens for changes to this string value
3. Android shows native OS notification

**Format**: `"Title|Body"` separated by pipe character
- Title: `"New message from John"`
- Body: `"Hello there!"`
- Native code can split on `|` and show professional Android notification

**Example**:
```typescript
// In use-notifications.ts or app-shell.tsx
const bridge = (window as any).AppInventor
if (bridge?.setWebViewString) {
  bridge.setWebViewString(`${title}|${body}`)
}
```

**For AppInventor/Kodular developers**:
```java
// Listen for WebViewString changes
webView.setWebChromeClient(new WebChromeClient() {
  // When notification arrives, parse and show:
  String data = webViewString; // "New message from John|Hello there!"
  String[] parts = data.split("\\|");
  String title = parts[0];
  String body = parts.length > 1 ? parts[1] : "";
  
  // Show Android notification
  NotificationCompat.Builder builder = new NotificationCompat.Builder(context)
    .setSmallIcon(R.drawable.ic_notification)
    .setContentTitle(title)
    .setContentText(body);
  
  NotificationManagerCompat.from(context).notify(notificationId, builder.build());
});
```

---

### 4. Real-time Delivery Tracking (`/lib/message-delivery.ts`)

**Purpose**: Socket.io-like event emission for real-time message status updates and typing indicators.

**Events emitted**:

#### `message:sent`
```typescript
deliveryTracker.emit({
  type: "message:sent",
  messageId: "msg-123",
  conversationId: "conv-456",
  timestamp: Date.now()
})
```

#### `message:delivered`
```typescript
deliveryTracker.emit({
  type: "message:delivered",
  messageId: "msg-123",
  conversationId: "conv-456",
  timestamp: Date.now()
})
```
Triggered when:
- Receiver's client receives the message via Realtime
- Message is successfully sent to recipient

#### `message:read`
```typescript
deliveryTracker.emit({
  type: "message:read",
  messageId: "msg-123",
  conversationId: "conv-456",
  timestamp: Date.now()
})
```
Triggered when:
- Recipient opens the conversation
- Message `read` column updated in database

#### `user:typing`
```typescript
deliveryTracker.emitTyping(
  "conv-456",    // conversation ID
  "user-789",    // typing user ID
  "John"         // display name
)
```
Emitted on input change (throttled to 1/sec). Auto-clears after 3 seconds.

#### `user:stopped-typing`
```typescript
deliveryTracker.emit({
  type: "user:stopped-typing",
  conversationId: "conv-456",
  userId: "user-789"
})
```
Auto-emitted 3 seconds after last typing indicator.

**Usage**:
```typescript
import { deliveryTracker } from "@/lib/message-delivery"

// Subscribe to events
const unsubscribe = deliveryTracker.on("message:read", (event) => {
  console.log(`Message ${event.messageId} was read!`)
  // Update UI: hide double-tick, show blue double-tick
})

// Cleanup
return () => unsubscribe()
```

---

## Data Flow

### Message Arrives

```
1. Sender sends message via POST /api/messages/:id
   ↓
2. Message inserted into `messages` table
   ↓
3. Supabase Realtime broadcasts INSERT to recipient's clients
   ↓
4. chat-window receives INSERT via realtime subscription
   ↓
5. Message marked `delivered: true` immediately
   ↓
6. If document.hidden, marked `read: false` (not read yet)
   If document.visible, marked `read: true`
   ↓
7. app-shell listens for INSERT via realtime
   ↓
8. If conversation not open AND user not viewing messages tab:
   - Show in-app toast
   - Send VAPID push via /api/push/send
   - Call window.AppInventor.setWebViewString()
   ↓
9. deliveryTracker emits "message:delivered"
   ↓
10. Chat-window updates message status indicator (single → grey double tick)
```

### User Reads Message

```
1. Tab becomes visible (document.visibilitychange event)
   OR conversation is first opened
   ↓
2. chat-window marks unread messages as `read: true`
   ↓
3. Database UPDATE broadcasts to sender's clients
   ↓
4. Sender's messages-tab receives UPDATE via realtime
   ↓
5. deliveryTracker emits "message:read"
   ↓
6. Sender's chat-window sees message.read === true
   ↓
7. Message status changes (grey double → blue/green double tick)
```

### User Types

```
1. User types in textarea
   ↓
2. handleInputChange fires (on every keystroke)
   ↓
3. deliveryTracker.emitTyping() called (throttled to 1/sec)
   ↓
4. Broadcast event available to other clients via:
   - Browser (in same window): deliveryTracker.on("user:typing", ...)
   - Future: Could broadcast to recipient via Supabase Realtime
   ↓
5. After 3 seconds of no typing, auto-emit "user:stopped-typing"
```

---

## Database Schema

```sql
-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  content TEXT,
  image_url TEXT,
  delivered BOOLEAN DEFAULT FALSE,  -- reached recipient device
  read BOOLEAN DEFAULT FALSE,        -- recipient read the message
  created_at TIMESTAMPTZ DEFAULT now(),
  edited_at TIMESTAMPTZ
);

-- Push tokens (for VAPID Web Push)
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  device_id TEXT NOT NULL,
  token JSONB NOT NULL,  -- PushSubscription serialized
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Configuration

### Environment Variables

**Required**:
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - Public key for Web Push (set in Vercel env)

**Optional**:
- `VAPID_PRIVATE_KEY` - Private key for Web Push (set in server env, used by `/api/push/send`)
- `VAPID_SUBJECT` - Admin email for Web Push protocol

### RLS Policies

```sql
-- Users can only see push tokens they created
CREATE POLICY "Users can manage own push tokens"
  ON push_tokens
  FOR ALL
  USING (auth.uid() = user_id);

-- Users can only receive push for their own user ID
CREATE POLICY "Push can only send to own user"
  ON push_tokens
  FOR SELECT
  USING (auth.uid() = user_id);
```

---

## Testing

### Test Web Push
```bash
# 1. Subscribe to push (browser console)
const reg = await navigator.serviceWorker.ready
const sub = await reg.pushManager.subscribe({...})
await fetch("/api/push/subscribe", {
  method: "POST",
  body: JSON.stringify({ subscription: sub })
})

# 2. Send test push
curl -X POST http://localhost:3000/api/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "title": "Test",
    "body": "Test notification"
  }'
```

### Test AppInventor Bridge
```javascript
// In browser console (simulating what Android side calls)
window.AppInventor = {
  setWebViewString: (str) => console.log("Notification:", str)
}

// Then trigger a notification - should log: "Notification: Title|Body"
```

### Test Delivery Tracker
```javascript
import { deliveryTracker } from "@/lib/message-delivery"

deliveryTracker.on("message:delivered", (e) => {
  console.log("Delivered:", e)
})

// Emit test event
deliveryTracker.emit({
  type: "message:delivered",
  messageId: "test",
  conversationId: "test-conv",
  timestamp: Date.now()
})
```

---

## Troubleshooting

### Web Push not working
- [ ] Check `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is set
- [ ] Verify service worker registered: `chrome://serviceworker-internals/`
- [ ] Check notification permission granted: `Notification.permission === "granted"`
- [ ] Verify push subscription stored in `push_tokens` table

### AppInventor notifications not showing
- [ ] Check `window.AppInventor` exists: `console.log(window.AppInventor)`
- [ ] Verify WebView bridge is listening for string changes
- [ ] Test format: `"Title|Body"` (with pipe separator)

### Typing indicator not showing
- [ ] Check `deliveryTracker.on("user:typing", ...)` subscription exists
- [ ] Verify input onChange calls `handleInputChange()`
- [ ] Check throttle: only emits once per second

### Messages not marked as read
- [ ] Verify `chat-window.tsx` calls `update({ read: true })`
- [ ] Check `visibilitychange` event fires when tab becomes visible
- [ ] Verify message `sender_id` differs from `currentUserId`
