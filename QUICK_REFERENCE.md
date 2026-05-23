# Quick Reference: Notification & Delivery System

## File Location Map

| What | Where |
|------|-------|
| Message delivery events | `/lib/message-delivery.ts` |
| VAPID Web Push endpoint | `/app/api/push/send/route.ts` |
| Browser notifications | `/hooks/use-notifications.ts` |
| PWA setup | `/components/pwa-provider.tsx` |
| Service worker | `/public/sw.js` |
| App realtime logic | `/components/app-shell.tsx` |
| Chat realtime logic | `/components/chat-window.tsx` |
| Full documentation | `/NOTIFICATION_SYSTEM.md` |
| Socket.io guide | `/SOCKETIO_MIGRATION.md` |

---

## Common Tasks

### Listen to Delivery Events

```typescript
import { deliveryTracker } from "@/lib/message-delivery"

// Subscribe
const unsub = deliveryTracker.on("message:read", (event) => {
  console.log(`Message ${event.messageId} was read`)
})

// Cleanup
return () => unsub()
```

### Emit a Typing Indicator

```typescript
import { deliveryTracker } from "@/lib/message-delivery"

// In your onChange handler (throttled to 1/sec)
deliveryTracker.emitTyping(
  conversationId,   // string
  userId,           // string
  displayName       // "John" or shop name
)
```

### Send a Notification

```typescript
const { notify } = useNotifications()

notify({
  title: "New message from John",
  body: "Hello there!",
  tag: "msg-123",  // optional, for deduplication
  onClick: () => {
    // Handle click
  }
})
```

### Trigger VAPID Web Push

```typescript
// From server-side (app-shell or API route)
await fetch("/api/push/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userId: "user-id",
    title: "New message from John",
    body: "Hello there!",
    url: "/?tab=messages&cid=conv-id",  // optional
    tag: "msg-123"                        // optional
  })
})
```

### Subscribe to VAPID Push

```typescript
const { subscribeToPush, pushSubscribed } = usePwa()

// Subscription happens automatically in app-shell
// Or manually:
if (pushSupported && !pushSubscribed) {
  await subscribeToPush()
}
```

---

## Event Types

### Message Events

```typescript
// When message reaches recipient
deliveryTracker.on("message:delivered", (event) => {
  // event.messageId
  // event.conversationId
  // event.timestamp
})

// When recipient reads message
deliveryTracker.on("message:read", (event) => {
  // event.messageId
  // event.conversationId
  // event.timestamp
})
```

### Typing Events

```typescript
// When someone is typing
deliveryTracker.on("user:typing", (event) => {
  // event.conversationId
  // event.userId
  // event.userName
})

// When typing stops (auto-emit after 3s)
deliveryTracker.on("user:stopped-typing", (event) => {
  // event.conversationId
  // event.userId
})
```

---

## Component Integration Checklist

### For Each Chat Component

- [ ] Import `deliveryTracker`
- [ ] Subscribe to `message:delivered` and `message:read` events
- [ ] Update UI when delivery status changes
- [ ] Emit typing indicators in `onChange` handler
- [ ] Show "X is typing..." indicator
- [ ] Cleanup subscriptions on unmount

### Example:

```typescript
import { deliveryTracker } from "@/lib/message-delivery"

export function ChatMessages() {
  const [isOtherTyping, setIsOtherTyping] = useState(false)

  useEffect(() => {
    // Listen for typing
    const unsub = deliveryTracker.on("user:typing", (e) => {
      if (e.userId !== currentUserId) {
        setIsOtherTyping(true)
      }
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    // Listen for stopped typing (auto-emitted after 3s)
    const unsub = deliveryTracker.on("user:stopped-typing", (e) => {
      if (e.userId !== currentUserId) {
        setIsOtherTyping(false)
      }
    })
    return () => unsub()
  }, [])

  return (
    <>
      {isOtherTyping && <p>User is typing…</p>}
    </>
  )
}
```

---

## Testing Checklist

### Browser Notifications
- [ ] `Notification.permission === "granted"`
- [ ] Service worker registered: `navigator.serviceWorker.ready`
- [ ] Push subscription in `push_tokens` table
- [ ] Call `/api/push/send` and check notification appears

