import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendWebPushToSubscriptions, type WebPushMessage } from "@/lib/push/server"
import { emitToUser } from "@/lib/socket-server"

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
  | { audience: "all_shoppers" | "all_vendors_with_products" | "all_vendors_without_products" | "all" }

export type DispatchInput = {
  type: NotificationType
  title: string
  body: string
  link?: string
  imageUrl?: string
  data?: Record<string, string>
  refId?: string
  dedupeWindowHours?: number
}

const SITE_URL = "https://shoppieapp.co.zw"

function toAbsolute(link?: string): string | undefined {
  if (!link) return undefined
  if (link.startsWith("http")) return link
  return `${SITE_URL}${link.startsWith("/") ? "" : "/"}${link}`
}

// ── Token helpers ───────────────────────────────────────────────────────────

async function getTokensForUsers(
  supabase: ReturnType<typeof createAdminClient>,
  userIds: string[],
): Promise<{ userId: string; token: string }[]> {
  if (userIds.length === 0) return []
  const { data } = await supabase
    .from("push_tokens")
    .select("user_id, token")
    .eq("enabled", true)
    .in("user_id", userIds)
  return (data ?? []).map((r) => ({ userId: r.user_id as string, token: r.token as string }))
}

async function getAllTokens(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<string[]> {
  const { data } = await supabase
    .from("push_tokens")
    .select("token")
    .eq("enabled", true)
  return (data ?? []).map((r) => r.token as string)
}

async function pruneInvalidTokens(
  supabase: ReturnType<typeof createAdminClient>,
  invalidTokens: string[],
) {
  if (invalidTokens.length === 0) return
  await supabase.from("push_tokens").delete().in("token", invalidTokens)
}

// ── Audience resolver ───────────────────────────────────────────────────────

async function resolveUserIds(
  supabase: ReturnType<typeof createAdminClient>,
  target: DispatchTarget,
): Promise<string[]> {
  if ("userId" in target) return [target.userId]
  if ("userIds" in target) return target.userIds

  const userIds = new Set<string>()

  if ("audience" in target) {
    const { audience } = target

    if (audience === "all_shoppers" || audience === "all") {
      const { data } = await supabase
        .from("push_tokens")
        .select("user_id")
        .eq("enabled", true)
        .in("user_type", ["shopper", "anonymous"])
        .not("user_id", "is", null)
      data?.forEach((r) => r.user_id && userIds.add(r.user_id))
    }

    if (audience === "all_vendors_with_products" || audience === "all") {
      const { data } = await supabase
        .from("vendors")
        .select("user_id, products!inner(id)")
        .limit(5000)
      data?.forEach((v) => v.user_id && userIds.add(v.user_id as string))
    }

    if (audience === "all_vendors_without_products") {
      const { data: vendors } = await supabase.from("vendors").select("user_id, id")
      const ids = (vendors ?? []).map((v) => v.id).filter(Boolean) as string[]
      const { data: withProducts } = await supabase
        .from("products")
        .select("vendor_id")
        .in("vendor_id", ids)
      const has = new Set((withProducts ?? []).map((p) => p.vendor_id))
      vendors?.forEach((v) => {
        if (v.user_id && !has.has(v.id)) userIds.add(v.user_id as string)
      })
    }
  }

  return Array.from(userIds)
}

async function filterByDedup(
  supabase: ReturnType<typeof createAdminClient>,
  userIds: string[],
  type: NotificationType,
  refId: string | undefined,
  windowHours: number,
): Promise<string[]> {
  if (windowHours === 0 || userIds.length === 0) return userIds

  const since = new Date(Date.now() - windowHours * 3_600_000).toISOString()
  let q = supabase
    .from("notification_sends")
    .select("user_id")
    .eq("type", type)
    .gte("sent_at", since)
    .in("user_id", userIds)
  if (refId) q = q.eq("ref_id", refId)

  const { data } = await q
  const alreadySent = new Set((data ?? []).map((r) => r.user_id))
  return userIds.filter((id) => !alreadySent.has(id))
}

// ── Main dispatch ──────────────────────────────────────────────────────────

export async function dispatchNotification(
  target: DispatchTarget,
  input: DispatchInput,
): Promise<{ pushed: number; persisted: number; pruned: number }> {
  const supabase = createAdminClient()
  const dedupeWindow = input.dedupeWindowHours ?? 24

  const vapidMsg: WebPushMessage = {
    title: input.title,
    body: input.body,
    link: toAbsolute(input.link),
    imageUrl: input.imageUrl,
    data: input.data,
  }

  // ── Audience broadcasts ─────────────────────────────────────────────────
  const isAudienceBroadcast =
    "audience" in target &&
    (target.audience === "all_shoppers" || target.audience === "all")

  if (isAudienceBroadcast) {
    if (dedupeWindow > 0 && input.refId) {
      const since = new Date(Date.now() - dedupeWindow * 3_600_000).toISOString()
      const { count } = await supabase
        .from("notification_sends")
        .select("id", { count: "exact", head: true })
        .eq("type", input.type)
        .eq("ref_id", input.refId)
        .gte("sent_at", since)
      if ((count ?? 0) > 0) return { pushed: 0, persisted: 0, pruned: 0 }
    }

    const tokens = await getAllTokens(supabase)
    const { successCount, invalidTokens } = await sendWebPushToSubscriptions(tokens, vapidMsg)
    await pruneInvalidTokens(supabase, invalidTokens)

    if (input.refId) {
      await supabase.from("notification_sends").insert({
        user_id: null,
        device_id: null,
        type: input.type,
        ref_id: input.refId,
      })
    }

    return { pushed: successCount, persisted: 0, pruned: invalidTokens.length }
  }

  // ── Targeted (userId / userIds / vendor audiences) ──────────────────────
  const allUserIds = await resolveUserIds(supabase, target)
  if (allUserIds.length === 0) return { pushed: 0, persisted: 0, pruned: 0 }

  const eligibleUserIds = await filterByDedup(
    supabase,
    allUserIds,
    input.type,
    input.refId,
    dedupeWindow,
  )
  if (eligibleUserIds.length === 0) return { pushed: 0, persisted: 0, pruned: 0 }

  // Persist in-app notifications
  const rows = eligibleUserIds.map((uid) => ({
    user_id: uid,
    device_id: null,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link ?? null,
    image_url: input.imageUrl ?? null,
    metadata: input.data ?? null,
  }))

  let persisted = 0
  if (rows.length > 0) {
    const { count } = await supabase.from("notifications").insert(rows, { count: "exact" })
    persisted = count ?? rows.length
  }

  // Emit real-time socket event so connected clients update instantly
  for (const uid of eligibleUserIds) {
    emitToUser(uid, "notification", {
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
    })
  }

  // Send VAPID push to users' registered browser subscriptions
  const tokenRows = await getTokensForUsers(supabase, eligibleUserIds)
  const tokens = tokenRows.map((r) => r.token)
  const { successCount, invalidTokens } = await sendWebPushToSubscriptions(tokens, vapidMsg)
  await pruneInvalidTokens(supabase, invalidTokens)

  // Record dedup
  const sendRows = eligibleUserIds.map((uid) => ({
    user_id: uid,
    device_id: null,
    type: input.type,
    ref_id: input.refId ?? null,
  }))
  if (sendRows.length > 0) {
    await supabase.from("notification_sends").insert(sendRows)
  }

  return { pushed: successCount, persisted, pruned: invalidTokens.length }
}
