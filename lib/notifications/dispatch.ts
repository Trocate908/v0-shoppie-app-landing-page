import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendWebPushToSubscriptions, type WebPushMessage } from "@/lib/push/server"
import { emitToUser } from "@/lib/socket-server"

// This project does not provide Supabase generated Database types yet. Keep
// notification-table access dynamic until those types are introduced.
type AdminClient = Omit<ReturnType<typeof createAdminClient>, "from"> & {
  from: (table: string) => any
}
type PushTokenRow = { user_id?: string | null; token: string }
type VendorRow = { id?: string; user_id?: string | null; vendor_id?: string | null }

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
  | {
      audience:
        | "all_shoppers"
        | "all_vendors"
        | "all_vendors_with_products"
        | "all_vendors_without_products"
        | "all_vendors_verified"
        | "all"
    }

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
  supabase: AdminClient,
  userIds: string[],
): Promise<{ userId: string; token: string }[]> {
  if (userIds.length === 0) return []
  const { data, error } = await supabase
    .from("push_tokens")
    .select("user_id, token")
    .eq("enabled", true)
    .in("user_id", userIds)
  if (error) throw error
  return ((data ?? []) as PushTokenRow[]).map((row) => ({
    userId: row.user_id as string,
    token: row.token,
  }))
}

async function getTokensForAudience(
  supabase: AdminClient,
  audience: "all" | "all_shoppers",
): Promise<string[]> {
  let query = supabase
    .from("push_tokens")
    .select("user_id, token")
    .eq("enabled", true)

  if (audience === "all_shoppers") {
    query = query.in("user_type", ["shopper", "anonymous"])
  }

  const { data, error } = await query
  if (error) throw error

  const tokenRows = (data ?? []) as PushTokenRow[]
  if (audience === "all") {
    return tokenRows.map((row) => row.token)
  }

  const { data: vendors, error: vendorError } = await supabase
    .from("vendors")
    .select("user_id")
    .limit(5000)
  if (vendorError) throw vendorError

  const vendorUserIds = new Set(
    ((vendors ?? []) as VendorRow[])
      .map((vendor) => vendor.user_id)
      .filter((id): id is string => Boolean(id)),
  )
  return tokenRows
    .filter((row) => !row.user_id || !vendorUserIds.has(row.user_id))
    .map((row) => row.token)
}

async function pruneInvalidTokens(
  supabase: AdminClient,
  invalidTokens: string[],
) {
  if (invalidTokens.length === 0) return
  const { error } = await supabase.from("push_tokens").delete().in("token", invalidTokens)
  if (error) throw error
}

// ── Audience resolver ───────────────────────────────────────────────────────

async function resolveUserIds(
  supabase: AdminClient,
  target: DispatchTarget,
): Promise<string[]> {
  if ("userId" in target) return [target.userId]
  if ("userIds" in target) return target.userIds

  const userIds = new Set<string>()

  if ("audience" in target) {
    const { audience } = target

    if (audience === "all_shoppers" || audience === "all") {
      const { data, error } = await supabase
        .from("push_tokens")
        .select("user_id")
        .eq("enabled", true)
        .in("user_type", ["shopper", "anonymous"])
        .not("user_id", "is", null)
      if (error) throw error
      ;((data ?? []) as PushTokenRow[]).forEach((row) => {
        if (row.user_id) userIds.add(row.user_id)
      })
    }

    if (audience === "all_vendors" || audience === "all") {
      const { data, error } = await supabase
        .from("vendors")
        .select("user_id")
        .limit(5000)
      if (error) throw error
      ;((data ?? []) as VendorRow[]).forEach((vendor) => {
        if (vendor.user_id) userIds.add(vendor.user_id)
      })
    }

    if (audience === "all_vendors_verified") {
      const { data, error } = await supabase
        .from("vendors")
        .select("user_id")
        .eq("is_verified", true)
        .limit(5000)
      if (error) throw error
      ;((data ?? []) as VendorRow[]).forEach((vendor) => {
        if (vendor.user_id) userIds.add(vendor.user_id)
      })
    }

    if (audience === "all_vendors_with_products") {
      const { data, error } = await supabase
        .from("vendors")
        .select("user_id, products!inner(id)")
        .limit(5000)
      if (error) throw error
      ;((data ?? []) as VendorRow[]).forEach((vendor) => {
        if (vendor.user_id) userIds.add(vendor.user_id)
      })
    }

    if (audience === "all_vendors_without_products") {
      const { data: vendors, error: vendorsError } = await supabase
        .from("vendors")
        .select("user_id, id")
      if (vendorsError) throw vendorsError
      const vendorRows = (vendors ?? []) as VendorRow[]
      const ids = vendorRows.map((vendor) => vendor.id).filter((id): id is string => Boolean(id))
      const { data: withProducts, error: productsError } = await supabase
        .from("products")
        .select("vendor_id")
        .in("vendor_id", ids)
      if (productsError) throw productsError
      const has = new Set(
        ((withProducts ?? []) as VendorRow[])
          .map((product) => product.vendor_id)
          .filter((id): id is string => Boolean(id)),
      )
      vendorRows.forEach((vendor) => {
        if (vendor.user_id && vendor.id && !has.has(vendor.id)) {
          userIds.add(vendor.user_id)
        }
      })
    }
  }

  return Array.from(userIds)
}

async function filterByDedup(
  supabase: AdminClient,
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

  const { data, error } = await q
  if (error) throw error
  const alreadySent = new Set(
    ((data ?? []) as Array<{ user_id: string }>).map((row) => row.user_id),
  )
  return userIds.filter((id) => !alreadySent.has(id))
}

// ── Main dispatch ──────────────────────────────────────────────────────────

export async function dispatchNotification(
  target: DispatchTarget,
  input: DispatchInput,
): Promise<{ pushed: number; persisted: number; pruned: number }> {
  const supabase = createAdminClient() as AdminClient
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

    const audience = target.audience
    const tokens = await getTokensForAudience(
      supabase,
      audience === "all" ? "all" : "all_shoppers",
    )
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