### AppInventor Bridge
- [ ] `window.AppInventor` exists in WebView
- [ ] String format: `"Title|Body"` with pipe separator
- [ ] Android listener parses and shows notification
- [ ] Test with: `window.AppInventor.setWebViewString("Test|Works")`

### Delivery Events
- [ ] `deliveryTracker.on("message:delivered", console.log)` logs event
- [ ] Event contains `messageId`, `conversationId`, `timestamp`
- [ ] Typing events auto-clear after 3 seconds

### Read Receipts
- [ ] Single tick (sent)
- [ ] Double grey tick (delivered)
- [ ] Double green/blue tick (read)
- [ ] Only mark read when: tab visible OR conversation opened
- [ ] Don't mark read immediately on INSERT if tab hidden

---

## Environment Variables

### Required
```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<base64-public-key>
```

### Optional (for server-side Web Push)
```bash
VAPID_PRIVATE_KEY=<base64-private-key>
VAPID_SUBJECT=admin@example.com
INTERNAL_API_KEY=<secret-key-for-internal-endpoints>
```

---

## Database Columns

### `messages` Table
```sql
- id: UUID
- conversation_id: UUID
- sender_id: UUID
- content: TEXT
- image_url: TEXT
- delivered: BOOLEAN    -- message reached device
- read: BOOLEAN         -- message was read
- deleted: BOOLEAN      -- soft delete
- created_at: TIMESTAMPTZ
- edited_at: TIMESTAMPTZ
```

### `push_tokens` Table
```sql
- id: UUID
- user_id: UUID
- device_id: TEXT       -- unique per device
- token: JSONB          -- PushSubscription serialized
- enabled: BOOLEAN      -- subscription active
- created_at: TIMESTAMPTZ
```

---

## API Endpoints

### POST `/api/push/send`
Send Web Push to all subscribed devices for a user.

**Request**:
```json
{
  "userId": "user-id",
  "title": "New message",
  "body": "Hello!",
  "url": "/?tab=messages",
  "tag": "msg-123"
}
```

**Response**:
```json
{
  "sent": 2,
  "failed": 0
}
```

### POST `/api/push/subscribe`
Register a device for push notifications.

**Request**:
```json
{
  "subscription": { /* PushSubscription object */ },
  "deviceId": "device-id",
  "userType": "buyer"
}
```

### DELETE `/api/push/subscribe`
Unsubscribe from push notifications.

**Request**:
```json
{
  "deviceId": "device-id"
}
```

---

## Keyboard Shortcuts (for debugging)

```javascript
// In browser console

// Clear all push subscriptions
await navigator.serviceWorker.ready.then(r => 
  r.pushManager.getSubscription().then(s => s?.unsubscribe())
)

// Check notification permission
Notification.permission

// Request notification permission
Notification.requestPermission()

// Check service worker
navigator.serviceWorker.getRegistrations()

// Listen to all delivery events
import { deliveryTracker } from '@/lib/message-delivery'
['message:delivered', 'message:read', 'user:typing', 'user:stopped-typing'].forEach(e => {
  deliveryTracker.on(e, console.log)
})

// Simulate notification
window.AppInventor?.setWebViewString("Test|Notification")
```

---

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Web Push not showing | No VAPID public key | Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` |
| Service worker not registered | SW file missing/broken | Check `/public/sw.js` exists |
| AppInventor not receiving | WebView bridge not listening | Verify `window.AppInventor` exists |
| Typing indicator not clearing | Timer not firing | Check `deliveryTracker.emitTyping()` |
| Messages not marked read | Document still hidden | Wait for tab to become visible |
| Double ticks showing too early | Marked read on INSERT | Only mark read if `!document.hidden` |

---

## Performance Tips

1. **Throttle typing indicators**: Don't emit more than 1/sec
2. **Batch mark-as-read**: Update multiple messages in one query
3. **Unsubscribe from events**: Prevent memory leaks in useEffect cleanup
4. **Disable stale tokens**: 410/404 responses auto-disable in push/send route
5. **Cache conversation data**: app-shell caches for sender name resolution

---

## Security Considerations

- ✓ VAPID keys signed by browser (can't be spoofed)
- ✓ Push subscriptions stored per-user (RLS enforced)
- ✓ Message read receipts only from authorized users
- ✓ AppInventor bridge runs in isolated WebView context
- ✓ All API endpoints require authentication (except internal routes with secret)

Ensure `/api/push/send` validates `userId` matches authenticated user.
