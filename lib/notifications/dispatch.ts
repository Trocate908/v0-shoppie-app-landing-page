import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendOneSignalToUsers, sendOneSignalToAll, type OneSignalMessage } from "@/lib/push/onesignal"

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
  /** Relative or absolute link — stored in the notifications table and opened when tapped. */
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

// ── Helpers ────────────────────────────────────────────────────────────────

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

  // ── Audience broadcasts use OneSignal's "All" segment directly ──────────
  // We skip per-user dedup and in-app persistence for broadcast pushes to
  // avoid resolving thousands of user IDs. A daily refId dedup is good enough.
  const isAudienceBroadcast =
    "audience" in target &&
    (target.audience === "all_shoppers" || target.audience === "all")

  if (isAudienceBroadcast) {
    // Global dedup — check if we already sent this refId globally today
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

    const result = await sendOneSignalToAll({
      title: input.title,
      body: input.body,
      url: toAbsolute(input.link),
      imageUrl: input.imageUrl,
      data: input.data,
    })

    // Record one global dedup row so we don't re-send within the window
    if (input.refId) {
      await supabase.from("notification_sends").insert({
        user_id: null,
        device_id: null,
        type: input.type,
        ref_id: input.refId,
      })
    }

    return { pushed: result.pushed, persisted: 0, pruned: 0 }
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

  // Send push via OneSignal (targets by Supabase user ID = OneSignal external_id)
  const result = await sendOneSignalToUsers(eligibleUserIds, {
    title: input.title,
    body: input.body,
    url: toAbsolute(input.link),
    imageUrl: input.imageUrl,
    data: input.data,
  })

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

  return { pushed: result.pushed, persisted, pruned: 0 }
}
