import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

const ADMIN_EMAILS = [
  "miltonmukundwa@gmail.com",
  ...(process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim()) : []),
]

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase().trim())
}

export async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) redirect("/")
  return user
}

export async function logAuditAction({
  adminId,
  adminEmail,
  action,
  targetType,
  targetId,
  details,
  ipAddress,
}: {
  adminId: string
  adminEmail: string
  action: string
  targetType?: string
  targetId?: string
  details?: Record<string, unknown>
  ipAddress?: string
}) {
  try {
    const db = createAdminClient()
    await db.from("audit_logs").insert({
      admin_id: adminId,
      admin_email: adminEmail,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      ip_address: ipAddress,
    })
  } catch {
    console.error("[audit] Failed to log admin action:", action)
  }
}
