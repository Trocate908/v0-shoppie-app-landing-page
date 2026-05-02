import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendOneSignalToUsers, isOneSignalConfigured } from "@/lib/push/onesignal"

export type NotificationType =
  | "message"
  | "trending"
  | "product_loved"
  | "start_posting"
  | "new_product"
  | "custom"

export type DispatchTarget =
  | { userId: string }
  | { userIds: string[] }
  | { deviceId: string }
  | { audience: "all_shoppers" | "all_vendors_with_products" | "all_vendors_without_products" | "all" }

export type DispatchInput = {
  type: NotificationType
  title: string
  body: string
  link?: string
  imageUrl?: string
  data?: Record<string, string>
  refId?: string             // dedupe key (e.g. conversation_id)
  dedupeWindowHours?: number // default 24
}

// ── Target resolution ────────────────────────────────────────────────────────

async function resolveTargets(
  supabase: ReturnType<typeof createAdminClient>,
  target: DispatchTarget,
): Promise<{ userIds: string[]; deviceIds: string[] }> {
  const userIds   = new Set<string>()
  const deviceIds = new Set<string>()

  if ("userId" in target) {
    userIds.add(target.userId)
  } else if ("userIds" in target) {
    target.userIds.forEach((id) => userIds.add(id))
  } else if ("deviceId" in target) {
    deviceIds.add(target.deviceId)
  } else if ("audience" in target) {
    if (target.audience === "all_shoppers" || target.audience === "all") {
      const { data } = await supabase
        .from("push_tokens")
        .select("user_id, device_id")
        .eq("enabled", true)
        .in("user_type", ["shopper", "anonymous"])
      data?.forEach((r) => {
        if (r.user_id) userIds.add(r.user_id)
        else if (r.device_id) deviceIds.add(r.device_id)
      })
    }
    if (target.audience === "all_vendors_with_products" || target.audience === "all") {
      const { data: vendors } = await supabase
        .from("vendors")
        .select("user_id, products!inner(id)")
        .limit(5000)
      vendors?.forEach((v) => v.user_id && userIds.add(v.user_id as string))
    }
    if (target.audience === "all_vendors_without_products") {
      const { data: vendors } = await supabase.from("vendors").select("user_id, id")
      const ids = (vendors ?? []).map((v) => v.id).filter(Boolean) as string[]
      const { data: withProducts } = await supabase.from("products").select("vendor_id").in("vendor_id", ids)
      const has = new Set((withProducts ?? []).map((p) => p.vendor_id))
      vendors?.forEach((v) => { if (v.user_id && !has.has(v.id)) userIds.add(v.user_id as string) })
    }
  }

  return { userIds: Array.from(userIds), deviceIds: Array.from(deviceIds) }
}

// ── Deduplication ────────────────────────────────────────────────────────────

async function isRecentlySent(
  supabase: ReturnType<typeof createAdminClient>,
  type: NotificationType,
  refId: string | undefined,
  userId: string | null,
  deviceId: string | null,
  windowHours: number,
): Promise<boolean> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()
  let q = supabase
    .from("notification_sends")
    .select("id", { count: "exact", head: true })
    .eq("type", type)
    .gte("sent_at", since)
  if (refId)   q = q.eq("ref_id", refId)
  if (userId)  q = q.eq("user_id", userId)
  else if (deviceId) q = q.eq("device_id", deviceId)
  else return false
  const { count } = await q
  return (count ?? 0) > 0
}

// ── Core dispatch function ───────────────────────────────────────────────────

export async function dispatchNotification(
  target: DispatchTarget,
  input: DispatchInput,
): Promise<{ pushed: number; persisted: number; pruned: number }> {
  const supabase = createAdminClient()
  const { userIds, deviceIds } = await resolveTargets(supabase, target)

  if (userIds.length === 0 && deviceIds.length === 0) {
    return { pushed: 0, persisted: 0, pruned: 0 }
  }

  const dedupeWindow = input.dedupeWindowHours ?? 24

  // Filter recipients that got this same type+refId recently
  const eligibleUserIds: string[] = []
  for (const id of userIds) {
    if (!(await isRecentlySent(supabase, input.type, input.refId, id, null, dedupeWindow))) {
      eligibleUserIds.push(id)
    }
  }
  const eligibleDeviceIds: string[] = []
  for (const id of deviceIds) {
    if (!(await isRecentlySent(supabase, input.type, input.refId, null, id, dedupeWindow))) {
      eligibleDeviceIds.push(id)
    }
  }

  if (eligibleUserIds.length === 0 && eligibleDeviceIds.length === 0) {
    return { pushed: 0, persisted: 0, pruned: 0 }
  }

  // Persist in-app notification rows
  const rows = [
    ...eligibleUserIds.map((uid) => ({
      user_id: uid, device_id: null,
      type: input.type, title: input.title, body: input.body,
      link: input.link ?? null, image_url: input.imageUrl ?? null,
      metadata: input.data ?? null,
    })),
    ...eligibleDeviceIds.map((did) => ({
      user_id: null, device_id: did,
      type: input.type, title: input.title, body: input.body,
      link: input.link ?? null, image_url: input.imageUrl ?? null,
      metadata: input.data ?? null,
    })),
  ]

  let persisted = 0
  if (rows.length > 0) {
    const { count } = await supabase.from("notifications").insert(rows, { count: "exact" })
    persisted = count ?? rows.length
  }

  // ── Push delivery via OneSignal ─────────────────────────────────────────
  // OneSignal identifies users by their Supabase user ID (set as external_id
  // in the browser SDK). No token lookup needed — OneSignal manages subscriptions.
  let pushed = 0
  if (eligibleUserIds.length > 0 && isOneSignalConfigured()) {
    const result = await sendOneSignalToUsers(eligibleUserIds, {
      title: input.title,
      body: input.body,
      url: input.link,
      imageUrl: input.imageUrl,
    })
    if (result.ok) pushed = result.notified
    else console.warn("[dispatch] OneSignal push failed:", result.error)
  }

  // Record sends for deduplication
  const sendRows = [
    ...eligibleUserIds.map((uid) => ({
      user_id: uid, device_id: null, type: input.type, ref_id: input.refId ?? null,
    })),
    ...eligibleDeviceIds.map((did) => ({
      user_id: null, device_id: did, type: input.type, ref_id: input.refId ?? null,
    })),
  ]
  if (sendRows.length > 0) {
    await supabase.from("notification_sends").insert(sendRows)
  }

  return { pushed, persisted, pruned: 0 }
}
